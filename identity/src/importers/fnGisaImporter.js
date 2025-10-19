import { readFile, stat as statFile, access } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db.js";
import { computeValidTo, dateOnly, recordStatusEvent } from "../statusEvents.js";

const DRY_RUN_ABORT = Symbol("IMPORT_DRY_RUN_ABORT");

export async function importOfficialRegisters(request = {}, client = prisma) {
  const { dryRun = false } = request ?? {};
  const bundle = await resolveBundle(request);

  const stats = {
    tenantsCreated: 0,
    tenantsUpdated: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    permitsUpserted: 0,
    permitEventsCreated: 0,
    attachmentsCreated: 0
  };

  try {
    const result = await client.$transaction(async (tx) => {
      const tenantCache = new Map();
      if (Array.isArray(bundle.firmenbuch)) {
        for (const record of bundle.firmenbuch) {
          const tenant = await upsertTenant(tx, record, stats);
          tenantCache.set(tenant.tenantId, tenant.tenantId);
        }
      }

      if (Array.isArray(bundle.gisa)) {
        for (const record of bundle.gisa) {
          const tenantId = record.fn?.trim();
          if (!tenantId) {
            throw new Error("GISA kaydı için fn (tenantId) zorunlu.");
          }
          if (!tenantCache.has(tenantId)) {
            const exists = await tx.tenant.findUnique({ where: { tenantId } });
            if (!exists) {
              throw new Error(`Tenant ${tenantId} henüz oluşturulmadı.`);
            }
            tenantCache.set(tenantId, tenantId);
          }
          await upsertCompany(tx, tenantId, record, stats);
        }
      }

      if (dryRun) {
        throw DRY_RUN_ABORT;
      }
      return stats;
    });
    return { ...result, dryRun: false };
  } catch (error) {
    if (error === DRY_RUN_ABORT) {
      return { ...stats, dryRun: true };
    }
    throw error;
  }
}

async function resolveBundle(request) {
  const merged = { firmenbuch: [], gisa: [] };
  if (request?.bundle) {
    merged.firmenbuch = [...(request.bundle.firmenbuch ?? [])];
    merged.gisa = [...(request.bundle.gisa ?? [])];
  }
  if (request?.source) {
    const fromSource = await loadBundleFromSource(request.source);
    if (fromSource.firmenbuch?.length) {
      merged.firmenbuch = [...(merged.firmenbuch ?? []), ...fromSource.firmenbuch];
    }
    if (fromSource.gisa?.length) {
      merged.gisa = [...(merged.gisa ?? []), ...fromSource.gisa];
    }
  }
  return merged;
}

async function loadBundleFromSource(source) {
  let resolved = path.resolve(process.cwd(), source);
  let stats = await tryStat(resolved);
  if (!stats) {
    const alt = path.resolve(process.cwd(), "..", source);
    stats = await tryStat(alt);
    if (stats) {
      resolved = alt;
    }
  }
  if (!stats) {
    throw new Error(`Import kaynağı bulunamadı: ${resolved}`);
  }

  if (stats.isFile()) {
    return normalizeBundle(await readJsonFile(resolved));
  }

  if (stats.isDirectory()) {
    const result = {};
    const firmenbuchFile = path.join(resolved, "firmenbuch.json");
    if (await fileExists(firmenbuchFile)) {
      result.firmenbuch = await readJsonFile(firmenbuchFile);
    }
    const gisaFile = path.join(resolved, "gisa.json");
    if (await fileExists(gisaFile)) {
      result.gisa = await readJsonFile(gisaFile);
    }
    if (!result.firmenbuch && !result.gisa) {
      throw new Error(`Dizinde import edilecek dosya bulunamadı: ${resolved}`);
    }
    return normalizeBundle(result);
  }

  throw new Error(`Import kaynağı desteklenmiyor: ${resolved}`);
}

