-- Tenant Patch 1.13 — Attachments (FN/GISA PDF Arşivi)

-- CreateTable Party already exists (from previous patch).

CREATE TABLE "officers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "level" TEXT NOT NULL,
    "tenant_id" TEXT,
    "company_id" TEXT,
    "party_id" TEXT NOT NULL,
    "officer_type" TEXT NOT NULL,
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    CONSTRAINT "officers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "officers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "officers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Vehicle Assignments
CREATE TABLE "vehicle_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicle_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "assigned_from" DATETIME NOT NULL,
    "assigned_to" DATETIME,
    "approval_id" TEXT,
    CONSTRAINT "vehicle_assignments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("vehicle_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicle_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicle_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Driver Assignments
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "party_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "assigned_from" DATETIME NOT NULL,
    "assigned_to" DATETIME,
    "approval_id" TEXT,
    CONSTRAINT "driver_assignments_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party" ("party_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "driver_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "driver_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable Approvals
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "object_id" TEXT,
    "op" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
    "idempotency_key" TEXT,
    "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT "approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "officers_tenant_id_idx" ON "officers"("tenant_id");
CREATE INDEX "officers_company_id_idx" ON "officers"("company_id");
CREATE INDEX "officers_party_id_idx" ON "officers"("party_id");

CREATE INDEX "vehicle_assignments_vehicle_id_idx" ON "vehicle_assignments"("vehicle_id");
CREATE INDEX "vehicle_assignments_tenant_id_idx" ON "vehicle_assignments"("tenant_id");
CREATE INDEX "vehicle_assignments_company_id_idx" ON "vehicle_assignments"("company_id");

CREATE INDEX "driver_assignments_party_id_idx" ON "driver_assignments"("party_id");
CREATE INDEX "driver_assignments_tenant_id_idx" ON "driver_assignments"("tenant_id");
CREATE INDEX "driver_assignments_company_id_idx" ON "driver_assignments"("company_id");

CREATE INDEX "approvals_tenant_id_idx" ON "approvals"("tenant_id");

CREATE UNIQUE INDEX "approvals_idempotency_key_key" ON "approvals"("idempotency_key");

-- CreateTable Attachments
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "attachment_type" TEXT NOT NULL,
    "file_ref" TEXT NOT NULL,
    "issued_at" DATETIME,
    "source_url" TEXT,
    "created_at" DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX "attachments_owner_idx" ON "attachments"("owner_type", "owner_id");
