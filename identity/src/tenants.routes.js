import express from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "./db.js";
import { permissionGuard } from "./permissionGuard.js";
const tenantsRouter = express.Router();
function toDateOnly(value) {
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
function todayDateOnly() {
  const now = /* @__PURE__ */ new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
const TENANT_ID_PRIORITY = ["FN", "ZVR", "GISA", "UID", "GLN", "STEUERNR", "LEGACY", "SYNTHETIC"];
const SHAREHOLDING_ROLE_TYPES = /* @__PURE__ */ new Set([
  "Komplement\xE4r",
  "Kommanditist",
  "Gesellschafter",
  "Anteilseigner"
]);
const PARTY_TYPES = /* @__PURE__ */ new Set(["Nat\xFCrlichePerson", "JuristischePerson"]);
const LIABILITY_TYPES = /* @__PURE__ */ new Set(["beschr\xE4nkt", "unbeschr\xE4nkt"]);
function firstQueryValue(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const [first] = value;
    return typeof first === "string" ? first : void 0;
  }
  return void 0;
}
function parseIntParam(value, fallback, options = {}) {
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
function identityTypePriority(value) {
  const upper = value?.toUpperCase?.() ?? "";
  const index = TENANT_ID_PRIORITY.indexOf(upper);
  return index === -1 ? TENANT_ID_PRIORITY.length : index;
}
function isActiveInterval(validFrom, validTo) {
  const now = Date.now();
  if (validFrom instanceof Date && validFrom.getTime() > now) {
    return false;
  }
  if (validTo instanceof Date && validTo.getTime() < now) {
    return false;
  }
  return true;
}
function parseTenantIdentifierEntry(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Kimlik girdisi hatal\u0131.");
  }
  const entry = raw;
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
  const countryCode = typeof entry.countryCode === "string" && entry.countryCode.trim().length ? entry.countryCode.trim().toUpperCase() : null;
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
function parseTenantIdentifierArray(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) {
    throw new Error("identities dizisi bekleniyor.");
  }
  const seen = /* @__PURE__ */ new Set();
  const items = [];
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
function selectCanonicalIdentity(items) {
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
function ensureTenantIdentifiers(inputs, explicitTenantId) {
  const records = inputs.map((input) => {
    const clone = {
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
    canonical = records.find((item) => item.idValue === explicit);
    if (!canonical) {
      const legacy = {
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
    const synthetic = {
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
function parseDecimalInput(value, field) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} say\u0131 olmal\u0131d\u0131r`);
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
      throw new Error(`${field} say\u0131 olmal\u0131d\u0131r`);
    }
    return num;
  }
  throw new Error(`${field} say\u0131 olmal\u0131d\u0131r`);
}
function formatTenantIdentifier(record) {
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
function parseShareholdingPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Pay sahipli\u011Fi verisi hatal\u0131.");
  }
  const entry = raw;
  const partyId = typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : void 0;
  let party;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni ortak i\xE7in party bilgisi gerekli.");
    }
    const typeValue = typeof partyRaw.type === "string" ? partyRaw.type.trim() : "";
    const displayNameValue = typeof partyRaw.displayName === "string" ? partyRaw.displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Ge\xE7ersiz party.type: ${typeValue}`);
    }
    party = { type: typeValue, displayName: displayNameValue };
  }
  const roleTypeRaw = typeof entry.roleType === "string" ? entry.roleType.trim() : "";
  if (!roleTypeRaw) {
    throw new Error("roleType zorunlu");
  }
  if (!SHAREHOLDING_ROLE_TYPES.has(roleTypeRaw)) {
    throw new Error(`Ge\xE7ersiz roleType: ${roleTypeRaw}`);
  }
  const liabilityRaw = typeof entry.liability === "string" ? entry.liability.trim() : "";
  if (liabilityRaw && !LIABILITY_TYPES.has(liabilityRaw)) {
    throw new Error(`Ge\xE7ersiz liability: ${liabilityRaw}`);
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
function parseOfficerPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Yetkili (officer) verisi hatal\u0131.");
  }
  const entry = raw;
  const level = typeof entry.level === "string" ? entry.level.trim().toUpperCase() : "";
  if (!level) {
    throw new Error("level zorunlu");
  }
  if (level !== "TENANT" && level !== "COMPANY") {
    throw new Error(`Ge\xE7ersiz level: ${level}`);
  }
  const officerType = typeof entry.officerType === "string" ? entry.officerType.trim() : "";
  if (!officerType) {
    throw new Error("officerType zorunlu");
  }
  const partyId = typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : void 0;
  let party;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni officer i\xE7in party bilgisi gerekli.");
    }
    const typeValue = typeof partyRaw.type === "string" ? partyRaw.type.trim() : "";
    const displayNameValue = typeof partyRaw.displayName === "string" ? partyRaw.displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Ge\xE7ersiz party.type: ${typeValue}`);
    }
    party = { type: typeValue, displayName: displayNameValue };
  }
  const companyId = typeof entry.companyId === "string" && entry.companyId.trim().length ? entry.companyId.trim() : void 0;
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
function parseVehicleAssignmentPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Ara\xE7 atamas\u0131 verisi hatal\u0131.");
  }
  const entry = raw;
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
function parseDriverAssignmentPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("\u015Eof\xF6r atamas\u0131 verisi hatal\u0131.");
  }
  const entry = raw;
  const companyId = typeof entry.companyId === "string" ? entry.companyId.trim() : "";
  if (!companyId) {
    throw new Error("companyId zorunlu");
  }
  const assignedFrom = toDateOnly(entry.assignedFrom) ?? null;
  if (!assignedFrom) {
    throw new Error("assignedFrom zorunlu");
  }
  const partyId = typeof entry.partyId === "string" && entry.partyId.trim().length ? entry.partyId.trim() : void 0;
  let party;
  if (!partyId) {
    const partyRaw = entry.party;
    if (!partyRaw || typeof partyRaw !== "object") {
      throw new Error("Yeni driver i\xE7in party bilgisi gerekli.");
    }
    const typeValue = typeof partyRaw.type === "string" ? partyRaw.type.trim() : "";
    const displayNameValue = typeof partyRaw.displayName === "string" ? partyRaw.displayName.trim() : "";
    if (!typeValue) {
      throw new Error("party.type zorunlu");
    }
    if (!displayNameValue) {
      throw new Error("party.displayName zorunlu");
    }
    if (!PARTY_TYPES.has(typeValue)) {
      throw new Error(`Ge\xE7ersiz party.type: ${typeValue}`);
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
function parseApprovalPayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Onay verisi hatal\u0131.");
  }
  const entry = raw;
  const scope = typeof entry.scope === "string" ? entry.scope.trim().toUpperCase() : "";
  if (!scope) {
    throw new Error("scope zorunlu");
  }
  if (scope !== "TENANT" && scope !== "COMPANY") {
    throw new Error(`Ge\xE7ersiz scope: ${scope}`);
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
function formatShareholding(record) {
  return {
    id: record.id,
    tenantId: record.tenantId,
    partyId: record.partyId,
    roleType: record.roleType,
    quotaPercent: record.quotaPercent !== null && record.quotaPercent !== void 0 ? record.quotaPercent.toString() : null,
    einlageAmount: record.einlageAmount !== null && record.einlageAmount !== void 0 ? record.einlageAmount.toString() : null,
    liability: record.liability,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    party: record.party ? {
      partyId: record.party.partyId,
      type: record.party.type,
      displayName: record.party.displayName
    } : null
  };
}
function formatOfficer(record) {
  return {
    id: record.id,
    level: record.level,
    tenantId: record.tenantId,
    companyId: record.companyId,
    partyId: record.partyId,
    officerType: record.officerType,
    validFrom: record.validFrom ? record.validFrom.toISOString() : null,
    validTo: record.validTo ? record.validTo.toISOString() : null,
    party: record.party ? {
      partyId: record.party.partyId,
      type: record.party.type,
      displayName: record.party.displayName
    } : null
  };
}
function formatVehicleAssignment(record) {
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
function formatDriverAssignment(record) {
  return {
    id: record.id,
    partyId: record.partyId,
    tenantId: record.tenantId,
    companyId: record.companyId,
    assignedFrom: record.assignedFrom.toISOString(),
    assignedTo: record.assignedTo ? record.assignedTo.toISOString() : null,
    approvalId: record.approvalId ?? null,
    party: record.party ? {
      partyId: record.party.partyId,
      type: record.party.type,
      displayName: record.party.displayName
    } : null
  };
}
function formatApproval(record) {
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
async function recalcTenantIdentifiers(tx, tenantId) {
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
    existing.map(
      (record) => tx.tenantIdentifier.update({
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
    const sortFieldMap = {
      name: "legalName",
      tenantid: "tenantId",
      status: "status",
      created: "createdAt",
      createdat: "createdAt"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? sortRaw ?? "" : "created";
    const sortField = sortFieldMap[sortKey] ?? "createdAt";
    const order = orderRaw === "asc" ? "asc" : "desc";
    const orderBy = { [sortField]: order };
    const where = q ? {
      OR: [
        { tenantId: { contains: q, mode: "insensitive" } },
        { legalName: { contains: q, mode: "insensitive" } }
      ]
    } : {};
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
      res.status(400).json({ ok: false, error: "tenantId zorunlu" });
      return;
    }
    const search = firstQueryValue(req.query?.q ?? req.query?.search) ?? "";
    const sortRaw = firstQueryValue(req.query?.sort)?.trim().toLowerCase();
    const orderRaw = firstQueryValue(req.query?.order)?.trim().toLowerCase();
    const page = parseIntParam(req.query?.page, 0, { min: 0 });
    const pageSize = parseIntParam(req.query?.pageSize, 20, { min: 1, max: 100 });
    const sortFieldMap = {
      name: "legalName",
      status: "status",
      companyid: "companyId"
    };
    const sortKey = sortFieldMap[sortRaw ?? ""] ? sortRaw : "name";
    const sortField = sortFieldMap[sortKey] ?? "legalName";
    const order = orderRaw === "desc" ? "desc" : "asc";
    const where = {
      tenantId,
      OR: search ? [
        { legalName: { contains: search, mode: "insensitive" } },
        { companyId: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } }
      ] : void 0
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
      sort: sortKey || "name",
      order
    });
  }
);
tenantsRouter.post(
  "/",
  permissionGuard(["tp.tenant.create"]),
  async (req, res) => {
    const { tenantId: providedTenantId, legalName, legalForm, seatAddress, status, validFrom, identities } = req.body || {};
    if (!legalName) {
      res.status(400).json({ ok: false, error: "legalName zorunlu" });
      return;
    }
    let identifierInputs = [];
    try {
      identifierInputs = parseTenantIdentifierArray(identities);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kimlik verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    const identifiersPrepared = ensureTenantIdentifiers(identifierInputs, providedTenantId);
    const tenantIdValue = identifiersPrepared.tenantId;
    let effectiveFrom = todayDateOnly();
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      const parsedDate = toDateOnly(validFrom);
      if (!parsedDate) {
        res.status(400).json({ ok: false, error: "validFrom ge\xE7erli bir tarih olmal\u0131d\u0131r (YYYY-MM-DD)." });
        return;
      }
      effectiveFrom = parsedDate;
    }
    const normalizedLegalForm = typeof legalForm === "string" && legalForm.trim().length > 0 ? legalForm.trim() : null;
    const normalizedSeat = typeof seatAddress === "string" && seatAddress.trim().length > 0 ? seatAddress.trim() : null;
    const normalizedStatus = typeof status === "string" && status.trim().length > 0 ? status.trim() : "Active";
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
        const identifierCreates = identifiersPrepared.identifiers.map(
          (entry) => tx.tenantIdentifier.create({
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
      const message = error instanceof Error ? error.message : "Tenant olu\u015Fturma hatas\u0131.";
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
    const hasIdentityUpdate = Object.prototype.hasOwnProperty.call(req.body ?? {}, "legalName") || Object.prototype.hasOwnProperty.call(req.body ?? {}, "legalForm") || Object.prototype.hasOwnProperty.call(req.body ?? {}, "seatAddress");
    let effectiveFrom = null;
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "validFrom")) {
      effectiveFrom = toDateOnly(validFrom);
      if (!effectiveFrom) {
        res.status(400).json({ ok: false, error: "validFrom ge\xE7erli bir tarih olmal\u0131d\u0131r (YYYY-MM-DD)." });
        return;
      }
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.tenant.findUnique({
          where: { tenantId },
          include: {
            identityHistory: {
              where: { currentFlag: true },
              orderBy: { validFrom: "desc" },
              take: 1
            }
          }
        });
        if (!existing) {
          return { notFound: true };
        }
        const currentIdentity = existing.identityHistory[0] ?? null;
        const normalizedLegalForm = typeof legalForm === "string" && legalForm.trim().length > 0 ? legalForm.trim() : legalForm === "" ? null : void 0;
        const normalizedSeat = typeof seatAddress === "string" && seatAddress.trim().length > 0 ? seatAddress.trim() : seatAddress === "" ? null : void 0;
        const tenantUpdate = {};
        if (typeof legalName === "string" && legalName.trim().length > 0) {
          tenantUpdate.legalName = legalName.trim();
        } else if (legalName === "") {
          tenantUpdate.legalName = "";
        }
        if (normalizedLegalForm !== void 0) {
          tenantUpdate.legalForm = normalizedLegalForm;
        }
        if (normalizedSeat !== void 0) {
          tenantUpdate.seatAddress = normalizedSeat;
        }
        if (typeof status === "string" && status.trim().length > 0) {
          tenantUpdate.status = status.trim();
        } else if (status === "") {
          tenantUpdate.status = "";
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
          legalForm: normalizedLegalForm !== void 0 ? normalizedLegalForm : currentIdentity?.legalForm ?? tenantRecord.legalForm,
          seatAddress: normalizedSeat !== void 0 ? normalizedSeat : currentIdentity?.seatAddress ?? tenantRecord.seatAddress
        };
        const identityChanged = (typeof legalName === "string" && legalName.trim().length > 0 ? legalName.trim() : tenantRecord.legalName) !== (currentIdentity?.legalName ?? tenantRecord.legalName) || (normalizedLegalForm !== void 0 ? normalizedLegalForm : currentIdentity?.legalForm ?? tenantRecord.legalForm) !== (currentIdentity?.legalForm ?? tenantRecord.legalForm) || (normalizedSeat !== void 0 ? normalizedSeat : currentIdentity?.seatAddress ?? tenantRecord.seatAddress) !== (currentIdentity?.seatAddress ?? tenantRecord.seatAddress);
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
        return { tenant: tenantRecord, identity: identityRecord };
      });
      if (result.notFound) {
        res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
        return;
      }
      res.json({ ok: true, tenant: result.tenant, identity: result.identity });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tenant g\xFCncelleme hatas\u0131.";
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let input;
    try {
      input = parseTenantIdentifierEntry(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kimlik verisi hatal\u0131.";
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
      const message = error instanceof Error ? error.message : "Tenant kimlik kayd\u0131 ba\u015Far\u0131s\u0131z.";
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
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
      items: items.map(
        (item) => formatShareholding({
          ...item,
          party: item.party ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName } : null
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let payload;
    try {
      payload = parseShareholdingPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pay sahipli\u011Fi verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const shareholding = await prisma.$transaction(async (tx) => {
        let resolvedPartyId = payload.partyId;
        if (!resolvedPartyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party.type,
              displayName: payload.party.displayName
            }
          });
          resolvedPartyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId: resolvedPartyId } });
          if (!partyExists) {
            throw new Error("partyId ge\xE7ersiz.");
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
          party: shareholding.party ? {
            partyId: shareholding.party.partyId,
            type: shareholding.party.type,
            displayName: shareholding.party.displayName
          } : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pay sahipli\u011Fi eklenemedi.";
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    const items = await prisma.officer.findMany({
      where: { tenantId },
      orderBy: [{ validFrom: "desc" }],
      include: { party: true, company: true }
    });
    res.json({
      ok: true,
      items: items.map(
        (item) => formatOfficer({
          ...item,
          party: item.party ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName } : null
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let payload;
    try {
      payload = parseOfficerPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const officer = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party.type,
              displayName: payload.party.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId ge\xE7ersiz.");
          }
        }
        let companyId = null;
        if (payload.level === "COMPANY") {
          companyId = payload.companyId ?? null;
          if (!companyId) {
            throw new Error("companyId zorunlu");
          }
          const company = await tx.company.findUnique({ where: { companyId } });
          if (!company || company.tenantId !== tenantId) {
            throw new Error("companyId tenant ile uyu\u015Fmuyor.");
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
          party: officer.party ? { partyId: officer.party.partyId, type: officer.party.type, displayName: officer.party.displayName } : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Officer kayd\u0131 ba\u015Far\u0131s\u0131z.";
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
    let payload;
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
              type: payload.party.type,
              displayName: payload.party.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId geçersiz.");
          }
        }
        let companyId = null;
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
          party: officer.party ? { partyId: officer.party.partyId, type: officer.party.type, displayName: officer.party.displayName } : null
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let payload;
    try {
      payload = parseVehicleAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ara\xE7 atamas\u0131 verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const assignment = await prisma.$transaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({ where: { vehicleId: payload.vehicleId } });
        if (!vehicle) {
          throw new Error("vehicleId ge\xE7ersiz.");
        }
        if (vehicle.tenantId !== tenantId) {
          throw new Error("vehicle tenant ile uyu\u015Fmuyor.");
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyu\u015Fmuyor.");
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
      const message = error instanceof Error ? error.message : "Ara\xE7 atamas\u0131 kaydedilemedi.";
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
    let payload;
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    const items = await prisma.driverAssignment.findMany({
      where: { tenantId },
      orderBy: [{ assignedFrom: "desc" }],
      include: { party: true }
    });
    res.json({
      ok: true,
      items: items.map(
        (item) => formatDriverAssignment({
          ...item,
          party: item.party ? { partyId: item.party.partyId, type: item.party.type, displayName: item.party.displayName } : null
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let payload;
    try {
      payload = parseDriverAssignmentPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u015Eof\xF6r atamas\u0131 verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const assignment = await prisma.$transaction(async (tx) => {
        let partyId = payload.partyId;
        if (!partyId) {
          const createdParty = await tx.party.create({
            data: {
              type: payload.party.type,
              displayName: payload.party.displayName
            }
          });
          partyId = createdParty.partyId;
        } else {
          const partyExists = await tx.party.findUnique({ where: { partyId } });
          if (!partyExists) {
            throw new Error("partyId ge\xE7ersiz.");
          }
        }
        const company = await tx.company.findUnique({ where: { companyId: payload.companyId } });
        if (!company || company.tenantId !== tenantId) {
          throw new Error("companyId tenant ile uyu\u015Fmuyor.");
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
          party: assignment.party ? { partyId: assignment.party.partyId, type: assignment.party.type, displayName: assignment.party.displayName } : null
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u015Eof\xF6r atamas\u0131 kaydedilemedi.";
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
    let payload;
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
              type: payload.party.type,
              displayName: payload.party.displayName
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
          party: assignment.party ? { partyId: assignment.party.partyId, type: assignment.party.type, displayName: assignment.party.displayName } : null
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
    const approvals = await prisma.approval.findMany({
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
      res.status(404).json({ ok: false, error: "Tenant bulunamad\u0131." });
      return;
    }
    let payload;
    try {
      payload = parseApprovalPayload(req.body ?? {});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onay verisi hatal\u0131.";
      res.status(400).json({ ok: false, error: message });
      return;
    }
    try {
      const existing = payload.idempotencyKey ? await prisma.approval.findUnique({ where: { idempotencyKey: payload.idempotencyKey } }) : null;
      if (existing) {
        res.status(200).json({ ok: true, approval: formatApproval(existing) });
        return;
      }
      const inserted = await prisma.approval.create({
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
export {
  tenantsRouter
};