async function fileExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function tryStat(target) {
  try {
    return await statFile(target);
  } catch {
    return null;
  }
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function normalizeBundle(input) {
  const result = {};

  if (Array.isArray(input?.tenants)) {
    const converted = convertTenantStructure(input.tenants);
    if (converted.firmenbuch?.length) {
      result.firmenbuch = [...(result.firmenbuch ?? []), ...converted.firmenbuch];
    }
    if (converted.gisa?.length) {
      result.gisa = [...(result.gisa ?? []), ...converted.gisa];
    }
  }

  if (Array.isArray(input?.firmenbuch)) {
    result.firmenbuch = [...(result.firmenbuch ?? []), ...input.firmenbuch];
  }
  if (Array.isArray(input?.gisa)) {
    result.gisa = [...(result.gisa ?? []), ...input.gisa];
  }

  return result;
}

function convertTenantStructure(rawTenants) {
  const firmenbuch = [];
  const gisa = [];

  for (const tenant of rawTenants) {
    const tenantId = pickString(tenant, ["tenantId", "fn", "id"]);
    if (!tenantId) continue;

    const firmenbuchRecord = {
      fn: tenantId,
      legalName: pickString(tenant, ["legalName", "name"]) ?? tenantId,
      legalForm: pickString(tenant, ["legalForm", "legal_form"]) ?? null,
      seatAddress: pickString(tenant, ["seatAddress", "seat_address", "address"]) ?? null,
      identities: Array.isArray(tenant.identities) ? tenant.identities : undefined,
      identifiers: convertIdentifiers(tenant.identifiers),
      attachments: convertAttachments(tenant.attachments)
    };
    firmenbuch.push(firmenbuchRecord);

    const companies = Array.isArray(tenant.companies) ? tenant.companies : [];
    for (const company of companies) {
      const companyId = pickString(company, ["companyId", "gisa", "id"]);
      if (!companyId) continue;
      const companyRecord = {
        gisa: companyId,
        fn: tenantId,
        legalName: pickString(company, ["legalName", "name"]) ?? firmenbuchRecord.legalName,
        address: pickString(company, ["address", "seatAddress", "seat_address"]) ?? firmenbuchRecord.seatAddress ?? "",
        status: pickString(company, ["status"]),
        permits: convertPermits(company.permits),
        attachments: convertAttachments(company.attachments)
      };
      gisa.push(companyRecord);
    }
  }

  return { firmenbuch, gisa };
}

async function upsertTenant(tx, record, stats) {
  const tenantId = record.fn?.trim();
  if (!tenantId) {
    throw new Error("Firmenbuch kaydı için fn zorunlu.");
  }
  const legalName = record.legalName?.trim();
  if (!legalName) {
    throw new Error("Firmenbuch kaydı için legalName zorunlu.");
  }
  const legalForm = record.legalForm?.trim() || null;
  const seatAddress = record.seatAddress?.trim() || null;
  const existing = await tx.tenant.findUnique({ where: { tenantId } });
  const tenant = existing
    ? await tx.tenant.update({
        where: { tenantId },
        data: {
          legalName,
          legalForm,
          seatAddress,
          status: existing.status ?? "Active",
          validTo: existing.validTo ?? null
        }
      })
    : await tx.tenant.create({
        data: {
          tenantId,
          legalName,
          legalForm,
          seatAddress,
          status: "Active",
          validTo: null
        }
      });

  if (existing) {
    stats.tenantsUpdated += 1;
  } else {
    stats.tenantsCreated += 1;
  }

  await syncTenantIdentifiers(tx, tenantId, record.identifiers ?? []);
  await syncTenantIdentityHistory(tx, tenantId, record, legalName, legalForm, seatAddress);
  await attachDocuments(tx, "TENANT", tenantId, record.attachments ?? [], stats);

  return tenant;
}

async function syncTenantIdentifiers(tx, tenantId, identifiers) {
  if (!identifiers.length) {
    return;
  }
  const prepared = identifiers.map((item) => {
    const idType = item.type?.trim()?.toUpperCase();
    const idValue = item.value?.trim();
    if (!idType || !idValue) {
      throw new Error("Kimlik bilgisi için type ve value zorunludur.");
    }
    const validFrom = parseDateOnly(item.validFrom) ?? dateOnly();
    const validTo = parseDateOnly(item.validTo);
    return {
      idType,
      idValue,
      countryCode: item.countryCode?.trim()?.toUpperCase() || null,
      validFrom,
      validTo,
      primaryFlag: Boolean(item.primary)
    };
  });

  const hasPrimary = prepared.some((entry) => entry.primaryFlag);
  if (hasPrimary) {
    await tx.tenantIdentifier.updateMany({
      where: { tenantId },
      data: { primaryFlag: false }
    });
  }

  for (const entry of prepared) {
    const existing = await tx.tenantIdentifier.findFirst({
      where: {
        tenantId,
        idType: entry.idType,
        idValue: entry.idValue,
        validFrom: entry.validFrom
      }
    });
    if (existing) {
      await tx.tenantIdentifier.update({
        where: { id: existing.id },
        data: {
          countryCode: entry.countryCode,
          validTo: entry.validTo,
          primaryFlag: entry.primaryFlag
        }
      });
    } else {
      await tx.tenantIdentifier.create({
        data: {
          tenantId,
          idType: entry.idType,
          idValue: entry.idValue,
          countryCode: entry.countryCode,
          validFrom: entry.validFrom,
          validTo: entry.validTo,
          primaryFlag: entry.primaryFlag
        }
      });
    }
  }
}

async function syncTenantIdentityHistory(tx, tenantId, record, legalName, legalForm, seatAddress) {
  const history = record.identities ?? [];
  if (!history.length) {
    return;
  }
  const sorted = [...history].sort((a, b) => {
    const aTime = parseDateOnly(a.validFrom)?.getTime() ?? 0;
    const bTime = parseDateOnly(b.validFrom)?.getTime() ?? 0;
    return aTime - bTime;
  });
  await tx.tenantIdentity.deleteMany({ where: { tenantId } });
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index];
    const next = sorted[index + 1];
    const validFrom = parseDateOnly(entry.validFrom) ?? dateOnly();
    let validTo = parseDateOnly(entry.validTo);
    if (!validTo && next) {
      const nextFrom = parseDateOnly(next.validFrom);
      if (nextFrom) {
        validTo = nextFrom;
      }
    }
    const currentFlag = index === sorted.length - 1;
    await tx.tenantIdentity.create({
      data: {
        tenantId,
        currentFlag,
        legalName: entry.legalName?.trim() || legalName,
        legalForm: entry.legalForm?.trim() || legalForm,
        seatAddress: entry.seatAddress?.trim() || seatAddress,
        validFrom,
        validTo: currentFlag ? null : validTo
      }
    });
  }
}

