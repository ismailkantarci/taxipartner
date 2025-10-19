import express from "express";
import type { Request } from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";
import { companyGuard } from "./companyGuard.js";
import { computeValidTo, dateOnly, recordStatusEvent } from "./statusEvents.js";

export const vehiclesRouter = express.Router();

const VEHICLE_USAGE = new Set(["Taxi", "Mietwagen"]);
const VEHICLE_STATUS = new Set(["Active", "Maintenance", "Inactive", "Archived"]);

type VehicleRequest = express.Request<any, any, any, any> & {
  tenantId?: string;
  companyId?: string;
};

function tenantHeader(req: Request): string | undefined {
  const raw = req.headers["x-tenant-id"] ?? req.headers["X-Tenant-Id"];
  if (Array.isArray(raw)) {
    const [first] = raw;
    return typeof first === "string" ? first.trim() : undefined;
  }
  return typeof raw === "string" ? raw.trim() : undefined;
}

function tenantFrom(req: VehicleRequest): string | undefined {
  return tenantHeader(req);
}

async function ensureCompany(companyId: string, tenantId: string) {
  return prisma.company.findFirst({ where: { companyId, tenantId } });
}

function normalizeUsage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  return VEHICLE_USAGE.has(candidate) ? candidate : null;
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Active";
  const candidate = value.trim();
  return VEHICLE_STATUS.has(candidate) ? candidate : "Active";
}

function parseSeatCount(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    throw new Error("seatCount tam sayı olmalıdır");
  }
  if (num < 0 || num > 9) {
    throw new Error("seatCount 0-9 aralığında olmalıdır");
  }
  return num;
}

vehiclesRouter.get(
  "/",
  permissionGuard(["vehicle.manage"]),
  scopeGuard(),
  companyGuard(),
  async (req: VehicleRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    const companyId = req.companyId;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId zorunlu" });
      return;
    }
    const company = await ensureCompany(companyId, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, companyId: company.companyId },
      orderBy: { vin: "asc" }
    });
    res.json({ ok: true, items: vehicles });
  }
);

vehiclesRouter.post(
  "/",
  permissionGuard(["vehicle.manage"]),
  scopeGuard(),
  companyGuard(),
  async (req: VehicleRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const companyId = req.companyId;
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId zorunlu" });
      return;
    }
    const { vin, plateNo, seatCount, usage, status } = req.body || {};
    const company = await ensureCompany(companyId, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    if (!vin || typeof vin !== "string" || !vin.trim()) {
      res.status(400).json({ ok: false, error: "vin zorunlu" });
      return;
    }
    let seatCountValue: number | null;
    try {
      seatCountValue = parseSeatCount(seatCount);
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const normalizedUsage = normalizeUsage(usage);
    if (usage && !normalizedUsage) {
      res.status(400).json({ ok: false, error: "Geçersiz usage" });
      return;
    }
    const normalizedStatus = normalizeStatus(status);
    const statusDate = dateOnly();
    const validToValue = computeValidTo(normalizedStatus, statusDate);
    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          tenantId,
          companyId: company.companyId,
          vin: vin.trim(),
          plateNo: plateNo?.trim() || null,
          seatCount: seatCountValue,
          usage: normalizedUsage,
          status: normalizedStatus,
          validTo: validToValue
        }
      });
      res.status(201).json({ ok: true, vehicle });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2002") {
        res.status(409).json({ ok: false, error: "VIN benzersiz olmalıdır" });
        return;
      }
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  }
);

vehiclesRouter.put(
  "/:vehicleId",
  permissionGuard(["vehicle.manage"]),
  scopeGuard(),
  companyGuard(),
  async (req: VehicleRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const companyId = req.companyId;
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId zorunlu" });
      return;
    }
    const { plateNo, seatCount, usage, status } = req.body || {};
    const company = await ensureCompany(companyId, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicleId: req.params.vehicleId, tenantId, companyId: company.companyId }
    });
    if (!vehicle) {
      res.status(404).json({ ok: false, error: "Araç bulunamadı" });
      return;
    }
    let seatCountValue: number | null = vehicle.seatCount;
    if (typeof seatCount !== "undefined") {
      try {
        seatCountValue = parseSeatCount(seatCount);
      } catch (error) {
        res.status(400).json({ ok: false, error: (error as Error).message });
        return;
      }
    }
    const normalizedUsage = typeof usage !== "undefined" ? normalizeUsage(usage) : vehicle.usage;
    if (typeof usage !== "undefined" && usage && !normalizedUsage) {
      res.status(400).json({ ok: false, error: "Geçersiz usage" });
      return;
    }
    const normalizedStatus = typeof status !== "undefined" ? normalizeStatus(status) : vehicle.status;
    const statusDate = dateOnly();
    const validToValue = computeValidTo(normalizedStatus, statusDate);
    const validToChanged =
      (vehicle.validTo && validToValue && vehicle.validTo.getTime() !== validToValue.getTime()) ||
      (vehicle.validTo && !validToValue) ||
      (!vehicle.validTo && validToValue);
    const statusChanged = normalizedStatus !== vehicle.status || validToChanged;
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.vehicle.update({
          where: { vehicleId: vehicle.vehicleId },
          data: {
            plateNo: typeof plateNo !== "undefined" ? plateNo?.trim() || null : vehicle.plateNo,
            seatCount: seatCountValue,
            usage: normalizedUsage ?? null,
            status: normalizedStatus,
            validTo: validToValue ?? null
          }
        });
        if (statusChanged) {
          await recordStatusEvent(tx, {
            tenantId,
            entityType: "VEHICLE",
            entityId: next.vehicleId,
            status: normalizedStatus,
            validTo: validToValue ?? null
          });
        }
        return next;
      });
      res.json({ ok: true, vehicle: updated });
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  }
);

vehiclesRouter.delete(
  "/:vehicleId",
  permissionGuard(["vehicle.manage"]),
  scopeGuard(),
  companyGuard(),
  async (req: VehicleRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    const companyId = req.companyId || req.body?.companyId;
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    if (!companyId) {
      res.status(400).json({ ok: false, error: "companyId zorunlu" });
      return;
    }
    const company = await ensureCompany(companyId, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicleId: req.params.vehicleId, tenantId, companyId: company.companyId }
    });
    if (!vehicle) {
      res.status(404).json({ ok: false, error: "Araç bulunamadı" });
      return;
    }
    const noteRaw = (req.body as Record<string, unknown> | undefined)?.note;
    const note =
      typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;
    try {
      await prisma.$transaction(async (tx) => {
        const archiveDate = dateOnly();
        await tx.vehicle.update({
          where: { vehicleId: vehicle.vehicleId },
          data: {
            status: "Archived",
            validTo: archiveDate
          }
        });
        await recordStatusEvent(tx, {
          tenantId,
          entityType: "VEHICLE",
          entityId: vehicle.vehicleId,
          status: "Archived",
          validTo: archiveDate,
          note
        });
      });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);
