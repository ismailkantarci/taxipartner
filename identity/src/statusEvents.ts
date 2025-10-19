import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike =
  | Pick<PrismaClient, "entityStatusEvent">
  | Pick<Prisma.TransactionClient, "entityStatusEvent">;

export type StatusEventPayload = {
  tenantId?: string | null;
  entityType: string;
  entityId: string;
  status?: string | null;
  validTo?: Date | null;
  note?: string | null;
};

export async function recordStatusEvent(tx: PrismaLike, payload: StatusEventPayload) {
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

export function computeValidTo(status: string | null | undefined, referenceDate: Date): Date | null {
  if (!status) {
    return null;
  }
  if (status.trim().toLowerCase() === "active") {
    return null;
  }
  return referenceDate;
}

export function dateOnly(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
