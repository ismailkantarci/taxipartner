import express from "express";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";

export const corporateActionsRouter = express.Router();

const ACTION_TYPES = new Set(["UMWANDLUNG", "VERSCHMELZUNG", "SPALTUNG", "EINBRINGUNG"]);

type CorporateActionPayload = {
  actionType?: unknown;
  effectiveDate?: unknown;
  sourceTenantIds?: unknown;
  targetTenantId?: unknown;
  note?: unknown;
};

function normalizeActionType(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("actionType zorunlu");
  }
  const normalized = value.trim().toUpperCase();
  if (!ACTION_TYPES.has(normalized)) {
    throw new Error(`Geçersiz actionType: ${normalized}`);
  }
  return normalized;
}

function parseDate(value: unknown): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error("effectiveDate geçerli bir tarih olmalıdır");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("effectiveDate geçerli bir tarih olmalıdır");
  }
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return normalized;
}

function parseSourceTenantIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (!items.length) {
      throw new Error("sourceTenantIds boş olamaz");
    }
    return Array.from(new Set(items));
  }
  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (!items.length) {
      throw new Error("sourceTenantIds boş olamaz");
    }
    return Array.from(new Set(items));
  }
  throw new Error("sourceTenantIds dizi veya virgülle ayrılmış string olmalıdır");
}

function parseTargetTenantId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("targetTenantId zorunlu");
  }
  return value.trim();
}

function parseStoredSourceTenantIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }
  return [];
}

function formatActionResponse<T extends { sourceTenantIds: unknown }>(action: T) {
  return {
    ...action,
    sourceTenantIds: parseStoredSourceTenantIds(action.sourceTenantIds)
  };
}

function includesTenant(action: { targetTenantId: string; sourceTenantIds: string[] }, tenantId: string): boolean {
  if (!tenantId) return false;
  if (action.targetTenantId === tenantId) {
    return true;
  }
  return action.sourceTenantIds.some((item) => item === tenantId);
}

corporateActionsRouter.get(
  "/",
  permissionGuard(["tp.corporate.read"]),
  async (req, res) => {
    const tenantIdParam = typeof req.query?.tenantId === "string" ? req.query.tenantId.trim() : "";
    const items = await prisma.corporateAction.findMany({
      orderBy: { effectiveDate: "desc" }
    });
    const normalized = items.map((item) => formatActionResponse(item));
    const filtered = tenantIdParam
      ? normalized.filter((item) => includesTenant(item, tenantIdParam))
      : normalized;
    res.json({ ok: true, items: filtered });
  }
);

corporateActionsRouter.post(
  "/",
  permissionGuard(["tp.corporate.create"]),
  async (req, res) => {
    const payload: CorporateActionPayload = req.body ?? {};
    try {
      const actionType = normalizeActionType(payload.actionType);
      const effectiveDate = parseDate(payload.effectiveDate);
      const sourceTenantIds = parseSourceTenantIds(payload.sourceTenantIds);
      const targetTenantId = parseTargetTenantId(payload.targetTenantId);
      const note =
        typeof payload.note === "string" && payload.note.trim().length > 0 ? payload.note.trim() : null;

      if (sourceTenantIds.includes(targetTenantId)) {
        res.status(400).json({ ok: false, error: "Kaynak ve hedef tenant aynı olamaz" });
        return;
      }

      const targetTenant = await prisma.tenant.findUnique({ where: { tenantId: targetTenantId } });
      if (!targetTenant) {
        res.status(404).json({ ok: false, error: `Target tenant bulunamadı: ${targetTenantId}` });
        return;
      }

      const uniqueSources = Array.from(new Set(sourceTenantIds));
      const foundSources = await prisma.tenant.findMany({
        where: { tenantId: { in: uniqueSources } },
        select: { tenantId: true }
      });
      const missingSources = uniqueSources.filter(
        (id) => !foundSources.some((tenant) => tenant.tenantId === id)
      );
      if (missingSources.length) {
        res
          .status(404)
          .json({ ok: false, error: `Kaynak tenant(lar) bulunamadı: ${missingSources.join(", ")}` });
        return;
      }

      const action = await prisma.corporateAction.create({
        data: {
          actionType,
          effectiveDate,
          sourceTenantIds: JSON.stringify(uniqueSources),
          targetTenantId,
          note
        }
      });
      res.status(201).json({ ok: true, action: formatActionResponse(action) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kurumsal işlem oluşturulamadı";
      res.status(400).json({ ok: false, error: message });
    }
  }
);
