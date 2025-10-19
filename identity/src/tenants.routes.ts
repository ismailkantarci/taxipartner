import express from "express";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
import { scopeGuard } from "./scopeGuard.js";
import { computeValidTo, dateOnly, recordStatusEvent } from "./statusEvents.js";

export const tenantsRouter = express.Router();

function toDateOnly(value: unknown): Date | null {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  return null;
}

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

type TenantIdInput = {
  idType: string;
  idValue: string;
  countryCode: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  primaryFlag: boolean;
};

type TenantIdentifierRecord = {
  id: string;
  tenantId: string;
  idType: string;
  idValue: string;
  countryCode: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  primaryFlag: boolean;
};

const TENANT_ID_PRIORITY = ["FN", "ZVR", "GISA", "UID", "GLN", "STEUERNR", "LEGACY", "SYNTHETIC"];

const IDENTIFIER_REGEX: Record<string, RegExp> = {
  FN: /^FN\d{6}[A-Z0-9]?$/,
  GISA: /^GISA\d{5,}$/,
  UID: /^ATU\d{8}$/
};

const POSTAL_CODE_REGEX = /\b\d{4}\b/;

const SHAREHOLDING_ROLE_TYPES = new Set([
  "Komplementär",
  "Kommanditist",
  "Gesellschafter",
  "Anteilseigner"
]);

const PARTY_TYPES = new Set(["NatürlichePerson", "JuristischePerson"]);

const LIABILITY_TYPES = new Set(["beschränkt", "unbeschränkt"]);

const VEHICLE_USAGE_TYPES = new Set(["Taxi", "Mietwagen"]);
const VEHICLE_STATUS_TYPES = new Set(["Active", "Maintenance", "Inactive", "Archived"]);

type TenantErrorCode =
  | "TENANT_ID_REQUIRED"
  | "OU_NOT_FOUND"
  | "OU_NAME_REQUIRED"
  | "OU_PARENT_INVALID"
  | "OU_DELETE_HAS_CHILDREN"
  | "ORG_NAME_REQUIRED"
  | "ORG_PARENT_INVALID"
  | "ORG_COMPANY_INVALID"
  | "ORG_NOT_FOUND"
  | "ORG_DELETE_HAS_CHILDREN"
  | "ORG_DELETE_HAS_MANDATES"
  | "MANDATE_TITLE_REQUIRED"
  | "MANDATE_TYPE_REQUIRED"
  | "MANDATE_ORG_INVALID"
  | "MANDATE_COMPANY_INVALID"
  | "MANDATE_NOT_FOUND";

const ERROR_MESSAGE: Record<TenantErrorCode, string> = {
  TENANT_ID_REQUIRED: "tenantId zorunlu",
  OU_NOT_FOUND: "organizasyon birimi bulunamadı",
  OU_NAME_REQUIRED: "name zorunlu",
  OU_PARENT_INVALID: "parentId geçersiz",
  OU_DELETE_HAS_CHILDREN: "Alt birimler varken silinemez",
  ORG_NAME_REQUIRED: "name zorunlu",
  ORG_PARENT_INVALID: "parentId geçersiz",
  ORG_COMPANY_INVALID: "companyId geçersiz",
  ORG_NOT_FOUND: "organization bulunamadı",
  ORG_DELETE_HAS_CHILDREN: "Alt organizasyonlar varken silinemez",
  ORG_DELETE_HAS_MANDATES: "Bağlı mandatelar varken organizasyon silinemez",
  MANDATE_TITLE_REQUIRED: "title zorunlu",
  MANDATE_TYPE_REQUIRED: "mandateType zorunlu",
  MANDATE_ORG_INVALID: "organizationId geçersiz",
  MANDATE_COMPANY_INVALID: "companyId geçersiz",
  MANDATE_NOT_FOUND: "mandate bulunamadı"
};

function respondError(res: express.Response, status: number, code: TenantErrorCode, overrideMessage?: string) {
  res.status(status).json({
    ok: false,
    errorCode: code,
    error: overrideMessage ?? ERROR_MESSAGE[code] ?? "Error"
  });
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
}

function parseIntParam(
  value: unknown,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  const raw = firstQueryValue(value);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  let result = parsed;
  if (typeof options.min === "number" && result < options.min) {
    result = options.min;
  }
  if (typeof options.max === "number" && result > options.max) {
    result = options.max;
  }
  return result;
}

function identityTypePriority(value: string): number {
  const upper = value?.toUpperCase?.() ?? "";
  const index = TENANT_ID_PRIORITY.indexOf(upper);
  return index === -1 ? TENANT_ID_PRIORITY.length : index;
}

function isActiveInterval(validFrom: Date | null | undefined, validTo: Date | null | undefined): boolean {
  const now = Date.now();
  if (validFrom instanceof Date && validFrom.getTime() > now) {
    return false;
  }
  if (validTo instanceof Date && validTo.getTime() < now) {
    return false;
  }
  return true;
}

function normalizeVehicleUsage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  return VEHICLE_USAGE_TYPES.has(candidate) ? candidate : null;
}

function normalizeVehicleStatus(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Active";
  const candidate = value.trim();
  return VEHICLE_STATUS_TYPES.has(candidate) ? candidate : "Active";
}

function parseVehicleSeatCount(value: unknown): number | null {
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

async function ensureVehicleCompany(companyId: string, tenantId: string) {
  return prisma.company.findFirst({ where: { companyId, tenantId } });
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return false;
}

function parseTenantIdentifierEntry(raw: unknown): TenantIdInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Kimlik girdisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const typeRaw = entry.idType ?? entry.type;
  const valueRaw = entry.idValue ?? entry.value;
  const idType = typeof typeRaw === "string" ? typeRaw.trim().toUpperCase() : "";
  const idValue = typeof valueRaw === "string" ? valueRaw.trim() : "";
  if (!idType) {
    throw new Error("idType zorunlu");
  }
  if (!idValue) {
    throw new Error("idValue zorunlu");
  }
  const pattern = IDENTIFIER_REGEX[idType];
  if (pattern && !pattern.test(idValue)) {
    throw new Error(`idValue formatı geçersiz (${idType})`);
  }
  const countryCode =
    typeof entry.countryCode === "string" && entry.countryCode.trim().length
      ? entry.countryCode.trim().toUpperCase()
      : null;
  const validFrom = toDateOnly(entry.validFrom ?? null);
  const validTo = toDateOnly(entry.validTo ?? null);
  const primaryFlag = parseBoolean(entry.primaryFlag);
  return {
    idType,
    idValue,
    countryCode,
    validFrom,
    validTo,
    primaryFlag
  };
}

function parseTenantIdentifierArray(raw: unknown): TenantIdInput[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    throw new Error("identities dizisi bekleniyor.");
  }
  const seen = new Set<string>();
  const items: TenantIdInput[] = [];
  for (const entry of raw) {
    const parsed = parseTenantIdentifierEntry(entry);
    const key = `${parsed.idType}__${parsed.idValue}__${parsed.validFrom?.toISOString() ?? "null"}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push(parsed);
  }
  return items;
}

function validatePostalAddress(value: unknown, field: string) {
  if (typeof value !== "string") {
    return;
  }
  if (!value.trim()) {
    return;
  }
  if (!POSTAL_CODE_REGEX.test(value)) {
    throw new Error(`${field} geçerli bir posta kodu içermelidir (örn. 1010).`);
  }
}

function selectCanonicalIdentity<T extends { idType: string; idValue: string; primaryFlag?: boolean; validFrom?: Date | null; validTo?: Date | null }>(
  items: readonly T[]
): T | null {
  if (!items.length) {
    return null;
  }
  const active = items.filter((item) => isActiveInterval(item.validFrom ?? null, item.validTo ?? null));
  const pool = active.length ? active : items;
  const flagged = pool.find((item) => item.primaryFlag);
  if (flagged) {
    return flagged;
  }
  const sorted = [...pool].sort((a, b) => {
    const priorityDiff = identityTypePriority(a.idType) - identityTypePriority(b.idType);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const aFrom = a.validFrom instanceof Date ? a.validFrom.getTime() : 0;
    const bFrom = b.validFrom instanceof Date ? b.validFrom.getTime() : 0;
    return bFrom - aFrom;
  });
  return sorted[0] ?? null;
}

function ensureTenantIdentifiers(
  inputs: TenantIdInput[],
  explicitTenantId?: string
): { tenantId: string; identifiers: TenantIdInput[] } {
  const records = inputs.map((input) => {
    const clone: TenantIdInput = {
      idType: input.idType.toUpperCase(),
      idValue: input.idValue.trim(),
      countryCode: input.countryCode,
      validFrom: input.validFrom ?? todayDateOnly(),
      validTo: input.validTo ?? null,
      primaryFlag: Boolean(input.primaryFlag)
    };
    return clone;
  });

  let canonical = selectCanonicalIdentity(records);
  const explicit = typeof explicitTenantId === "string" ? explicitTenantId.trim() : "";
  if (!canonical && explicit) {
    const matched = records.find((item) => item.idValue === explicit) ?? null;
    if (matched) {
      canonical = matched;
    } else {
      const legacy: TenantIdInput = {
        idType: "LEGACY",
        idValue: explicit,
        countryCode: null,
        validFrom: todayDateOnly(),
        validTo: null,
        primaryFlag: true
      };
      records.push(legacy);
      canonical = legacy;
    }
  }

  if (!canonical) {
    const syntheticValue = `TEN-${randomUUID()}`;
    const synthetic: TenantIdInput = {
      idType: "SYNTHETIC",
      idValue: syntheticValue,
      countryCode: null,
      validFrom: todayDateOnly(),
      validTo: null,
      primaryFlag: true
    };
    records.push(synthetic);
    canonical = synthetic;
  }

  records.forEach((entry) => {
    entry.primaryFlag = entry === canonical;
    if (!entry.validFrom) {
      entry.validFrom = todayDateOnly();
    }
  });

  return { tenantId: canonical.idValue, identifiers: records };
}

function parseDecimalInput(value: unknown, field: string): number | null {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} sayı olmalıdır`);
    }
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      throw new Error(`${field} sayı olmalıdır`);
    }
    return num;
  }
  throw new Error(`${field} sayı olmalıdır`);
}

function formatTenantIdentifier(record: TenantIdentifierRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    idType: record.idType,
    idValue: record.idValue,
    countryCode: record.countryCode,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    primaryFlag: Boolean(record.primaryFlag)
  };
}