async function upsertCompany(tx, tenantId, record, stats) {
  const companyId = record.gisa?.trim();
  if (!companyId) {
    throw new Error("GISA kaydı için gisa (companyId) zorunlu.");
  }
  const address = record.address?.trim();
  if (!address) {
    throw new Error(`Company ${companyId} için address zorunlu.`);
  }
  const status = record.status?.trim() || "Active";
  const legalName = record.legalName?.trim() || address;
  const validTo = computeValidTo(status, dateOnly());

  const existing = await tx.company.findUnique({ where: { companyId } });
  const company = existing
    ? await tx.company.update({
        where: { companyId },
        data: {
          tenantId,
          legalName,
          address,
          status,
          validTo
        }
      })
    : await tx.company.create({
        data: {
          companyId,
          tenantId,
          legalName,
          address,
          status,
          validTo
        }
      });

  if (existing) {
    stats.companiesUpdated += 1;
  } else {
    stats.companiesCreated += 1;
  }

  if (!existing || existing.status !== company.status || (existing.validTo ?? null) !== (company.validTo ?? null)) {
    await recordStatusEvent(tx, {
      tenantId,
      entityType: "COMPANY",
      entityId: companyId,
      status: company.status,
      validTo: company.validTo ?? null
    });
  }

  await attachDocuments(tx, "COMPANY", companyId, record.attachments ?? [], stats);
  await syncPermits(tx, tenantId, companyId, record.permits ?? [], stats);
}

async function syncPermits(tx, tenantId, companyId, permits, stats) {
  for (const permit of permits) {
    const permitType = permit.type?.trim();
    if (!permitType) {
      continue;
    }
    const referenceNo = permit.referenceNo?.trim() || null;
    const existing = await tx.companyPermit.findFirst({
      where: { companyId, permitType, referenceNo }
    });
    const data = {
      companyId,
      permitType,
      issuingAuthority: permit.issuingAuthority?.trim() || null,
      referenceNo,
      permitRegisteredOn: parseDateTime(permit.registeredOn),
      effectiveFrom: parseDateTime(permit.effectiveFrom),
      validUntil: parseDateTime(permit.validUntil),
      capacityPkw:
        permit.capacityPkw === null || typeof permit.capacityPkw === "undefined"
          ? null
          : Number(permit.capacityPkw),
      vehicleScoped: Boolean(permit.vehicleScoped),
      status: permit.status?.trim() || "Active"
    };
    const record = existing ?? (await tx.companyPermit.create({ data }));
    if (existing) {
      await tx.companyPermit.update({
        where: { id: existing.id },
        data
      });
    }

    stats.permitsUpserted += 1;

    await attachDocuments(tx, "COMPANY_PERMIT", record.id, permit.attachments ?? [], stats);
    await syncPermitEvents(tx, record.id, companyId, permit.events ?? [], stats);
  }
}

