-- Generated via `prisma migrate diff`
-- Tenant Patch 1.1 — core identity tables

-- DropIndex
DROP INDEX "Company_tenantId_idx";

-- DropIndex
DROP INDEX "OU_tenantId_idx";

-- DropIndex
DROP INDEX "Tenant_code_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Company";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OU";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Tenant";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TenantUser";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "tenants" (
    "tenant_id" TEXT NOT NULL PRIMARY KEY,
    "legal_name" TEXT NOT NULL,
    "legal_form" TEXT,
    "seat_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT,

    PRIMARY KEY ("tenant_id", "user_id"),
    CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ous" (
    "ou_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    CONSTRAINT "ous_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ous_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ous" ("ou_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "companies" (
    "company_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vehicles" (
    "vehicle_id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "plate_no" TEXT,
    "seat_count" INTEGER,
    "usage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    CONSTRAINT "vehicles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanyDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "url" TEXT,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("company_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CompanyDocument" ("companyId", "createdAt", "docType", "id", "metaJson", "title", "url") SELECT "companyId", "createdAt", "docType", "id", "metaJson", "title", "url" FROM "CompanyDocument";
DROP TABLE "CompanyDocument";
ALTER TABLE "new_CompanyDocument" RENAME TO "CompanyDocument";
CREATE INDEX "CompanyDocument_companyId_idx" ON "CompanyDocument"("companyId");
CREATE TABLE "new_CompanyOfficer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    CONSTRAINT "CompanyOfficer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("company_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompanyOfficer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompanyOfficer" ("companyId", "id", "type", "userId", "validFrom", "validTo") SELECT "companyId", "id", "type", "userId", "validFrom", "validTo" FROM "CompanyOfficer";
DROP TABLE "CompanyOfficer";
ALTER TABLE "new_CompanyOfficer" RENAME TO "CompanyOfficer";
CREATE INDEX "CompanyOfficer_companyId_idx" ON "CompanyOfficer"("companyId");
CREATE TABLE "new_Shareholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "percent" REAL,
    CONSTRAINT "Shareholder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies" ("company_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Shareholder" ("companyId", "id", "percent", "personName", "roleType") SELECT "companyId", "id", "percent", "personName", "roleType" FROM "Shareholder";
DROP TABLE "Shareholder";
ALTER TABLE "new_Shareholder" RENAME TO "Shareholder";
CREATE INDEX "Shareholder_companyId_idx" ON "Shareholder"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ous_tenant_id_idx" ON "ous"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ous_tenant_id_name_key" ON "ous"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_company_id_key" ON "companies"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vin_key" ON "vehicles"("vin");
