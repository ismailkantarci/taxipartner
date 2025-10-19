-- Tenant Patch 1.8 — Çoklu Kimlikler (FN/UID/Steuernr/GLN/ZVR)

-- CreateTable
CREATE TABLE "tenant_ids" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "id_type" TEXT NOT NULL,
    "id_value" TEXT NOT NULL,
    "country_code" TEXT,
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    "primary_flag" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "tenant_ids_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "tenant_ids_tenant_id_idx" ON "tenant_ids"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_ids_id_type_idx" ON "tenant_ids"("id_type");

-- CreateIndex
CREATE INDEX "tenant_ids_primary_idx" ON "tenant_ids"("tenant_id", "primary_flag");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ids_unique_idx" ON "tenant_ids"("tenant_id", "id_type", "id_value", "valid_from");

-- Backfill legacy identifiers from current tenant_id values
INSERT INTO "tenant_ids" (
    "id",
    "tenant_id",
    "id_type",
    "id_value",
    "country_code",
    "valid_from",
    "valid_to",
    "primary_flag"
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
    'LEGACY',
    "tenant_id",
    NULL,
    DATE('now'),
    NULL,
    1
FROM "tenants";
