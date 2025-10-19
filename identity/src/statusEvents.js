export async function recordStatusEvent(tx, payload) {
  const { tenantId = null, entityType, entityId, status = null, validTo = null, note = null } = payload;
  await tx.entityStatusEvent.create({
    data: {
      tenantId,
      entityType,
      entityId,
      status,
      validTo,
      note
    }
  });
}

export function computeValidTo(status, referenceDate) {
  if (!status) {
    return null;
  }
  if (typeof status === "string" && status.trim().toLowerCase() === "active") {
    return null;
  }
  return referenceDate;
}

export function dateOnly(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
