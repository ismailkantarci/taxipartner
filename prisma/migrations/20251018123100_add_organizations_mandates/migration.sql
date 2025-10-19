/*
  Warnings:

  - You are about to alter the column `einlage_amount` on the `shareholdings` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.
  - You are about to alter the column `quota_percent` on the `shareholdings` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Float`.

*/
-- CreateTable
CREATE TABLE "organizations" (
    "org_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "description" TEXT,
    "parent_id" TEXT,
    "company_id" TEXT,
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    "meta_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "organizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "organizations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizations" ("org_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mandates" (
    "mandate_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "company_id" TEXT,
    "title" TEXT NOT NULL,
    "mandate_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    "notes" TEXT,
    "meta_json" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "mandates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mandates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("org_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "object_id" TEXT,
    "op" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_approvals" ("created_at", "id", "idempotency_key", "object_id", "op", "payload", "scope", "status", "tenant_id") SELECT coalesce("created_at", CURRENT_TIMESTAMP) AS "created_at", "id", "idempotency_key", "object_id", "op", "payload", "scope", "status", "tenant_id" FROM "approvals";
DROP TABLE "approvals";
ALTER TABLE "new_approvals" RENAME TO "approvals";
CREATE UNIQUE INDEX "approvals_idempotency_key_key" ON "approvals"("idempotency_key");
CREATE INDEX "approvals_tenant_id_idx" ON "approvals"("tenant_id");
CREATE TABLE "new_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "file_ref" TEXT NOT NULL,
    "issued_at" DATETIME,
    "source_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_attachments" ("attachment_type", "created_at", "file_ref", "id", "issued_at", "owner_id", "owner_type", "source_url") SELECT "attachment_type", coalesce("created_at", CURRENT_TIMESTAMP) AS "created_at", "file_ref", "id", "issued_at", "owner_id", "owner_type", "source_url" FROM "attachments";
DROP TABLE "attachments";
ALTER TABLE "new_attachments" RENAME TO "attachments";
CREATE INDEX "attachments_owner_type_owner_id_idx" ON "attachments"("owner_type", "owner_id");
CREATE TABLE "new_shareholdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role_type" TEXT NOT NULL,
    "quota_percent" REAL,
    "einlage_amount" REAL,
    "liability" TEXT,
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    CONSTRAINT "shareholdings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shareholdings_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_shareholdings" ("einlage_amount", "id", "liability", "party_id", "quota_percent", "role_type", "tenant_id", "valid_from", "valid_to") SELECT "einlage_amount", "id", "liability", "party_id", "quota_percent", "role_type", "tenant_id", "valid_from", "valid_to" FROM "shareholdings";
DROP TABLE "shareholdings";
ALTER TABLE "new_shareholdings" RENAME TO "shareholdings";
CREATE INDEX "shareholdings_tenant_id_idx" ON "shareholdings"("tenant_id");
CREATE INDEX "shareholdings_party_id_idx" ON "shareholdings"("party_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "organizations_tenant_id_idx" ON "organizations"("tenant_id");

-- CreateIndex
CREATE INDEX "organizations_tenant_id_status_idx" ON "organizations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "organizations_parent_id_idx" ON "organizations"("parent_id");

-- CreateIndex
CREATE INDEX "organizations_company_id_idx" ON "organizations"("company_id");

-- CreateIndex
CREATE INDEX "mandates_tenant_id_idx" ON "mandates"("tenant_id");

-- CreateIndex
CREATE INDEX "mandates_tenant_id_status_idx" ON "mandates"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "mandates_organization_id_idx" ON "mandates"("organization_id");

-- CreateIndex
CREATE INDEX "mandates_company_id_idx" ON "mandates"("company_id");

-- RedefineIndex
DROP INDEX "entity_status_events_entity_lookup_idx";
CREATE INDEX "entity_status_events_entity_type_entity_id_idx" ON "entity_status_events"("entity_type", "entity_id");

-- RedefineIndex
DROP INDEX "tenant_identity_current_idx";
CREATE INDEX "tenant_identity_tenant_id_current_flag_idx" ON "tenant_identity"("tenant_id", "current_flag");

-- RedefineIndex
DROP INDEX "tenant_ids_unique_idx";
CREATE UNIQUE INDEX "tenant_ids_tenant_id_id_type_id_value_valid_from_key" ON "tenant_ids"("tenant_id", "id_type", "id_value", "valid_from");

-- RedefineIndex
DROP INDEX "tenant_ids_primary_idx";
CREATE INDEX "tenant_ids_tenant_id_primary_flag_idx" ON "tenant_ids"("tenant_id", "primary_flag");