type ShareholdingInput = {
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
  roleType: string;
  quotaPercent: number | null;
  einlageAmount: number | null;
  liability: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

type ShareholdingRecord = {
  id: string;
  tenantId: string;
  partyId: string;
  roleType: string;
  quotaPercent: number | null;
  einlageAmount: number | null;
  liability: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
};

type OfficerInput = {
  level: string;
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
  officerType: string;
  companyId?: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

type OfficerRecord = {
  id: string;
  level: string;
  tenantId: string | null;
  companyId: string | null;
  partyId: string;
  officerType: string;
  validFrom: Date | null;
  validTo: Date | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
};

type VehicleAssignmentInput = {
  vehicleId: string;
  companyId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  approvalId?: string | null;
};

type VehicleAssignmentRecord = {
  id: string;
  vehicleId: string;
  tenantId: string;
  companyId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  approvalId: string | null;
};

type DriverAssignmentInput = {
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
  companyId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  approvalId?: string | null;
};

type DriverAssignmentRecord = {
  id: string;
  partyId: string;
  tenantId: string;
  companyId: string;
  assignedFrom: Date;
  assignedTo: Date | null;
  approvalId: string | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
};

type ApprovalInput = {
  scope: string;
  objectId?: string | null;
  op: string;
  payload?: unknown;
  idempotencyKey?: string | null;
};

type ApprovalRecord = {
  id: string;
  tenantId: string;
  scope: string;
  objectId: string | null;
  op: string;
  payload: string | null;
  status: string;
  idempotencyKey: string | null;
  createdAt: Date;
};

type AttachmentInput = {
  ownerType: "TENANT" | "COMPANY" | "COMPANY_PERMIT";
  ownerId: string;
  attachmentType: string;
  fileRef: string;
  issuedAt: Date | null;
  sourceUrl: string | null;
};

type AttachmentRecord = {
  id: string;
  ownerType: string;
  ownerId: string;
  attachmentType: string;
  fileRef: string;
  issuedAt: Date | null;
  sourceUrl: string | null;
  createdAt: Date;
};

function parseShareholdingPayload(raw: unknown): ShareholdingInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Pay sahipliği verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const partyId =
    typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : undefined;
  let party: ShareholdingInput["party"] | undefined;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni ortak için party bilgisi gerekli.");
    }
    const typeValue = typeof (partyRaw as any).type === "string" ? (partyRaw as any).type.trim() : "";
    const displayNameValue =
      typeof (partyRaw as any).displayName === "string" ? (partyRaw as any).displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Geçersiz party.type: ${typeValue}`);
    }
    party = { type: typeValue, displayName: displayNameValue };
  }
  const roleTypeRaw = typeof entry.roleType === "string" ? entry.roleType.trim() : "";
  if (!roleTypeRaw) {
    throw new Error("roleType zorunlu");
  }
  if (!SHAREHOLDING_ROLE_TYPES.has(roleTypeRaw)) {
    throw new Error(`Geçersiz roleType: ${roleTypeRaw}`);
  }
  const liabilityRaw = typeof entry.liability === "string" ? entry.liability.trim() : "";
  if (liabilityRaw && !LIABILITY_TYPES.has(liabilityRaw)) {
    throw new Error(`Geçersiz liability: ${liabilityRaw}`);
  }
  return {
    partyId,
    party,
    roleType: roleTypeRaw,
    quotaPercent: parseDecimalInput(entry.quotaPercent, "quotaPercent"),
    einlageAmount: parseDecimalInput(entry.einlageAmount, "einlageAmount"),
    liability: liabilityRaw || null,
    validFrom: toDateOnly(entry.validFrom ?? null),
    validTo: toDateOnly(entry.validTo ?? null)
  };
}

function parseOfficerPayload(raw: unknown): OfficerInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Yetkili (officer) verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const level = typeof entry.level === "string" ? entry.level.trim().toUpperCase() : "";
  if (!level) {
    throw new Error("level zorunlu");
  }
  if (level !== "TENANT" && level !== "COMPANY") {
    throw new Error(`Geçersiz level: ${level}`);
  }
  const officerType = typeof entry.officerType === "string" ? entry.officerType.trim() : "";
  if (!officerType) {
    throw new Error("officerType zorunlu");
  }

  const partyId = typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : undefined;
  let party: OfficerInput["party"] | undefined;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni officer için party bilgisi gerekli.");
    }
    const typeValue = typeof (partyRaw as any).type === "string" ? (partyRaw as any).type.trim() : "";
    const displayNameValue = typeof (partyRaw as any).displayName === "string" ? (partyRaw as any).displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Geçersiz party.type: ${typeValue}`);
    }
    if (typeValue !== "NatürlichePerson") {
      throw new Error("Şoför ataması için party.type 'NatürlichePerson' olmalıdır.");
    }
    party = { type: typeValue, displayName: displayNameValue };
  }

  const companyId = typeof entry.companyId === "string" && entry.companyId.trim().length ? entry.companyId.trim() : undefined;
  if (level === "COMPANY" && !companyId) {
    throw new Error("companyId zorunlu (COMPANY level)");
  }
  return {
    level,
    partyId,
    party,
    officerType,
    companyId: companyId ?? null,
    validFrom: toDateOnly(entry.validFrom ?? null),
    validTo: toDateOnly(entry.validTo ?? null)
  };
}

function parseVehicleAssignmentPayload(raw: unknown): VehicleAssignmentInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Araç ataması verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const vehicleId = typeof entry.vehicleId === "string" ? entry.vehicleId.trim() : "";
  const companyId = typeof entry.companyId === "string" ? entry.companyId.trim() : "";
  if (!vehicleId) {
    throw new Error("vehicleId zorunlu");
  }
  if (!companyId) {
    throw new Error("companyId zorunlu");
  }
  const assignedFrom = toDateOnly(entry.assignedFrom) ?? null;
  if (!assignedFrom) {
    throw new Error("assignedFrom zorunlu");
  }
  return {
    vehicleId,
    companyId,
    assignedFrom,
    assignedTo: toDateOnly(entry.assignedTo ?? null),
    approvalId: typeof entry.approvalId === "string" && entry.approvalId.trim().length ? entry.approvalId.trim() : null
  };
}