async function syncPermitEvents(tx, permitId, companyId, events, stats) {
  for (const event of events) {
    const eventType = event.type?.trim()?.toUpperCase();
    if (!eventType) {
      continue;
    }
    const eventDate = parseDateTime(event.date);
    if (!eventDate) {
      continue;
    }
    const referenceNo = event.referenceNo?.trim() || null;
    const existing = await tx.companyPermitEvent.findFirst({
      where: { companyId, permitId, eventType, eventDate }
    });
    if (existing) {
      continue;
    }
    await tx.companyPermitEvent.create({
      data: {
        companyId,
        permitId,
        eventType,
        eventDate,
        referenceNo,
        sourceDocRef: event.source?.trim() || null
      }
    });
    stats.permitEventsCreated += 1;
  }
}

async function attachDocuments(tx, ownerType, ownerId, attachments, stats) {
  for (const attachment of attachments) {
    const attachmentType = attachment.type?.trim();
    const fileRef = attachment.fileRef?.trim();
    if (!attachmentType || !fileRef) {
      continue;
    }
    const issuedAt = parseDateTime(attachment.issuedAt);
    const sourceUrl = attachment.sourceUrl?.trim() || null;
    const exists = await tx.attachment.findFirst({
      where: { ownerType, ownerId, fileRef }
    });
    if (exists) {
      continue;
    }
    await tx.attachment.create({
      data: {
        ownerType,
        ownerId,
        attachmentType,
        fileRef,
        issuedAt,
        sourceUrl
      }
    });
    stats.attachmentsCreated += 1;
  }
}

function convertIdentifiers(raw) {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const identifiers = [];
  for (const entry of raw) {
    const type = pickString(entry, ["idType", "type"]);
    const value = pickString(entry, ["idValue", "value"]);
    if (!type || !value) continue;
    const identifier = {
      type: type.toUpperCase(),
      value,
      countryCode: pickString(entry, ["countryCode", "country_code"]) ?? null,
      validFrom: pickString(entry, ["validFrom", "valid_from", "from"]),
      validTo: pickString(entry, ["validTo", "valid_to", "to"]),
      primary: Boolean(entry?.primary ?? entry?.primaryFlag)
    };
    identifier.primaryFlag = identifier.primary;
    identifiers.push(identifier);
  }
  return identifiers.length ? identifiers : undefined;
}

function convertAttachments(raw) {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const attachments = [];
  for (const entry of raw) {
    const type = pickString(entry, ["type", "attachmentType", "attachment_type"]);
    const fileRef = pickString(entry, ["fileRef", "file_ref", "path"]);
    if (!type || !fileRef) continue;
    attachments.push({
      type,
      fileRef,
      issuedAt: pickString(entry, ["issuedAt", "issued_at", "date"]),
      sourceUrl: pickString(entry, ["sourceUrl", "source_url", "url"]) ?? null
    });
  }
  return attachments.length ? attachments : undefined;
}

function convertPermits(raw) {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const permits = [];
  for (const entry of raw) {
    const permitType = pickString(entry, ["permitType", "permit_type", "type"]);
    if (!permitType) continue;
    permits.push({
      type: permitType,
      issuingAuthority: pickString(entry, ["issuingAuthority", "issuing_authority"]),
      referenceNo: pickString(entry, ["referenceNo", "reference_no"]),
      registeredOn: pickString(entry, ["permitRegisteredOn", "permit_registered_on", "registeredOn", "registered_on"]),
      effectiveFrom: pickString(entry, ["effectiveFrom", "effective_from"]),
      validUntil: pickString(entry, ["validUntil", "valid_until"]),
      capacityPkw: pickNumber(entry, ["capacityPkw", "capacity_pkw"]),
      vehicleScoped: pickBoolean(entry, ["vehicleScoped", "vehicle_scoped"]),
      status: pickString(entry, ["status"]),
      events: convertPermitEvents(entry.events),
      attachments: convertAttachments(entry.attachments)
    });
  }
  return permits.length ? permits : undefined;
}

function convertPermitEvents(raw) {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  const events = [];
  for (const entry of raw) {
    const type = pickString(entry, ["type", "eventType", "event_type"]);
    const date = pickString(entry, ["date", "eventDate", "event_date"]);
    if (!type || !date) continue;
    events.push({
      type,
      date,
      referenceNo: pickString(entry, ["referenceNo", "reference_no"]),
      source: pickString(entry, ["source", "sourceDocRef", "source_doc_ref"])
    });
  }
  return events.length ? events : undefined;
}

function pickString(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim().length) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value === null) return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim().length) {
      const parsed = Number(value.trim());
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function pickBoolean(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
    }
  }
  return undefined;
}

function parseDateTime(value) {
  if (!value && value !== 0) {
    return null;
  }
  if (value instanceof Date) {
    return new Date(value.getTime());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseDateOnly(value) {
  const parsed = parseDateTime(value);
  if (!parsed) {
    return null;
  }
  return dateOnly(parsed);
}
*** End File
