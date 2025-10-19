import express from "express";
import type { Request } from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";
import { companyGuard } from "./companyGuard.js";
import { computeValidTo, dateOnly, recordStatusEvent } from "./statusEvents.js";

export const companiesRouter = express.Router();

type TenantRequest = express.Request<any, any, any, any> & {
  tenantId?: string;
  companyId?: string;
};

const PERMIT_STATUS_MAP = new Map<string, string>([
  ["active", "Active"],
  ["ruhend", "Ruhend"],
  ["gelöscht", "Gelöscht"],
  ["geloescht", "Gelöscht"]
]);

const PERMIT_EVENT_TYPES = new Set(["REGISTERED", "ACTIVE", "RUHEND", "WIEDERBETRIEB", "GELOESCHT"]);

const EVENT_STATUS_SYNC: Record<string, string> = {
  REGISTERED: "Active",
  ACTIVE: "Active",
  WIEDERBETRIEB: "Active",
  RUHEND: "Ruhend",
  GELOESCHT: "Gelöscht"
};

const VIN_MAX_LENGTH = 32;
const GISA_REGEX = /^GISA\d{5,}$/;
const POSTAL_CODE_REGEX = /\b\d{4}\b/;

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const [first] = value as unknown[];
    return typeof first === "string" ? first : undefined;
  }
  if (value && typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
    const str = String(value);
    return str === "[object Object]" ? undefined : str;
  }
  return undefined;
}

function tenantHeader(req: Request): string | undefined {
  const raw = req.headers["x-tenant-id"] ?? req.headers["X-Tenant-Id"];
  if (Array.isArray(raw)) {
    const [first] = raw;
    return typeof first === "string" ? first.trim() : undefined;
  }
  return typeof raw === "string" ? raw.trim() : undefined;
}

function tenantFrom(req: TenantRequest): string | undefined {
  return tenantHeader(req);
}

async function ensureCompany(id: string, tenantId: string) {
  return prisma.company.findFirst({ where: { companyId: id, tenantId } });
}

function normalizePermitStatus(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return "Active";
  }
  const normalized = value.trim().toLowerCase();
  return PERMIT_STATUS_MAP.get(normalized) ?? null;
}

function normalizeEventType(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const candidate = value.trim().toUpperCase();
  if (candidate === "GELÖSCHT") {
    return "GELOESCHT";
  }
  return PERMIT_EVENT_TYPES.has(candidate) ? candidate : null;
}

