-- Tenant Patch 1.6 — Tenant Kimlik Tarihçesi (SCD2)

-- CreateTable
CREATE TABLE "tenant_identity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "current_flag" BOOLEAN NOT NULL DEFAULT false,
    "legal_name" TEXT,
    "legal_form" TEXT,
    "seat_address" TEXT,
    "valid_from" DATE,
    "valid_to" DATE,
    CONSTRAINT "tenant_identity_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "tenant_identity_tenant_id_idx" ON "tenant_identity"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_identity_current_idx" ON "tenant_identity"("tenant_id", "current_flag");

-- Ensure single current record per tenant
CREATE UNIQUE INDEX "tenant_identity_current_unique" ON "tenant_identity"("tenant_id") WHERE "current_flag";

-- Backfill current identity rows from existing tenants
INSERT INTO "tenant_identity" (
    "id",
    "tenant_id",
    "current_flag",
    "legal_name",
    "legal_form",
    "seat_address",
    "valid_from",
    "valid_to"
)
SELECT
    lower(
        hex(randomblob(4)) || '-' ||
        hex(randomblob(2)) || '-' ||
        hex(randomblob(2)) || '-' ||
        hex(randomblob(2)) || '-' ||
        hex(randomblob(6))
    ) AS "id",
    "tenant_id",
    1,
    "legal_name",
    "legal_form",
    "seat_address",
    DATE("created_at"),
    NULL
FROM "tenants";
