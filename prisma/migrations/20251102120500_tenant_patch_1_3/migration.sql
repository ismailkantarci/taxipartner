-- Tenant Patch 1.3 & 1.4 — Company permits and permit events

-- CreateTable
CREATE TABLE "company_permits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "permit_type" TEXT NOT NULL,
    "issuing_authority" TEXT,
    "reference_no" TEXT,
    "permit_registered_on" DATETIME,
    "effective_from" DATETIME,
    "valid_until" DATETIME,
    "capacity_pkw" INTEGER,
    "vehicle_scoped" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    CONSTRAINT "company_permits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "company_permit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company_id" TEXT NOT NULL,
    "reference_no" TEXT,
    "event_type" TEXT NOT NULL,
    "event_date" DATETIME NOT NULL,
    "source_doc_ref" TEXT,
    "permit_id" TEXT,
    CONSTRAINT "company_permit_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies" ("company_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "company_permit_events_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "company_permits" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "company_permits_company_id_idx" ON "company_permits"("company_id");

-- CreateIndex
CREATE INDEX "company_permit_events_company_id_idx" ON "company_permit_events"("company_id");

-- CreateIndex
CREATE INDEX "company_permit_events_permit_id_idx" ON "company_permit_events"("permit_id");