function parseDateOrNull(value: unknown, field: string): Date | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} geçerli bir tarih olmalıdır`);
  }
  return date;
}

function parseIntOrNull(value: unknown, field: string): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new Error(`${field} sayı olmalıdır`);
  }
  return Math.trunc(num);
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return false;
}

function ensureGisaFormat(value: string) {
  if (!GISA_REGEX.test(value.trim())) {
    throw new Error("companyId GISA formatında olmalıdır (örn. GISA123456).");
  }
}

function validatePostalAddress(value: string) {
  if (!POSTAL_CODE_REGEX.test(value)) {
    throw new Error("address geçerli bir posta kodu içermelidir (örn. 1010).");
  }
}

function normalizeVin(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("vin zorunlu");
  }
  const vin = value.trim().toUpperCase();
  if (vin.length > VIN_MAX_LENGTH) {
    throw new Error("vin çok uzun");
  }
  return vin;
}

async function activeAuthorizationCount(permitId: string) {
  return prisma.vehicleAuthorization.count({ where: { permitId, revokedOn: null } });
}

companiesRouter.get(
  "/",
  permissionGuard(["tp.company.read"]),
  scopeGuard(),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const q = firstQueryValue(req.query?.q) ?? "";
    const rows = await prisma.company.findMany({
      where: {
        tenantId,
        OR: q
          ? [
              { legalName: { contains: q } },
              { companyId: { contains: q } },
              { address: { contains: q } }
            ]
          : undefined
      },
      orderBy: { companyId: "asc" }
    });
    res.json({ ok: true, items: rows });
  }
);

companiesRouter.post(
  "/",
  permissionGuard(["tp.company.create"]),
  scopeGuard(),
  async (req: TenantRequest, res) => {
    const tenantId = tenantFrom(req);
    const { companyId, legalName, address, status } = req.body || {};
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    if (!companyId || !legalName || !address) {
      res
        .status(400)
        .json({ ok: false, error: "companyId, legalName ve address zorunlu" });
      return;
    }
    const normalizedCompanyId = typeof companyId === "string" ? companyId.trim() : "";
    const normalizedLegalName = typeof legalName === "string" ? legalName.trim() : "";
    const normalizedAddress = typeof address === "string" ? address.trim() : "";
    try {
      ensureGisaFormat(normalizedCompanyId);
      validatePostalAddress(normalizedAddress);
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const company = await prisma.company.create({
      data: {
        tenantId,
        companyId: normalizedCompanyId,
        legalName: normalizedLegalName,
        address: normalizedAddress,
        status: status ? String(status).trim() : "Active",
        validTo: null
      }
    });
    res.status(201).json({ ok: true, company });
  }
);

companiesRouter.use("/:id", scopeGuard(), companyGuard());

companiesRouter.get(
  "/:id",
  permissionGuard(["tp.company.read"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const companyId = req.companyId || req.params.id;
    const company = await prisma.company.findFirst({
      where: { companyId, tenantId },
      include: {
        officers: true,
        shareholders: true,
        documents: true,
        permits: {
          orderBy: { permitRegisteredOn: "desc" },
          include: {
            vehicleAuthorizations: {
              orderBy: { authorizedOn: "desc" }
            }
          }
        },
        permitEvents: {
          orderBy: { eventDate: "desc" }
        }
      }
    });
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    res.json({ ok: true, company });
  }
);

companiesRouter.put(
  "/:id",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const companyId = req.companyId || req.params.id;
    const { legalName, address, status } = req.body || {};
    try {
      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.findFirst({
          where: { companyId, tenantId }
        });
        if (!company) {
          return { notFound: true as const };
        }
        const updateData: Record<string, unknown> = {};
        if (typeof legalName === "string") {
          updateData.legalName = legalName.trim();
        }
        if (typeof address === "string") {
          const trimmedAddress = address.trim();
          try {
            validatePostalAddress(trimmedAddress);
          } catch (error) {
            throw new Error(`VALIDATION:${(error as Error).message}`);
          }
          updateData.address = trimmedAddress;
        }
        const currentStatus = company.status ?? "Active";
        let statusChange: { previous: string; next: string; validTo: Date | null } | null = null;
        if (typeof status === "string") {
          const trimmedStatus = status.trim();
          updateData.status = trimmedStatus;
          const statusDate = dateOnly();
          const validToValue = computeValidTo(trimmedStatus, statusDate);
          if (trimmedStatus !== currentStatus || (trimmedStatus.toLowerCase() === "active" && company.validTo)) {
            updateData.validTo = validToValue;
            statusChange = { previous: currentStatus, next: trimmedStatus, validTo: validToValue };
          }
        } else if (status === "") {
          updateData.status = "";
          updateData.validTo = null;
          if (currentStatus !== "") {
            statusChange = { previous: currentStatus, next: "", validTo: null };
          }
        }
        const updated =
          Object.keys(updateData).length > 0
            ? await tx.company.update({
                where: { companyId: company.companyId },
                data: updateData
              })
            : company;
        if (statusChange) {
          await recordStatusEvent(tx, {
            tenantId,
            entityType: "COMPANY",
            entityId: updated.companyId,
            status: statusChange.next,
            validTo: statusChange.validTo
          });
        }
        return { company: updated };
      });

      if (result.notFound) {
        res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
        return;
      }

      res.json({ ok: true, company: result.company });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Güncelleme başarısız.";
      if (message.startsWith("VALIDATION:")) {
        res.status(400).json({ ok: false, error: message.slice("VALIDATION:".length) });
        return;
      }
      res.status(500).json({ ok: false, error: message });
    }
  }
);

companiesRouter.delete(
  "/:id",
  permissionGuard(["tp.company.delete"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const companyId = req.companyId || req.params.id;
    const noteRaw = (req.body as Record<string, unknown> | undefined)?.note;
    const note =
      typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;
    try {
      const result = await prisma.$transaction(async (tx) => {
        const company = await tx.company.findFirst({
          where: { companyId, tenantId }
        });
        if (!company) {
          return { notFound: true as const };
        }
        const archiveDate = dateOnly();
        const updated = await tx.company.update({
          where: { companyId: company.companyId },
          data: {
            status: "Archived",
            validTo: archiveDate
          }
        });
        await recordStatusEvent(tx, {
          tenantId,
          entityType: "COMPANY",
          entityId: updated.companyId,
          status: "Archived",
          validTo: archiveDate,
          note
        });
        return {};
      });

      if (result.notFound) {
        res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arşivleme başarısız.";
      res.status(500).json({ ok: false, error: message });
    }
  }
);

companiesRouter.post(
  "/:id/officers",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { type, userId, validFrom, validTo } = req.body || {};
    if (!type) {
      res.status(400).json({ ok: false, error: "type zorunlu" });
      return;
    }
    const officer = await prisma.companyOfficer.create({
      data: {
        companyId: company.companyId,
        type,
        userId: userId || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null
      }
    });
    res.status(201).json({ ok: true, officer });
  }
);

companiesRouter.delete(
  "/:id/officers/:officerId",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.companyOfficer.deleteMany({
      where: { id: req.params.officerId, companyId: company.companyId }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);

companiesRouter.post(
  "/:id/shareholders",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { personName, roleType, percent } = req.body || {};
    if (!personName || !roleType) {
      res.status(400).json({ ok: false, error: "personName ve roleType zorunlu" });
      return;
    }
    const shareholder = await prisma.shareholder.create({
      data: {
        companyId: company.companyId,
        personName,
        roleType,
        percent: percent === undefined ? null : Number(percent)
      }
    });
    res.status(201).json({ ok: true, shareholder });
  }
);

companiesRouter.delete(
  "/:id/shareholders/:shareholderId",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.shareholder.deleteMany({
      where: { id: req.params.shareholderId, companyId: company.companyId }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);

companiesRouter.post(
  "/:id/documents",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { title, docType, url, metaJson } = req.body || {};
    if (!title || !docType) {
      res.status(400).json({ ok: false, error: "title ve docType zorunlu" });
      return;
    }
    const document = await prisma.companyDocument.create({
      data: {
        companyId: company.companyId,
        title,
        docType,
        url: url || null,
        metaJson: metaJson ? JSON.stringify(metaJson) : null
      }
    });
    res.status(201).json({ ok: true, document });
  }
);

companiesRouter.delete(
  "/:id/documents/:documentId",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const removed = await prisma.companyDocument.deleteMany({
      where: { id: req.params.documentId, companyId: company.companyId }
    });
    if (!removed.count) {
      res.status(404).json({ ok: false, error: "Kayıt bulunamadı" });
      return;
    }
    res.json({ ok: true });
  }
);

companiesRouter.get(
  "/:id/permits",
  permissionGuard(["tp.company.read"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const [permits, events] = await Promise.all([
      prisma.companyPermit.findMany({
        where: { companyId: company.companyId },
        orderBy: { permitRegisteredOn: "desc" },
        include: { vehicleAuthorizations: { orderBy: { authorizedOn: "desc" } } }
      }),
      prisma.companyPermitEvent.findMany({
        where: { companyId: company.companyId },
        orderBy: { eventDate: "desc" }
      })
    ]);
    res.json({ ok: true, permits, events });
  }
);

companiesRouter.post(
  "/:id/permits",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const {
      companyId,
      permitType,
      issuingAuthority,
      referenceNo,
      permitRegisteredOn,
      effectiveFrom,
      validUntil,
      capacityPkw,
      vehicleScoped,
      status
    } = req.body || {};
    if (!companyId || companyId !== company.companyId) {
      res.status(400).json({ ok: false, error: "companyId zorunlu ve rota ile eşleşmeli" });
      return;
    }
    if (!permitType || typeof permitType !== "string" || !permitType.trim()) {
      res.status(400).json({ ok: false, error: "permitType zorunlu" });
      return;
    }
    const normalizedStatus = normalizePermitStatus(status);
    if (!normalizedStatus) {
      res.status(400).json({ ok: false, error: "Geçersiz status" });
      return;
    }
    let permitRegisteredDate: Date | null;
    let effectiveFromDate: Date | null;
    let validUntilDate: Date | null;
    let capacityValue: number | null;
    try {
      permitRegisteredDate = parseDateOrNull(permitRegisteredOn, "permitRegisteredOn");
      effectiveFromDate = parseDateOrNull(effectiveFrom, "effectiveFrom");
      validUntilDate = parseDateOrNull(validUntil, "validUntil");
      capacityValue = parseIntOrNull(capacityPkw, "capacityPkw");
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const permit = await prisma.companyPermit.create({
      data: {
        companyId: company.companyId,
        permitType: permitType.trim(),
        issuingAuthority: issuingAuthority?.trim() || null,
        referenceNo: referenceNo?.trim() || null,
        permitRegisteredOn: permitRegisteredDate,
        effectiveFrom: effectiveFromDate,
        validUntil: validUntilDate,
        capacityPkw: capacityValue,
        vehicleScoped: parseBoolean(vehicleScoped),
        status: normalizedStatus
      }
    });
    res.status(201).json({ ok: true, permit });
  }
);

companiesRouter.put(
  "/:id/permits/:permitId",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { companyId, status, permitRegisteredOn, effectiveFrom, validUntil, capacityPkw, vehicleScoped, ...rest } =
      req.body || {};
    if (companyId && companyId !== company.companyId) {
      res.status(400).json({ ok: false, error: "companyId rota ile eşleşmeli" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    const data: Record<string, unknown> = {};
    if (typeof rest.permitType === "string") data.permitType = rest.permitType.trim();
    if (typeof rest.issuingAuthority !== "undefined") {
      data.issuingAuthority =
        rest.issuingAuthority === null || rest.issuingAuthority === ""
          ? null
          : String(rest.issuingAuthority).trim();
    }
    if (typeof rest.referenceNo !== "undefined") {
      data.referenceNo =
        rest.referenceNo === null || rest.referenceNo === "" ? null : String(rest.referenceNo).trim();
    }
    if (typeof vehicleScoped !== "undefined") {
      data.vehicleScoped = parseBoolean(vehicleScoped);
    }
    if (typeof status !== "undefined") {
      const normalizedStatus = normalizePermitStatus(status);
      if (!normalizedStatus) {
        res.status(400).json({ ok: false, error: "Geçersiz status" });
        return;
      }
      data.status = normalizedStatus;
    }
    try {
      if (typeof permitRegisteredOn !== "undefined") {
        data.permitRegisteredOn = parseDateOrNull(permitRegisteredOn, "permitRegisteredOn");
      }
      if (typeof effectiveFrom !== "undefined") {
        data.effectiveFrom = parseDateOrNull(effectiveFrom, "effectiveFrom");
      }
      if (typeof validUntil !== "undefined") {
        data.validUntil = parseDateOrNull(validUntil, "validUntil");
      }
      if (typeof capacityPkw !== "undefined") {
        data.capacityPkw = parseIntOrNull(capacityPkw, "capacityPkw");
      }
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    if (Object.keys(data).length === 0) {
      res.status(400).json({ ok: false, error: "Güncellenecek alan bulunamadı" });
      return;
    }
    const updated = await prisma.companyPermit.update({
      where: { id: permit.id },
      data
    });
    res.json({ ok: true, permit: updated });
  }
);

companiesRouter.get(
  "/:id/permits/:permitId/vehicles",
  permissionGuard(["tp.company.read"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId },
      include: { vehicleAuthorizations: { orderBy: { authorizedOn: "desc" } } }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    res.json({ ok: true, items: permit.vehicleAuthorizations });
  }
);

companiesRouter.post(
  "/:id/permits/:permitId/vehicles",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { companyId, vehicleId, vin, authorizedOn, revokedOn } = req.body || {};
    if (companyId && companyId !== company.companyId) {
      res.status(400).json({ ok: false, error: "companyId rota ile eşleşmeli" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    let linkedVehicle: { vehicleId: string; vin: string } | null = null;
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { vehicleId, tenantId, companyId: company.companyId }
      });
      if (!vehicle) {
        res.status(404).json({ ok: false, error: "Araç bulunamadı" });
        return;
      }
      linkedVehicle = { vehicleId: vehicle.vehicleId, vin: vehicle.vin };
    }
    if (permit.vehicleScoped && !linkedVehicle) {
      res.status(400).json({ ok: false, error: "vehicleId zorunlu" });
      return;
    }
    const normalizedVin = normalizeVin(vin ?? linkedVehicle?.vin ?? "");
    if (linkedVehicle && normalizedVin !== linkedVehicle.vin.trim().toUpperCase()) {
      res.status(400).json({ ok: false, error: "VIN araç kaydıyla eşleşmiyor" });
      return;
    }
    let authorizedDate: Date;
    try {
      authorizedDate = parseDateOrNull(authorizedOn, "authorizedOn") ?? new Date();
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    let revokedDate: Date | null = null;
    try {
      revokedDate = parseDateOrNull(revokedOn, "revokedOn");
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    if (!revokedDate && typeof permit.capacityPkw === "number") {
      const activeCount = await activeAuthorizationCount(permit.id);
      if (activeCount >= permit.capacityPkw) {
        res.status(400).json({ ok: false, error: "Kota dolu" });
        return;
      }
    }
    try {
      const authorization = await prisma.vehicleAuthorization.create({
        data: {
          permitId: permit.id,
          vehicleId: linkedVehicle?.vehicleId ?? null,
          vin: normalizedVin,
          authorizedOn: authorizedDate,
          revokedOn: revokedDate
        }
      });
      res.status(201).json({ ok: true, authorization });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2002") {
        res.status(409).json({ ok: false, error: "VIN zaten yetkilendirilmiş" });
        return;
      }
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  }
);

companiesRouter.post(
  "/:id/permits/:permitId/vehicles/:authorizationId/revoke",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    const authorization = await prisma.vehicleAuthorization.findFirst({
      where: { id: req.params.authorizationId, permitId: permit.id }
    });
    if (!authorization) {
      res.status(404).json({ ok: false, error: "Yetki kaydı bulunamadı" });
      return;
    }
    if (authorization.revokedOn) {
      res.status(400).json({ ok: false, error: "Kayıt zaten pasifleştirilmiş" });
      return;
    }
    let revokedDate: Date;
    try {
      revokedDate = parseDateOrNull(req.body?.revokedOn, "revokedOn") ?? new Date();
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const updated = await prisma.vehicleAuthorization.update({
      where: { id: authorization.id },
      data: { revokedOn: revokedDate }
    });
    res.json({ ok: true, authorization: updated });
  }
);

companiesRouter.post(
  "/:id/permits/:permitId/events",
  permissionGuard(["tp.company.update"]),
  async (req: TenantRequest, res) => {
    const tenantId = tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const { companyId, eventType, eventDate, referenceNo, sourceDocRef } = req.body || {};
    if (companyId && companyId !== company.companyId) {
      res.status(400).json({ ok: false, error: "companyId rota ile eşleşmeli" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    const normalizedEventType = normalizeEventType(eventType);
    if (!normalizedEventType) {
      res.status(400).json({ ok: false, error: "Geçersiz event_type" });
      return;
    }
    let eventDateValue: Date;
    try {
      const parsed = parseDateOrNull(eventDate, "eventDate");
      if (!parsed) {
        throw new Error("eventDate zorunludur");
      }
      eventDateValue = parsed;
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.companyPermitEvent.create({
        data: {
          companyId: company.companyId,
          permitId: permit.id,
          referenceNo: referenceNo?.trim() || permit.referenceNo || null,
          eventType: normalizedEventType,
          eventDate: eventDateValue,
          sourceDocRef: sourceDocRef?.trim() || null
        }
      });
      const nextStatus = EVENT_STATUS_SYNC[normalizedEventType];
      const updates: Record<string, unknown> = {};
      if (nextStatus) {
        updates.status = nextStatus;
      }
      switch (normalizedEventType) {
        case "REGISTERED":
          updates.permitRegisteredOn = eventDateValue;
          if (!permit.effectiveFrom) {
            updates.effectiveFrom = eventDateValue;
          }
          break;
        case "ACTIVE":
        case "WIEDERBETRIEB":
          updates.effectiveFrom = eventDateValue;
          updates.validUntil = null;
          break;
        case "RUHEND":
          updates.validUntil = eventDateValue;
          break;
        case "GELOESCHT":
          updates.validUntil = eventDateValue;
          break;
        default:
          break;
      }
      if (Object.keys(updates).length > 0) {
        await tx.companyPermit.update({
          where: { id: permit.id },
          data: updates
        });
      }
      return created;
    });
    res.status(201).json({ ok: true, event });
  }
);

companiesRouter.get(
  "/:id/permits/:permitId/events",
  permissionGuard(["tp.company.read"]),
  async (req: TenantRequest, res) => {
    const tenantId = req.tenantId || tenantFrom(req) || "";
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const company = await ensureCompany(req.companyId || req.params.id, tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }
    const permit = await prisma.companyPermit.findFirst({
      where: { id: req.params.permitId, companyId: company.companyId }
    });
    if (!permit) {
      res.status(404).json({ ok: false, error: "İzin bulunamadı" });
      return;
    }
    const events = await prisma.companyPermitEvent.findMany({
      where: { permitId: permit.id },
      orderBy: { eventDate: "desc" }
    });
    res.json({ ok: true, events });
  }
);