function parseDriverAssignmentPayload(raw: unknown): DriverAssignmentInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Şoför ataması verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const companyId = typeof entry.companyId === "string" ? entry.companyId.trim() : "";
  if (!companyId) {
    throw new Error("companyId zorunlu");
  }
  const assignedFrom = toDateOnly(entry.assignedFrom) ?? null;
  if (!assignedFrom) {
    throw new Error("assignedFrom zorunlu");
  }
  const partyId = typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : undefined;
  let party: DriverAssignmentInput["party"] | undefined;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni driver için party bilgisi gerekli.");
    }
    const typeValue = typeof (partyRaw as any).type === "string" ? (partyRaw as any).type.trim() : "";
    const displayNameValue = typeof (partyRaw as any).displayName === "string" ? (partyRaw as any).displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Geçersiz party.type: ${typeValue}`);
    }
    party = { type: typeValue, displayName: displayNameValue };
  }
  return {
    partyId,
    party,
    companyId,
    assignedFrom,
    assignedTo: toDateOnly(entry.assignedTo ?? null),
    approvalId: typeof entry.approvalId === "string" && entry.approvalId.trim().length ? entry.approvalId.trim() : null
  };
}

function parseApprovalPayload(raw: unknown): ApprovalInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Onay verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const scope = typeof entry.scope === "string" ? entry.scope.trim().toUpperCase() : "";
  if (!scope) {
    throw new Error("scope zorunlu");
  }
  if (scope !== "TENANT" && scope !== "COMPANY") {
    throw new Error(`Geçersiz scope: ${scope}`);
  }
  const op = typeof entry.op === "string" ? entry.op.trim() : "";
  if (!op) {
    throw new Error("op zorunlu");
  }
  const payload = entry.payload ?? null;
  const idempotencyKey = typeof entry.idempotencyKey === "string" && entry.idempotencyKey.trim().length ? entry.idempotencyKey.trim() : null;
  return {
    scope,
    objectId: typeof entry.objectId === "string" && entry.objectId.trim().length ? entry.objectId.trim() : null,
    op,
    payload,
    idempotencyKey
  };
}

function parseAttachmentPayload(raw: unknown): AttachmentInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Ek (attachment) verisi hatalı.");
  }
  const entry = raw as Record<string, unknown>;
  const ownerType = typeof entry.ownerType === "string" ? entry.ownerType.trim().toUpperCase() : "";
  if (!ownerType || (ownerType !== "TENANT" && ownerType !== "COMPANY" && ownerType !== "COMPANY_PERMIT")) {
    throw new Error("ownerType geçersiz");
  }
  const ownerId = typeof entry.ownerId === "string" ? entry.ownerId.trim() : "";
  if (!ownerId) {
    throw new Error("ownerId zorunlu");
  }
  const attachmentType = typeof entry.attachmentType === "string" ? entry.attachmentType.trim() : "";
  if (!attachmentType) {
    throw new Error("attachmentType zorunlu");
  }
  const fileRef = typeof entry.fileRef === "string" ? entry.fileRef.trim() : "";
  if (!fileRef) {
    throw new Error("fileRef zorunlu");
  }
  const issuedAt = toDateOnly(entry.issuedAt ?? null);
  const sourceUrl = typeof entry.sourceUrl === "string" && entry.sourceUrl.trim().length ? entry.sourceUrl.trim() : null;
  return {
    ownerType: ownerType as AttachmentInput['ownerType'],
    ownerId,
    attachmentType,
    fileRef,
    issuedAt,
    sourceUrl
  };
}

function formatShareholding(record: ShareholdingRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    partyId: record.partyId,
    roleType: record.roleType,
    quotaPercent: record.quotaPercent !== null && record.quotaPercent !== undefined ? record.quotaPercent.toString() : null,
    einlageAmount: record.einlageAmount !== null && record.einlageAmount !== undefined ? record.einlageAmount.toString() : null,
    liability: record.liability,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    party: record.party
      ? {
          partyId: record.party.partyId,
          type: record.party.type,
          displayName: record.party.displayName
        }
      : null
  };
}

function formatOfficer(record: OfficerRecord) {
  return {
    id: record.id,
    level: record.level,
    tenantId: record.tenantId,
    companyId: record.companyId,
    partyId: record.partyId,
    officerType: record.officerType,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    party: record.party
      ? {
          partyId: record.party.partyId,
          type: record.party.type,
          displayName: record.party.displayName
        }
      : null
  };
}

function formatVehicleAssignment(record: VehicleAssignmentRecord) {
  return {
    id: record.id,
    vehicleId: record.vehicleId,
    tenantId: record.tenantId,
    companyId: record.companyId,
    assignedFrom: record.assignedFrom.toISOString(),
    assignedTo: record.assignedTo ? record.assignedTo.toISOString() : null,
    approvalId: record.approvalId ?? null
  };
}

function formatDriverAssignment(record: DriverAssignmentRecord) {
  return {
    id: record.id,
    partyId: record.partyId,
    tenantId: record.tenantId,
    companyId: record.companyId,
    assignedFrom: record.assignedFrom.toISOString(),
    assignedTo: record.assignedTo ? record.assignedTo.toISOString() : null,
    approvalId: record.approvalId ?? null,
    party: record.party
      ? {
          partyId: record.party.partyId,
          type: record.party.type,
          displayName: record.party.displayName
        }
      : null
  };
}

function formatApproval(record: ApprovalRecord) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    scope: record.scope,
    objectId: record.objectId,
    op: record.op,
    payload: record.payload ? JSON.parse(record.payload) : null,
    status: record.status,
    idempotencyKey: record.idempotencyKey,
    createdAt: record.createdAt.toISOString()
  };
}

function formatAttachment(record: AttachmentRecord) {
  return {
    id: record.id,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    attachmentType: record.attachmentType,
    fileRef: record.fileRef,
    issuedAt: record.issuedAt ? record.issuedAt.toISOString() : null,
    sourceUrl: record.sourceUrl,
    createdAt: record.createdAt.toISOString()
  };
}

async function recalcTenantIdentifiers(tx: Prisma.TransactionClient, tenantId: string) {
  const existing = await tx.tenantIdentifier.findMany({
    where: { tenantId },
    orderBy: [{ validFrom: "desc" }, { idType: "asc" }]
  });
  if (!existing.length) {
    const syntheticValue = `TEN-${randomUUID()}`;
    const created = await tx.tenantIdentifier.create({
      data: {
        tenantId,
        idType: "SYNTHETIC",
        idValue: syntheticValue,
        primaryFlag: true,
        countryCode: null,
        validFrom: todayDateOnly(),
        validTo: null
      }
    });
    return formatTenantIdentifier(created);
  }
  const canonical = selectCanonicalIdentity(existing);
  if (!canonical) {
    const [first] = existing;
    await tx.tenantIdentifier.update({
      where: { id: first.id },
      data: { primaryFlag: true }
    });
    return formatTenantIdentifier({ ...first, primaryFlag: true });
  }
  await Promise.all(
    existing.map((record) =>
      tx.tenantIdentifier.update({
        where: { id: record.id },
        data: { primaryFlag: record.id === canonical.id }
      })
    )
  );
  return formatTenantIdentifier({ ...canonical, primaryFlag: true });
}

tenantsRouter.get(
  "/",
  permissionGuard(["tp.tenant.read"]),
  async (req, res) => {
    const q = firstQueryValue(req.query?.q) ?? "";
    const statusFilter = firstQueryValue(req.query?.status)?.trim();
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });

    const sortFieldMap: Record<string, keyof Prisma.TenantOrderByWithRelationInput> = {
      name: "legalName",
      tenantid: "tenantId",
      status: "status",
      created: "createdAt",
      createdat: "createdAt"
    };

    const sortKey = sortFieldMap[sortRaw ?? ""] ? sortRaw ?? "" : "created";
    const sortField = sortFieldMap[sortKey] ?? "createdAt";
    const order: Prisma.SortOrder = orderRaw === "asc" ? "asc" : "desc";
    const orderBy = { [sortField]: order } as Prisma.TenantOrderByWithRelationInput;

    const where: Prisma.TenantWhereInput = q
      ? {
          OR: [
            { tenantId: { contains: q, mode: "insensitive" } },
            { legalName: { contains: q, mode: "insensitive" } }
          ]
        }
      : {};

    if (statusFilter && statusFilter.toLowerCase() !== "all") {
      where.status = statusFilter;
    }

    const [total, rows] = await prisma.$transaction([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: [orderBy, { tenantId: "asc" }],
        skip: page * pageSize,
        take: pageSize,
        include: {
          identityHistory: {
            where: { currentFlag: true },
            orderBy: { validFrom: "desc" },
            take: 1
          },
          identifiers: {
            where: { primaryFlag: true },
            orderBy: { validFrom: "desc" },
            take: 1
          }
        }
      })
    ]);

    const items = rows.map(({ identityHistory, identifiers, ...rest }) => ({
      ...rest,
      currentIdentity: identityHistory[0] ?? null,
      primaryIdentifier: identifiers[0] ? formatTenantIdentifier(identifiers[0]) : null
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey || "created",
      order
    });
  }
);

tenantsRouter.get(
  "/:id/companies",
  permissionGuard(["tp.company.read"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      respondError(res, 400, "TENANT_ID_REQUIRED");
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });

    const sortFieldMap: Record<string, keyof Prisma.CompanyOrderByWithRelationInput> = {
      name: "legalName",
      status: "status",
      companyid: "companyId"
    };

    const sortKey = sortFieldMap[sortRaw ?? ""] ? (sortRaw as keyof typeof sortFieldMap) : "name";
    const sortField = sortFieldMap[sortKey] ?? "legalName";
    const order: Prisma.SortOrder = orderRaw === "desc" ? "desc" : "asc";

    const where: Prisma.CompanyWhereInput = {
      tenantId,
      OR: search
        ? [
            { legalName: { contains: search } },
            { companyId: { contains: search } },
            { address: { contains: search } }
          ]
        : undefined
    };

    const [total, records] = await prisma.$transaction([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy: [{ [sortField]: order }, { companyId: "asc" }],
        skip: page * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              officers: true,
              shareholders: true,
              permits: true,
              vehicleAssignments: true,
              driverAssignments: true
            }
          }
        }
      })
    ]);

    const items = records.map((company) => ({
      companyId: company.companyId,
      legalName: company.legalName,
      address: company.address,
      status: company.status,
      validTo: company.validTo ? company.validTo.toISOString() : null,
      permitCount: company._count.permits,
      officerCount: company._count.officers,
      shareholdingCount: company._count.shareholders,
      vehicleAssignmentCount: company._count.vehicleAssignments,
      driverAssignmentCount: company._count.driverAssignments
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey,
      order
    });
  }
);

tenantsRouter.get(
  "/:id/ous",
  permissionGuard(["tp.ou.read"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      respondError(res, 400, "TENANT_ID_REQUIRED");
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 50, { min: 1, max: 200 });

    const sortFieldMap: Record<string, keyof Prisma.OUOrderByWithRelationInput> = {
      name: "name",
      created: "id",
      updated: "id"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? (sortRaw as keyof typeof sortFieldMap) : "name";
    const order: Prisma.SortOrder = orderRaw === "desc" ? "desc" : "asc";

    const where: Prisma.OUWhereInput = {
      tenantId,
      OR: search
        ? [{ name: { contains: search, mode: "insensitive" } }]
        : undefined
    };

    const orderBy: Prisma.OUOrderByWithRelationInput[] = [];
    if (sortKey === "name") {
      orderBy.push({ name: order });
    } else if (sortKey === "updated") {
      orderBy.push({ id: order });
    } else {
      orderBy.push({ id: order });
    }
    orderBy.push({ name: "asc" });

    const [total, records] = await prisma.$transaction([
      prisma.oU.count({ where }),
      prisma.oU.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { children: true }
          }
        }
      })
    ]);

    const items = records.map((record) => ({
      id: record.id,
      name: record.name,
      parentId: record.parentId,
      childCount: record._count.children
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey,
      order
    });
  }
);

tenantsRouter.post(
  "/:id/ous",
  permissionGuard(["tp.ou.create"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      respondError(res, 400, "TENANT_ID_REQUIRED");
      return;
    }
    const { name, parentId } = req.body || {};
    if (!name || typeof name !== "string" || !name.trim()) {
      respondError(res, 400, "OU_NAME_REQUIRED");
      return;
    }
    if (parentId) {
      const parent = await prisma.oU.findUnique({ where: { id: parentId } });
      if (!parent || parent.tenantId !== tenantId) {
        respondError(res, 400, "OU_PARENT_INVALID");
        return;
      }
    }
    try {
      const ou = await prisma.oU.create({
        data: {
          tenantId,
          name: name.trim(),
          parentId: parentId ?? null
        }
      });
      res.status(201).json({ ok: true, ou });
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.get(
  "/:tenantId/ous/:ouId",
  permissionGuard(["tp.ou.read"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const ouId = req.params.ouId?.trim();
    if (!tenantId || !ouId) {
      respondError(res, 400, "TENANT_ID_REQUIRED", "tenantId ve ouId zorunlu");
      return;
    }
    const ou = await prisma.oU.findFirst({
      where: { id: ouId, tenantId },
      include: {
        children: {
          select: { id: true, name: true }
        }
      }
    });
    if (!ou) {
      respondError(res, 404, "OU_NOT_FOUND");
      return;
    }
    res.json({
      ok: true,
      ou
    });
  }
);

tenantsRouter.put(
  "/:tenantId/ous/:ouId",
  permissionGuard(["tp.ou.create"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const ouId = req.params.ouId?.trim();
    if (!tenantId || !ouId) {
      res.status(400).json({ ok: false, error: "tenantId ve ouId zorunlu" });
      return;
    }
    const existing = await prisma.oU.findFirst({ where: { id: ouId, tenantId } });
    if (!existing) {
      respondError(res, 404, "OU_NOT_FOUND");
      return;
    }

    const { name, parentId } = req.body || {};

    if (parentId) {
      if (parentId === ouId) {
        res.status(400).json({ ok: false, error: "parentId kendi id olamaz" });
        return;
      }
      const parent = await prisma.oU.findUnique({ where: { id: parentId } });
      if (!parent || parent.tenantId !== tenantId) {
        respondError(res, 400, "OU_PARENT_INVALID");
        return;
      }
    }

    const payload: Prisma.OUUpdateInput = {};
    if (typeof name === "string") {
      payload.name = name.trim();
    }
    if (typeof parentId !== "undefined") {
      payload.parentId = parentId || null;
    }

    try {
      const ou = await prisma.oU.update({
        where: { id: ouId },
        data: payload
      });
      res.json({ ok: true, ou });
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.delete(
  "/:tenantId/ous/:ouId",
  permissionGuard(["tp.ou.create"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const ouId = req.params.ouId?.trim();
    if (!tenantId || !ouId) {
      res.status(400).json({ ok: false, error: "tenantId ve ouId zorunlu" });
      return;
    }
    const existing = await prisma.oU.findFirst({
      where: { id: ouId, tenantId },
      include: {
        _count: { select: { children: true } }
      }
    });
    if (!existing) {
      respondError(res, 404, "OU_NOT_FOUND");
      return;
    }
    if (existing._count.children > 0) {
      respondError(res, 400, "OU_DELETE_HAS_CHILDREN");
      return;
    }
    await prisma.oU.delete({ where: { id: ouId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/organizations",
  permissionGuard(["tp.organization.read"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const statusFilter = firstQueryValue(req.query?.status)?.trim();
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });

    const sortFieldMap: Record<string, keyof Prisma.OrganizationOrderByWithRelationInput> = {
      name: "name",
      status: "status",
      updated: "updatedAt"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? (sortRaw as keyof typeof sortFieldMap) : "updated";
    const sortField = sortFieldMap[sortKey] ?? "updatedAt";
    const order: Prisma.SortOrder = orderRaw === "asc" ? "asc" : "desc";

    const where: Prisma.OrganizationWhereInput = {
      tenantId,
      status:
        statusFilter && statusFilter.toLowerCase() !== "all" ? statusFilter : undefined,
      OR: search
        ? [
            { name: { contains: search } },
            { description: { contains: search } },
            { orgType: { contains: search } }
          ]
        : undefined
    };

    const orderBy: Prisma.OrganizationOrderByWithRelationInput[] = [];
    if (sortField === "name") {
      orderBy.push({ name: order });
    } else if (sortField === "status") {
      orderBy.push({ status: order });
    } else {
      orderBy.push({ updatedAt: order });
    }
    orderBy.push({ name: "asc" });

    const [total, records] = await prisma.$transaction([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { mandates: true }
          }
        }
      })
    ]);

    const items = records.map((record) => ({
      id: record.id,
      name: record.name,
      orgType: record.orgType,
      status: record.status,
      parentId: record.parentId,
      companyId: record.companyId,
      validFrom: record.validFrom ? record.validFrom.toISOString() : null,
      validTo: record.validTo ? record.validTo.toISOString() : null,
      updatedAt: record.updatedAt.toISOString(),
      mandates: record._count.mandates
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey,
      order
    });
  }
);

tenantsRouter.post(
  "/:id/organizations",
  permissionGuard(["tp.organization.manage"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const {
      name,
      orgType,
      status,
      description,
      parentId,
      companyId,
      validFrom,
      validTo,
      metaJson
    } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      respondError(res, 400, "ORG_NAME_REQUIRED");
      return;
    }

    if (parentId) {
      const parent = await prisma.organization.findUnique({ where: { id: parentId } });
      if (!parent || parent.tenantId !== tenantId) {
        respondError(res, 400, "ORG_PARENT_INVALID");
        return;
      }
    }

    const parsedValidFrom = toDateOnly(validFrom);
    const parsedValidTo = toDateOnly(validTo);

    try {
      const organization = await prisma.organization.create({
        data: {
          tenantId,
          name: name.trim(),
          orgType: typeof orgType === "string" && orgType.trim() ? orgType.trim() : null,
          status: typeof status === "string" && status.trim() ? status.trim() : "Active",
          description:
            typeof description === "string" && description.trim() ? description.trim() : null,
          parentId: parentId ?? null,
          companyId: typeof companyId === "string" && companyId.trim() ? companyId.trim() : null,
          validFrom: parsedValidFrom,
          validTo: parsedValidTo,
          metaJson:
            typeof metaJson === "string"
              ? metaJson.trim() || null
              : metaJson
              ? JSON.stringify(metaJson)
              : null
        }
      });
      res.status(201).json({ ok: true, organization });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.get(
  "/:tenantId/organizations/:orgId",
  permissionGuard(["tp.organization.read"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const orgId = req.params.orgId?.trim();
    if (!tenantId || !orgId) {
      res.status(400).json({ ok: false, error: "tenantId ve orgId zorunlu" });
      return;
    }
    const organization = await prisma.organization.findFirst({
      where: { id: orgId, tenantId },
      include: {
        mandates: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            status: true,
            validFrom: true,
            validTo: true
          }
        }
      }
    });
    if (!organization) {
      res.status(404).json({ ok: false, error: "organization bulunamadı" });
      return;
    }
    res.json({
      ok: true,
      organization: {
        ...organization,
        validFrom: organization.validFrom ? organization.validFrom.toISOString() : null,
        validTo: organization.validTo ? organization.validTo.toISOString() : null,
        updatedAt: organization.updatedAt.toISOString(),
        createdAt: organization.createdAt.toISOString(),
        mandates: organization.mandates.map((mandate) => ({
          ...mandate,
          validFrom: mandate.validFrom ? mandate.validFrom.toISOString() : null,
          validTo: mandate.validTo ? mandate.validTo.toISOString() : null
        }))
      }
    });
  }
);

tenantsRouter.put(
  "/:tenantId/organizations/:orgId",
  permissionGuard(["tp.organization.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const orgId = req.params.orgId?.trim();
    if (!tenantId || !orgId) {
      res.status(400).json({ ok: false, error: "tenantId ve orgId zorunlu" });
      return;
    }
    const existing = await prisma.organization.findFirst({ where: { id: orgId, tenantId } });
    if (!existing) {
      res.status(404).json({ ok: false, error: "organization bulunamadı" });
      return;
    }
    const {
      name,
      orgType,
      status,
      description,
      parentId,
      companyId,
      validFrom,
      validTo,
      metaJson
    } = req.body || {};

    if (parentId) {
      const parent = await prisma.organization.findUnique({ where: { id: parentId } });
      if (!parent || parent.tenantId !== tenantId || parent.id === orgId) {
        res.status(400).json({ ok: false, error: "parentId geçersiz" });
        return;
      }
    }

    const payload: Prisma.OrganizationUpdateInput = {};
    if (typeof name === "string") {
      payload.name = name.trim();
    }
    if (typeof orgType === "string") {
      payload.orgType = orgType.trim() || null;
    }
    if (typeof status === "string") {
      payload.status = status.trim() || existing.status;
    }
    if (typeof description === "string") {
      payload.description = description.trim() || null;
    }
    if (typeof parentId !== "undefined") {
      payload.parentId = parentId || null;
    }
    if (typeof companyId === "string") {
      payload.companyId = companyId.trim() || null;
    } else if (companyId === null) {
      payload.companyId = null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      payload.validFrom = toDateOnly(validFrom);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validTo")) {
      payload.validTo = toDateOnly(validTo);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "metaJson")) {
      if (typeof metaJson === "string") {
        payload.metaJson = metaJson.trim() || null;
      } else if (metaJson) {
        payload.metaJson = JSON.stringify(metaJson);
      } else {
        payload.metaJson = null;
      }
    }

    try {
      const organization = await prisma.organization.update({
        where: { id: orgId },
        data: payload
      });
      res.json({ ok: true, organization });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.delete(
  "/:tenantId/organizations/:orgId",
  permissionGuard(["tp.organization.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const orgId = req.params.orgId?.trim();
    if (!tenantId || !orgId) {
      res.status(400).json({ ok: false, error: "tenantId ve orgId zorunlu" });
      return;
    }
    const existing = await prisma.organization.findFirst({
      where: { id: orgId, tenantId },
      include: {
        _count: { select: { children: true, mandates: true } }
      }
    });
    if (!existing) {
      res.status(404).json({ ok: false, error: "organization bulunamadı" });
      return;
    }
    if (existing._count.children > 0) {
      res.status(400).json({ ok: false, error: "Alt organizasyonlar varken silinemez" });
      return;
    }
    if (existing._count.mandates > 0) {
      res
        .status(400)
        .json({ ok: false, error: "Bağlı mandatelar varken organizasyon silinemez" });
      return;
    }
    await prisma.organization.delete({ where: { id: orgId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/mandates",
  permissionGuard(["tp.mandate.read"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const statusFilter = firstQueryValue(req.query?.status)?.trim();
    const orgFilter = firstQueryValue(req.query?.organizationId)?.trim();
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });

    const sortFieldMap: Record<string, keyof Prisma.MandateOrderByWithRelationInput> = {
      title: "title",
      status: "status",
      validfrom: "validFrom",
      validto: "validTo",
      updated: "updatedAt"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? (sortRaw as keyof typeof sortFieldMap) : "updated";
    const sortField = sortFieldMap[sortKey] ?? "updatedAt";
    const order: Prisma.SortOrder = orderRaw === "asc" ? "asc" : "desc";

    const where: Prisma.MandateWhereInput = {
      tenantId,
      status:
        statusFilter && statusFilter.toLowerCase() !== "all" ? statusFilter : undefined,
      organizationId: orgFilter || undefined,
      OR: search
        ? [
            { title: { contains: search } },
            { mandateType: { contains: search } },
            { notes: { contains: search } }
          ]
        : undefined
    };

    const orderBy: Prisma.MandateOrderByWithRelationInput[] = [];
    if (sortField === "title") {
      orderBy.push({ title: order });
    } else if (sortField === "status") {
      orderBy.push({ status: order });
    } else if (sortField === "validFrom") {
      orderBy.push({ validFrom: order });
    } else if (sortField === "validTo") {
      orderBy.push({ validTo: order });
    } else {
      orderBy.push({ updatedAt: order });
    }
    orderBy.push({ title: "asc" });

    const [total, records] = await prisma.$transaction([
      prisma.mandate.count({ where }),
      prisma.mandate.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
        include: {
          organization: {
            select: { id: true, name: true }
          }
        }
      })
    ]);

    const items = records.map((record) => ({
      id: record.id,
      title: record.title,
      mandateType: record.mandateType,
      status: record.status,
      validFrom: record.validFrom ? record.validFrom.toISOString() : null,
      validTo: record.validTo ? record.validTo.toISOString() : null,
      organization: record.organization,
      companyId: record.companyId,
      updatedAt: record.updatedAt.toISOString()
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey,
      order
    });
  }
);

tenantsRouter.post(
  "/:id/mandates",
  permissionGuard(["tp.mandate.manage"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const {
      title,
      mandateType,
      status,
      organizationId,
      companyId,
      validFrom,
      validTo,
      notes,
      metaJson
    } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      respondError(res, 400, "MANDATE_TITLE_REQUIRED");
      return;
    }
    if (!mandateType || typeof mandateType !== "string" || !mandateType.trim()) {
      respondError(res, 400, "MANDATE_TYPE_REQUIRED");
      return;
    }

    if (organizationId) {
      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization || organization.tenantId !== tenantId) {
        respondError(res, 400, "MANDATE_ORG_INVALID");
        return;
      }
    }

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { companyId } });
      if (!company || company.tenantId !== tenantId) {
        respondError(res, 400, "MANDATE_COMPANY_INVALID");
        return;
      }
    }

    const parsedValidFrom = toDateOnly(validFrom);
    const parsedValidTo = toDateOnly(validTo);

    try {
      const mandate = await prisma.mandate.create({
        data: {
          tenantId,
          organizationId: organizationId || null,
          companyId: typeof companyId === "string" && companyId.trim() ? companyId.trim() : null,
          title: title.trim(),
          mandateType: mandateType.trim(),
          status: typeof status === "string" && status.trim() ? status.trim() : "Draft",
          validFrom: parsedValidFrom,
          validTo: parsedValidTo,
          notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
          metaJson:
            typeof metaJson === "string"
              ? metaJson.trim() || null
              : metaJson
              ? JSON.stringify(metaJson)
              : null
        }
      });
      res.status(201).json({ ok: true, mandate });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.get(
  "/:tenantId/mandates/:mandateId",
  permissionGuard(["tp.mandate.read"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const mandateId = req.params.mandateId?.trim();
    if (!tenantId || !mandateId) {
      res.status(400).json({ ok: false, error: "tenantId ve mandateId zorunlu" });
      return;
    }
    const mandate = await prisma.mandate.findFirst({
      where: { id: mandateId, tenantId },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      }
    });
    if (!mandate) {
      respondError(res, 404, "MANDATE_NOT_FOUND");
      return;
    }
    res.json({
      ok: true,
      mandate: {
        ...mandate,
        validFrom: mandate.validFrom ? mandate.validFrom.toISOString() : null,
        validTo: mandate.validTo ? mandate.validTo.toISOString() : null,
        createdAt: mandate.createdAt.toISOString(),
        updatedAt: mandate.updatedAt.toISOString()
      }
    });
  }
);

tenantsRouter.put(
  "/:tenantId/mandates/:mandateId",
  permissionGuard(["tp.mandate.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const mandateId = req.params.mandateId?.trim();
    if (!tenantId || !mandateId) {
      res.status(400).json({ ok: false, error: "tenantId ve mandateId zorunlu" });
      return;
    }
    const existing = await prisma.mandate.findFirst({
      where: { id: mandateId, tenantId }
    });
    if (!existing) {
      respondError(res, 404, "MANDATE_NOT_FOUND");
      return;
    }

    const {
      title,
      mandateType,
      status,
      organizationId,
      companyId,
      validFrom,
      validTo,
      notes,
      metaJson
    } = req.body || {};

    if (organizationId) {
      const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!organization || organization.tenantId !== tenantId) {
        respondError(res, 400, "MANDATE_ORG_INVALID");
        return;
      }
    } else if (organizationId === null) {
      // allow clearing relation
    }

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { companyId } });
      if (!company || company.tenantId !== tenantId) {
        respondError(res, 400, "MANDATE_COMPANY_INVALID");
        return;
      }
    }

    const payload: Prisma.MandateUpdateInput = {};
    if (typeof title === "string") {
      payload.title = title.trim();
    }
    if (typeof mandateType === "string") {
      payload.mandateType = mandateType.trim();
    }
    if (typeof status === "string") {
      payload.status = status.trim() || existing.status;
    }
    if (typeof notes === "string") {
      payload.notes = notes.trim() || null;
    }
    if (typeof organizationId !== "undefined") {
      payload.organizationId = organizationId || null;
    }
    if (typeof companyId !== "undefined") {
      payload.companyId =
        typeof companyId === "string" && companyId.trim() ? companyId.trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      payload.validFrom = toDateOnly(validFrom);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validTo")) {
      payload.validTo = toDateOnly(validTo);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "metaJson")) {
      if (typeof metaJson === "string") {
        payload.metaJson = metaJson.trim() || null;
      } else if (metaJson) {
        payload.metaJson = JSON.stringify(metaJson);
      } else {
        payload.metaJson = null;
      }
    }

    try {
      const mandate = await prisma.mandate.update({
        where: { id: mandateId },
        data: payload
      });
      res.json({ ok: true, mandate });
    } catch (error) {
      res.status(500).json({ ok: false, error: (error as Error).message });
    }
  }
);

tenantsRouter.delete(
  "/:tenantId/mandates/:mandateId",
  permissionGuard(["tp.mandate.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const mandateId = req.params.mandateId?.trim();
    if (!tenantId || !mandateId) {
      res.status(400).json({ ok: false, error: "tenantId ve mandateId zorunlu" });
      return;
    }
    const existing = await prisma.mandate.findFirst({
      where: { id: mandateId, tenantId }
    });
    if (!existing) {
      respondError(res, 404, "MANDATE_NOT_FOUND");
      return;
    }
    await prisma.mandate.delete({ where: { id: mandateId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/vehicles",
  permissionGuard(["vehicle.manage"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const companyFilter = firstQueryValue(req.query?.companyId)?.trim();
    const statusFilter = firstQueryValue(req.query?.status)?.trim();
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });

    const sortFieldMap: Record<string, keyof Prisma.VehicleOrderByWithRelationInput> = {
      vin: "vin",
      status: "status",
      usage: "usage",
      updated: "updatedAt"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? (sortRaw as keyof typeof sortFieldMap) : "updated";
    const sortField = sortFieldMap[sortKey] ?? "updatedAt";
    const order: Prisma.SortOrder = orderRaw === "asc" ? "asc" : "desc";

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      companyId: companyFilter || undefined,
      status:
        statusFilter && statusFilter.toLowerCase() !== "all" ? statusFilter : undefined,
      OR: search
        ? [
            { vin: { contains: search, mode: "insensitive" } },
            { plateNo: { contains: search, mode: "insensitive" } }
          ]
        : undefined
    };

    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [];
    if (sortField === "vin") {
      orderBy.push({ vin: order });
    } else if (sortField === "status") {
      orderBy.push({ status: order });
    } else if (sortField === "usage") {
      orderBy.push({ usage: order });
    } else {
      orderBy.push({ updatedAt: order });
    }
    orderBy.push({ vin: "asc" });

    const [total, records] = await prisma.$transaction([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
        include: {
          company: {
            select: {
              companyId: true,
              legalName: true
            }
          }
        }
      })
    ]);

    const items = records.map((vehicle) => ({
      vehicleId: vehicle.vehicleId,
      tenantId: vehicle.tenantId,
      companyId: vehicle.companyId,
      companyName: vehicle.company?.legalName ?? null,
      vin: vehicle.vin,
      plateNo: vehicle.plateNo,
      seatCount: vehicle.seatCount,
      usage: vehicle.usage,
      status: vehicle.status,
      validTo: vehicle.validTo ? vehicle.validTo.toISOString() : null,
      updatedAt: vehicle.updatedAt.toISOString()
    }));

    res.json({
      ok: true,
      items,
      total,
      page,
      pageSize,
      sort: sortKey,
      order
    });
  }
);

tenantsRouter.post(
  "/:id/vehicles",
  permissionGuard(["vehicle.manage"]),
  async (req, res) => {
    const tenantId = req.params.id?.trim();
    if (!tenantId) {
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const { companyId, vin, plateNo, seatCount, usage, status } = req.body || {};
    if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
      res.status(400).json({ ok: false, error: "companyId zorunlu" });
      return;
    }
    if (!vin || typeof vin !== "string" || !vin.trim()) {
      res.status(400).json({ ok: false, error: "vin zorunlu" });
      return;
    }

    const company = await ensureVehicleCompany(companyId.trim(), tenantId);
    if (!company) {
      res.status(404).json({ ok: false, error: "Şirket bulunamadı" });
      return;
    }

    let seatCountValue: number | null = null;
    try {
      seatCountValue = parseVehicleSeatCount(seatCount);
    } catch (error) {
      res.status(400).json({ ok: false, error: (error as Error).message });
      return;
    }
    const normalizedUsage = normalizeVehicleUsage(usage);
    if (usage && !normalizedUsage) {
      res.status(400).json({ ok: false, error: "Geçersiz usage" });
      return;
    }
    const normalizedStatus = normalizeVehicleStatus(status);
    const statusDate = dateOnly();
    const validToValue = computeValidTo(normalizedStatus, statusDate);

    try {
      const vehicle = await prisma.$transaction(async (tx) => {
        const created = await tx.vehicle.create({
          data: {
            tenantId,
            companyId: company.companyId,
            vin: vin.trim(),
            plateNo: typeof plateNo === "string" && plateNo.trim() ? plateNo.trim() : null,
            seatCount: seatCountValue,
            usage: normalizedUsage,
            status: normalizedStatus,
            validTo: validToValue
          }
        });
        await recordStatusEvent(tx, {
          tenantId,
          entityType: "VEHICLE",
          entityId: created.vehicleId,
          status: normalizedStatus,
          validTo: validToValue ?? null
        });
        return created;
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

tenantsRouter.get(
  "/:tenantId/vehicles/:vehicleId",
  permissionGuard(["vehicle.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const vehicleId = req.params.vehicleId?.trim();
    if (!tenantId || !vehicleId) {
      res.status(400).json({ ok: false, error: "tenantId ve vehicleId zorunlu" });
      return;
    }
    const vehicle = await prisma.vehicle.findFirst({
      where: { vehicleId, tenantId },
      include: {
        company: {
          select: { companyId: true, legalName: true }
        }
      }
    });
    if (!vehicle) {
      res.status(404).json({ ok: false, error: "Araç bulunamadı" });
      return;
    }
    res.json({
      ok: true,
      vehicle: {
        ...vehicle,
        validTo: vehicle.validTo ? vehicle.validTo.toISOString() : null,
        createdAt: vehicle.createdAt.toISOString(),
        updatedAt: vehicle.updatedAt.toISOString()
      }
    });
  }
);

tenantsRouter.put(
  "/:tenantId/vehicles/:vehicleId",
  permissionGuard(["vehicle.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const vehicleId = req.params.vehicleId?.trim();
    if (!tenantId || !vehicleId) {
      res.status(400).json({ ok: false, error: "tenantId ve vehicleId zorunlu" });
      return;
    }
    const existing = await prisma.vehicle.findFirst({
      where: { vehicleId, tenantId }
    });
    if (!existing) {
      res.status(404).json({ ok: false, error: "Araç bulunamadı" });
      return;
    }
    const { plateNo, seatCount, usage, status, companyId } = req.body || {};

    let seatCountValue: number | null = existing.seatCount;
    if (typeof seatCount !== "undefined") {
      try {
        seatCountValue = parseVehicleSeatCount(seatCount);
      } catch (error) {
        res.status(400).json({ ok: false, error: (error as Error).message });
        return;
      }
    }
    const normalizedUsage =
      typeof usage !== "undefined" ? normalizeVehicleUsage(usage) : existing.usage;
    if (typeof usage !== "undefined" && usage && !normalizedUsage) {
      res.status(400).json({ ok: false, error: "Geçersiz usage" });
      return;
    }
    const normalizedStatus =
      typeof status !== "undefined" ? normalizeVehicleStatus(status) : existing.status;
    const statusDate = dateOnly();
    const validToValue = computeValidTo(normalizedStatus, statusDate);
    const validToChanged =
      (existing.validTo && validToValue && existing.validTo.getTime() !== validToValue.getTime()) ||
      (existing.validTo && !validToValue) ||
      (!existing.validTo && validToValue);
    const statusChanged = normalizedStatus !== existing.status || validToChanged;

    let companyChange: string | null = null;
    if (typeof companyId === "string" && companyId.trim() && companyId.trim() !== existing.companyId) {
      const targetCompany = await ensureVehicleCompany(companyId.trim(), tenantId);
      if (!targetCompany) {
        res.status(400).json({ ok: false, error: "companyId geçersiz" });
        return;
      }
      companyChange = targetCompany.companyId;
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.vehicle.update({
          where: { vehicleId },
          data: {
            companyId: companyChange ?? existing.companyId,
            plateNo: typeof plateNo !== "undefined" ? plateNo?.trim() || null : existing.plateNo,
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

tenantsRouter.delete(
  "/:tenantId/vehicles/:vehicleId",
  permissionGuard(["vehicle.manage"]),
  async (req, res) => {
    const tenantId = req.params.tenantId?.trim();
    const vehicleId = req.params.vehicleId?.trim();
    if (!tenantId || !vehicleId) {
      res.status(400).json({ ok: false, error: "tenantId ve vehicleId zorunlu" });
      return;
    }
    const noteRaw = (req.body as Record<string, unknown> | undefined)?.note;
    const note =
      typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : null;
    const existing = await prisma.vehicle.findFirst({
      where: { vehicleId, tenantId }
    });
    if (!existing) {
      res.status(404).json({ ok: false, error: "Araç bulunamadı" });
      return;
    }
    try {
      await prisma.$transaction(async (tx) => {
        const archiveDate = dateOnly();
        await tx.vehicle.update({
          where: { vehicleId },
          data: {
            status: "Archived",
            validTo: archiveDate
          }
        });
        await recordStatusEvent(tx, {
          tenantId,
          entityType: "VEHICLE",
          entityId: vehicleId,
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

tenantsRouter.post(
  "/",
  permissionGuard(["tp.tenant.create"]),
  async (req, res) => {
    const { tenantId: providedTenantId, legalName, legalForm, seatAddress, status, validFrom, identities } =
      req.body || {};
    if (!legalName) {
      res.status(400).json({ ok: false, error: "legalName zorunlu" });
      return;
    }
    let identifierInputs: TenantIdInput[] = [];
    try {
      identifierInputs = parseTenantIdentifierArray(identities);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kimlik verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    const identifiersPrepared = ensureTenantIdentifiers(identifierInputs, providedTenantId);
    const tenantIdValue = identifiersPrepared.tenantId;
    let effectiveFrom = todayDateOnly();
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      const parsedDate = toDateOnly(validFrom);
      if (!parsedDate) {
        res.status(400).json({ ok: false, error: "validFrom geçerli bir tarih olmalıdır (YYYY-MM-DD)." });
        return;
      }
      effectiveFrom = parsedDate;
    }
    const normalizedLegalForm =
      typeof legalForm === "string" && legalForm.trim().length > 0 ? legalForm.trim() : null;
    const normalizedSeat =
      typeof seatAddress === "string" && seatAddress.trim().length > 0 ? seatAddress.trim() : null;
    const normalizedStatus =
      typeof status === "string" && status.trim().length > 0 ? status.trim() : "Active";
    try {
      if (normalizedSeat) {
        validatePostalAddress(normalizedSeat, "seatAddress");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Adres geçerli değil.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            tenantId: tenantIdValue,
            legalName,
            legalForm: normalizedLegalForm,
            seatAddress: normalizedSeat,
            status: normalizedStatus
          }
        });
        if (!identifiersPrepared.identifiers.length) {
          identifiersPrepared.identifiers.push({
            idType: "SYNTHETIC",
            idValue: tenant.tenantId,
            countryCode: null,
            validFrom: todayDateOnly(),
            validTo: null,
            primaryFlag: true
          });
        }
        const identifierCreates = identifiersPrepared.identifiers.map((entry) =>
          tx.tenantIdentifier.create({
            data: {
              tenantId: tenant.tenantId,
              idType: entry.idType,
              idValue: entry.idValue,
              countryCode: entry.countryCode,
              validFrom: entry.validFrom ?? todayDateOnly(),
              validTo: entry.validTo ?? null,
              primaryFlag: entry.primaryFlag
            }
          })
        );
        await Promise.all(identifierCreates);
        const primaryIdentifier = await tx.tenantIdentifier.findFirst({
          where: { tenantId: tenant.tenantId, primaryFlag: true },
          orderBy: { validFrom: "desc" }
        });
        const identity = await tx.tenantIdentity.create({
          data: {
            tenantId: tenant.tenantId,
            currentFlag: true,
            legalName,
            legalForm: normalizedLegalForm,
            seatAddress: normalizedSeat,
            validFrom: effectiveFrom
          }
        });
        return { tenant, identity, primaryIdentifier };
      });
      res.status(201).json({
        ok: true,
        tenant: result.tenant,
        identity: result.identity,
        primaryIdentifier: result.primaryIdentifier ? formatTenantIdentifier(result.primaryIdentifier) : null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tenant oluşturma hatası.";
      res.status(500).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.put(
  "/:id",
  permissionGuard(["tp.tenant.update"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const { legalName, legalForm, seatAddress, status, validFrom } = req.body || {};
    const hasIdentityUpdate =
      Object.prototype.hasOwnProperty.call(req.body ?? {}, "legalName") ||
      Object.prototype.hasOwnProperty.call(req.body ?? {}, "legalForm") ||
      Object.prototype.hasOwnProperty.call(req.body ?? {}, "seatAddress");
    let effectiveFrom: Date | null = null;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      effectiveFrom = toDateOnly(validFrom);
      if (!effectiveFrom) {
        res.status(400).json({ ok: false, error: "validFrom geçerli bir tarih olmalıdır (YYYY-MM-DD)." });
        return;
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.tenant.findUnique({ where: { tenantId } });
        if (!existing) {
          return { notFound: true as const };
        }

        const currentIdentity = await tx.tenantIdentity.findFirst({
          where: { tenantId, currentFlag: true },
          orderBy: { validFrom: "desc" }
        });
        const normalizedLegalForm =
          typeof legalForm === "string" && legalForm.trim().length > 0 ? legalForm.trim() : legalForm === "" ? null : undefined;
        const normalizedSeat =
          typeof seatAddress === "string" && seatAddress.trim().length > 0
            ? seatAddress.trim()
            : seatAddress === ""
            ? null
            : undefined;
        if (typeof normalizedSeat === "string") {
          try {
            validatePostalAddress(normalizedSeat, "seatAddress");
          } catch (error) {
            throw new Error(`VALIDATION:${(error as Error).message}`);
          }
        }

        const tenantUpdate: Record<string, unknown> = {};
        const currentStatus = existing.status ?? "Active";
        let statusChange: { previous: string; next: string; validTo: Date | null } | null = null;
        if (typeof legalName === "string" && legalName.trim().length > 0) {
          tenantUpdate.legalName = legalName.trim();
        } else if (legalName === "") {
          tenantUpdate.legalName = "";
        }
        if (normalizedLegalForm !== undefined) {
          tenantUpdate.legalForm = normalizedLegalForm;
        }
        if (normalizedSeat !== undefined) {
          tenantUpdate.seatAddress = normalizedSeat;
        }
        if (typeof status === "string") {
          const trimmedStatus = status.trim();
          tenantUpdate.status = trimmedStatus;
          if (trimmedStatus !== currentStatus) {
            const statusEffective = effectiveFrom ?? todayDateOnly();
            const validToValue = computeValidTo(trimmedStatus, statusEffective);
            tenantUpdate.validTo = validToValue;
            statusChange = { previous: currentStatus, next: trimmedStatus, validTo: validToValue };
          } else if (trimmedStatus.toLowerCase() === "active" && existing.validTo) {
            tenantUpdate.validTo = null;
          }
        } else if (status === "") {
          tenantUpdate.status = "";
          tenantUpdate.validTo = null;
          if (currentStatus !== "") {
            statusChange = { previous: currentStatus, next: "", validTo: null };
          }
        }

        let tenantRecord = existing;
        if (Object.keys(tenantUpdate).length > 0) {
          tenantRecord = await tx.tenant.update({
            where: { tenantId },
            data: tenantUpdate
          });
        }

        const nextIdentity = {
          legalName: typeof legalName === "string" && legalName.trim().length > 0 ? legalName.trim() : tenantRecord.legalName,
          legalForm:
            normalizedLegalForm !== undefined
              ? normalizedLegalForm
              : currentIdentity?.legalForm ?? tenantRecord.legalForm,
          seatAddress:
            normalizedSeat !== undefined ? normalizedSeat : currentIdentity?.seatAddress ?? tenantRecord.seatAddress
        };

        const identityChanged =
          (typeof legalName === "string" && legalName.trim().length > 0
            ? legalName.trim()
            : tenantRecord.legalName) !== (currentIdentity?.legalName ?? tenantRecord.legalName) ||
          (normalizedLegalForm !== undefined
            ? normalizedLegalForm
            : currentIdentity?.legalForm ?? tenantRecord.legalForm) !==
            (currentIdentity?.legalForm ?? tenantRecord.legalForm) ||
          (normalizedSeat !== undefined
            ? normalizedSeat
            : currentIdentity?.seatAddress ?? tenantRecord.seatAddress) !==
            (currentIdentity?.seatAddress ?? tenantRecord.seatAddress);

        let identityRecord = currentIdentity;
        if (hasIdentityUpdate && identityChanged) {
          const effective = effectiveFrom ?? todayDateOnly();
          if (currentIdentity) {
            await tx.tenantIdentity.update({
              where: { id: currentIdentity.id },
              data: { currentFlag: false, validTo: effective }
            });
          }
          identityRecord = await tx.tenantIdentity.create({
            data: {
              tenantId,
              currentFlag: true,
              legalName: nextIdentity.legalName,
              legalForm: nextIdentity.legalForm ?? null,
              seatAddress: nextIdentity.seatAddress ?? null,
              validFrom: effective
            }
          });
        }

        if (statusChange) {
          await recordStatusEvent(tx, {
            tenantId,
            entityType: "TENANT",
            entityId: tenantId,
            status: statusChange.next,
            validTo: statusChange.validTo
          });
        }

        return { tenant: tenantRecord, identity: identityRecord };
      });

      if (result.notFound) {
        res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
        return;
      }

      res.json({ ok: true, tenant: result.tenant, identity: result.identity });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tenant güncelleme hatası.";
      if (message.startsWith("VALIDATION:")) {
        res.status(400).json({ ok: false, error: message.slice("VALIDATION:".length) });
        return;
      }
      res.status(500).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.get(
  "/:id/identity-history",
  permissionGuard(["tp.tenant.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const items = await prisma.tenantIdentity.findMany({
      where: { tenantId },
      orderBy: [
        { currentFlag: "desc" },
        { validFrom: "desc" }
      ]
    });
    res.json({ ok: true, items });
  }
);

tenantsRouter.get(
  "/:id/identities",
  permissionGuard(["tp.tenant.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const items = await prisma.tenantIdentifier.findMany({
      where: { tenantId },
      orderBy: [
        { primaryFlag: "desc" },
        { validFrom: "desc" },
        { idType: "asc" }
      ]
    });
    res.json({ ok: true, items: items.map((item) => formatTenantIdentifier(item)) });
  }
);

tenantsRouter.post(
  "/:id/identities",
  permissionGuard(["tp.tenant.update"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let input: TenantIdInput;
    try {
      input = parseTenantIdentifierEntry(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kimlik verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (input.primaryFlag) {
          await tx.tenantIdentifier.updateMany({
            where: { tenantId },
            data: { primaryFlag: false }
          });
        }
        const created = await tx.tenantIdentifier.create({
          data: {
            tenantId,
            idType: input.idType,
            idValue: input.idValue,
            countryCode: input.countryCode,
            validFrom: input.validFrom ?? todayDateOnly(),
            validTo: input.validTo ?? null,
            primaryFlag: input.primaryFlag
          }
        });
        const primaryIdentifier = await recalcTenantIdentifiers(tx, tenantId);
        return { created, primaryIdentifier };
      });
      res.status(201).json({
        ok: true,
        identity: formatTenantIdentifier(result.created),
        primaryIdentifier: result.primaryIdentifier
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tenant kimlik kaydı başarısız.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.get(
  "/:id/attachments",
  permissionGuard(["tp.tenant.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const companyIds = await prisma.company.findMany({
      where: { tenantId },
      select: { companyId: true }
    }).then((rows) => rows.map((row) => row.companyId));
    const permitIds = await prisma.companyPermit.findMany({
      where: { company: { tenantId } },
      select: { id: true }
    }).then((rows) => rows.map((row) => row.id));
    const whereClauses: Prisma.AttachmentWhereInput[] = [
      { ownerType: "TENANT", ownerId: tenantId }
    ];
    if (companyIds.length) {
      whereClauses.push({ ownerType: "COMPANY", ownerId: { in: companyIds } });
    }
    if (permitIds.length) {
      whereClauses.push({ ownerType: "COMPANY_PERMIT", ownerId: { in: permitIds } });
    }
    const items = await prisma.attachment.findMany({
      where: { OR: whereClauses },
      orderBy: [{ createdAt: "desc" }]
    });
    res.json({ ok: true, items: items.map((item) => formatAttachment(item)) });
  }
);

tenantsRouter.post(
  "/:id/attachments",
  permissionGuard(["tp.tenant.update"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: AttachmentInput;
    try {
      payload = parseAttachmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ek (attachment) verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (payload.ownerType === "TENANT") {
          if (payload.ownerId !== tenantId) {
            throw new Error("ownerId tenant ile uyuşmuyor.");
          }
        } else if (payload.ownerType === "COMPANY") {
          const company = await tx.company.findUnique({ where: { companyId: payload.ownerId } });
          if (!company || company.tenantId !== tenantId) {
            throw new Error("companyId tenant ile uyuşmuyor.");
          }
        } else if (payload.ownerType === "COMPANY_PERMIT") {
          const permit = await tx.companyPermit.findUnique({ where: { id: payload.ownerId } });
          if (!permit) {
            throw new Error("companyPermit bulunamadı.");
          }
          const company = await tx.company.findUnique({ where: { companyId: permit.companyId } });
          if (!company || company.tenantId !== tenantId) {
            throw new Error("companyPermit tenant ile uyuşmuyor.");
          }
        }

        await tx.attachment.create({
          data: {
            ownerType: payload.ownerType,
            ownerId: payload.ownerId,
            attachmentType: payload.attachmentType,
            fileRef: payload.fileRef,
            issuedAt: payload.issuedAt ?? null,
            sourceUrl: payload.sourceUrl ?? null
          }
        });
      });

      res.status(201).json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ek kaydedilemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.delete(
  "/:id/attachments/:attachmentId",
  permissionGuard(["tp.tenant.update"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const attachmentId = req.params.attachmentId;
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) {
      res.status(404).json({ ok: false, error: "Ek bulunamadı." });
      return;
    }
    try {
      if (attachment.ownerType === "TENANT") {
        if (attachment.ownerId !== tenantId) {
          res.status(403).json({ ok: false, error: "Ek bu tenant'a ait değil." });
          return;
        }
      } else if (attachment.ownerType === "COMPANY") {
        const company = await prisma.company.findUnique({ where: { companyId: attachment.ownerId } });
        if (!company || company.tenantId !== tenantId) {
          res.status(403).json({ ok: false, error: "Şirket tenant ile uyuşmuyor." });
          return;
        }
      } else if (attachment.ownerType === "COMPANY_PERMIT") {
        const permit = await prisma.companyPermit.findUnique({ where: { id: attachment.ownerId } });
        if (!permit) {
          res.status(404).json({ ok: false, error: "Şirket izni bulunamadı." });
          return;
        }
        const company = await prisma.company.findUnique({ where: { companyId: permit.companyId } });
        if (!company || company.tenantId !== tenantId) {
          res.status(403).json({ ok: false, error: "Şirket izni tenant ile uyuşmuyor." });
          return;
        }
      }
      await prisma.attachment.delete({ where: { id: attachmentId } });
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ek silinemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.get(
  "/:id/shareholdings",
  permissionGuard(["tp.shareholding.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const items = await prisma.shareholding.findMany({
      where: { tenantId },
      orderBy: [
        { validFrom: "desc" },
        { roleType: "asc" }
      ],
      include: { party: true }
    });
    res.json({
      ok: true,
      items: items.map((item) =>
        formatShareholding({
          ...item,
          party: item.party
            ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName }
            : null
        })
      )
    });
  }
);

tenantsRouter.post(
  "/:id/shareholdings",
  permissionGuard(["tp.shareholding.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: ShareholdingInput;
    try {
      payload = parseShareholdingPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pay sahipliği verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const shareholding = await prisma.$transaction(async (tx) => {
        let resolvedPartyId = payload.partyId;
        if (!resolvedPartyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party!.type,
              displayName: payload.party!.displayName
            }
          });
          resolvedPartyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId: resolvedPartyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }

        const entry = await tx.shareholding.create({
          data: {
            tenantId,
            partyId: resolvedPartyId,
            roleType: payload.roleType,
            quotaPercent: payload.quotaPercent,
            einlageAmount: payload.einlageAmount,
            liability: payload.liability,
            validFrom: payload.validFrom ?? null,
            validTo: payload.validTo ?? null
          },
          include: { party: true }
        });
        return entry;
      });

      res.status(201).json({
        ok: true,
        shareholding: formatShareholding({
          ...shareholding,
          party: shareholding.party
            ? {
                partyId: shareholding.party.partyId,
                type: shareholding.party.type,
                displayName: shareholding.party.displayName
              }
            : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pay sahipliği eklenemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.get(
  "/:id/officers",
  permissionGuard(["tp.officer.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const items = await prisma.officer.findMany({
      where: { tenantId },
      orderBy: [{ validFrom: "desc" }],
      include: { party: true, company: true }
    });
    res.json({
      ok: true,
      items: items.map((item) =>
        formatOfficer({
          ...item,
          party: item.party
            ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName }
            : null
        })
      )
    });
  }
);

tenantsRouter.post(
  "/:id/officers",
  permissionGuard(["tp.officer.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: OfficerInput;
    try {
      payload = parseOfficerPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const officer = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party!.type,
              displayName: payload.party!.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }

        let companyId: string | null = null;
        if (payload.level === "COMPANY") {
          companyId = payload.companyId ?? null;
          if (!companyId) {
            throw new Error("companyId zorunlu");
          }
          const company = await tx.company.findUnique({ where: { companyId } });
          if (!company || company.tenantId !== tenantId) {
            throw new Error("companyId tenant ile uyuşmuyor.");
          }
        }

        const createdOfficer = await tx.officer.create({
          data: {
            level: payload.level,
            tenantId,
            companyId,
            partyId,
            officerType: payload.officerType,
            validFrom: payload.validFrom ?? null,
            validTo: payload.validTo ?? null
          },
          include: { party: true, company: true }
        });
        return createdOfficer;
      });

      res.status(201).json({
        ok: true,
        officer: formatOfficer({
          ...officer,
          party: officer.party
            ? { partyId: officer.party.partyId, type: officer.party.type, displayName: officer.party.displayName }
            : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer kaydı başarısız.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.put(
  "/:id/officers/:officerId",
  permissionGuard(["tp.officer.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const officerId = req.params.officerId;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const existingOfficer = await prisma.officer.findUnique({
      where: { id: officerId },
      include: { party: true }
    });
    if (!existingOfficer || existingOfficer.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Officer bulunamadı." });
      return;
    }

    let payload: OfficerInput;
    try {
      payload = parseOfficerPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const officer = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId ?? existingOfficer.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party!.type,
              displayName: payload.party!.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }

        let companyId: string | null = null;
        if (payload.level === "COMPANY") {
          companyId = payload.companyId ?? null;
          if (!companyId) {
            throw new Error("companyId zorunlu");
          }
          const company = await tx.company.findUnique({ where: { companyId } });
          if (!company || company.tenantId !== tenantId) {
            throw new Error("companyId tenant ile uyuşmuyor.");
          }
        }

        const updatedOfficer = await tx.officer.update({
          where: { id: officerId },
          data: {
            level: payload.level,
            partyId,
            companyId,
            officerType: payload.officerType,
            validFrom: payload.validFrom ?? null,
            validTo: payload.validTo ?? null
          },
          include: { party: true }
        });

        return updatedOfficer;
      });

      res.json({
        ok: true,
        officer: formatOfficer({
          ...officer,
          party: officer.party
            ? { partyId: officer.party.partyId, type: officer.party.type, displayName: officer.party.displayName }
            : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer güncellenemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.delete(
  "/:id/officers/:officerId",
  permissionGuard(["tp.officer.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const officerId = req.params.officerId;
    const existingOfficer = await prisma.officer.findUnique({ where: { id: officerId } });
    if (!existingOfficer || existingOfficer.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Officer bulunamadı." });
      return;
    }
    await prisma.officer.delete({ where: { id: officerId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/vehicle-assignments",
  permissionGuard(["tp.assignment.vehicle.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const items = await prisma.vehicleAssignment.findMany({
      where: { tenantId },
      orderBy: [{ assignedFrom: "desc" }]
    });
    res.json({ ok: true, items: items.map((item) => formatVehicleAssignment(item)) });
  }
);

tenantsRouter.post(
  "/:id/vehicle-assignments",
  permissionGuard(["tp.assignment.vehicle.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: VehicleAssignmentInput;
    try {
      payload = parseVehicleAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Araç ataması verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const assignment = await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { vehicleId: payload.vehicleId } });
        if (!vehicle) {
          throw new Error("vehicleId geçersiz.");
        }
        if (vehicle.tenantId !== tenantId) {
          throw new Error("vehicle tenant ile uyuşmuyor.");
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyuşmuyor.");
        }
        const created = await tx.vehicleAssignment.create({
          data: {
            vehicleId: payload.vehicleId,
            tenantId,
            companyId: payload.companyId,
            assignedFrom: payload.assignedFrom,
            assignedTo: payload.assignedTo ?? null,
            approvalId: payload.approvalId ?? null
          }
        });
        return created;
      });

      res.status(201).json({ ok: true, assignment: formatVehicleAssignment(assignment) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Araç ataması kaydedilemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.put(
  "/:id/vehicle-assignments/:assignmentId",
  permissionGuard(["tp.assignment.vehicle.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const assignmentId = req.params.assignmentId;
    const existingAssignment = await prisma.vehicleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existingAssignment || existingAssignment.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Araç ataması bulunamadı." });
      return;
    }
    let payload: VehicleAssignmentInput;
    try {
      payload = parseVehicleAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Araç ataması verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const assignment = await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { vehicleId: payload.vehicleId } });
        if (!vehicle) {
          throw new Error("vehicleId geçersiz.");
        }
        if (vehicle.tenantId !== tenantId) {
          throw new Error("vehicle tenant ile uyuşmuyor.");
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyuşmuyor.");
        }
        const updated = await tx.vehicleAssignment.update({
          where: { id: assignmentId },
          data: {
            vehicleId: payload.vehicleId,
            companyId: payload.companyId,
            assignedFrom: payload.assignedFrom,
            assignedTo: payload.assignedTo ?? null,
            approvalId: payload.approvalId ?? null
          }
        });
        return updated;
      });

      res.json({ ok: true, assignment: formatVehicleAssignment(assignment) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Araç ataması güncellenemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.delete(
  "/:id/vehicle-assignments/:assignmentId",
  permissionGuard(["tp.assignment.vehicle.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const assignmentId = req.params.assignmentId;
    const existingAssignment = await prisma.vehicleAssignment.findUnique({ where: { id: assignmentId } });
    if (!existingAssignment || existingAssignment.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Araç ataması bulunamadı." });
      return;
    }
    await prisma.vehicleAssignment.delete({ where: { id: assignmentId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/driver-assignments",
  permissionGuard(["tp.assignment.driver.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    const items = await prisma.driverAssignment.findMany({
      where: { tenantId },
      orderBy: [{ assignedFrom: "desc" }],
      include: { party: true }
    });
    res.json({
      ok: true,
      items: items.map((item) =>
        formatDriverAssignment({
          ...item,
          party: item.party
            ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName }
            : null
        })
      )
    });
  }
);

tenantsRouter.post(
  "/:id/driver-assignments",
  permissionGuard(["tp.assignment.driver.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: DriverAssignmentInput;
    try {
      payload = parseDriverAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Şoför ataması verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const assignment = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party!.type,
              displayName: payload.party!.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyuşmuyor.");
        }
        const created = await tx.driverAssignment.create({
          data: {
            partyId,
            tenantId,
            companyId: payload.companyId,
            assignedFrom: payload.assignedFrom,
            assignedTo: payload.assignedTo ?? null,
            approvalId: payload.approvalId ?? null
          },
          include: { party: true }
        });
        return created;
      });

      res.status(201).json({
        ok: true,
        assignment: formatDriverAssignment({
          ...assignment,
          party: assignment.party
            ? { partyId: assignment.party.partyId, type: assignment.party.type, displayName: assignment.party.displayName }
            : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Şoför ataması kaydedilemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.put(
  "/:id/driver-assignments/:assignmentId",
  permissionGuard(["tp.assignment.driver.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const assignmentId = req.params.assignmentId;
    const existingAssignment = await prisma.driverAssignment.findUnique({
      where: { id: assignmentId },
      include: { party: true }
    });
    if (!existingAssignment || existingAssignment.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Şoför ataması bulunamadı." });
      return;
    }

    let payload: DriverAssignmentInput;
    try {
      payload = parseDriverAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Şoför ataması verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const assignment = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId ?? existingAssignment.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party!.type,
              displayName: payload.party!.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyuşmuyor.");
        }
        const updated = await tx.driverAssignment.update({
          where: { id: assignmentId },
          data: {
            partyId,
            companyId: payload.companyId,
            assignedFrom: payload.assignedFrom,
            assignedTo: payload.assignedTo ?? null,
            approvalId: payload.approvalId ?? null
          },
          include: { party: true }
        });
        return updated;
      });

      res.json({
        ok: true,
        assignment: formatDriverAssignment({
          ...assignment,
          party: assignment.party
            ? { partyId: assignment.party.partyId, type: assignment.party.type, displayName: assignment.party.displayName }
            : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Şoför ataması güncellenemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.delete(
  "/:id/driver-assignments/:assignmentId",
  permissionGuard(["tp.assignment.driver.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const assignmentId = req.params.assignmentId;
    const existingAssignment = await prisma.driverAssignment.findUnique({ where: { id: assignmentId } });
    if (!existingAssignment || existingAssignment.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Şoför ataması bulunamadı." });
      return;
    }
    await prisma.driverAssignment.delete({ where: { id: assignmentId } });
    res.json({ ok: true });
  }
);

tenantsRouter.get(
  "/:id/approvals",
  permissionGuard(["tp.approval.read"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const approvals = await prisma.approvalRequest.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }]
    });
    res.json({ ok: true, items: approvals.map((approval) => formatApproval(approval)) });
  }
);

tenantsRouter.post(
  "/:id/approvals",
  permissionGuard(["tp.approval.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
    if (!tenant) {
      res.status(404).json({ ok: false, error: "Tenant bulunamadı." });
      return;
    }
    let payload: ApprovalInput;
    try {
      payload = parseApprovalPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onay verisi hatalı.";
      res.status(400).json({ ok: false, error: message });
      return;
    }

    try {
      const existing = payload.idempotencyKey
        ? await prisma.approvalRequest.findUnique({ where: { idempotencyKey: payload.idempotencyKey } })
        : null;
      if (existing) {
        res.status(200).json({ ok: true, approval: formatApproval(existing) });
        return;
      }
      const inserted = await prisma.approvalRequest.create({
        data: {
          tenantId,
          scope: payload.scope,
          objectId: payload.objectId,
          op: payload.op,
          payload: payload.payload ? JSON.stringify(payload.payload) : null,
          status: "PENDING",
          idempotencyKey: payload.idempotencyKey ?? null
        }
      });
      res.status(201).json({ ok: true, approval: formatApproval(inserted) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onay kaydedilemedi.";
      res.status(400).json({ ok: false, error: message });
    }
  }
);

tenantsRouter.delete(
  "/:id/approvals/:approvalId",
  permissionGuard(["tp.approval.create"]),
  async (req, res) => {
    const tenantId = req.params.id;
    const approvalId = req.params.approvalId;
    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval || approval.tenantId !== tenantId) {
      res.status(404).json({ ok: false, error: "Onay isteği bulunamadı." });
      return;
    }
    await prisma.approvalRequest.delete({ where: { id: approvalId } });
    res.json({ ok: true });
  }
);

tenantsRouter.post(
  "/:id/users",
  permissionGuard(["tp.tenant.user.assign"]),
  async (req, res) => {
    const { userId, role } = req.body || {};
    if (!userId) {
      res.status(400).json({ ok: false, error: "userId zorunlu" });
      return;
    }
    const entry = await prisma.tenantUser.upsert({
      where: { tenantId_userId: { tenantId: req.params.id, userId } },
      update: { role },
      create: { tenantId: req.params.id, userId, role }
    });
    res.json({ ok: true, item: entry });
  }
);
