-- Tenant Patch 1.14 — Doğrulama/Kısıtlar & Soft-Delete Politikası

-- Add valid_to columns for soft-delete policy
ALTER TABLE "tenants" ADD COLUMN "valid_to" DATETIME;
ALTER TABLE "companies" ADD COLUMN "valid_to" DATETIME;
ALTER TABLE "vehicles" ADD COLUMN "valid_to" DATETIME;

-- Event log for archival/status transitions
CREATE TABLE "entity_status_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "status" TEXT,
    "valid_to" DATETIME,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CONSTRAINT "entity_status_events_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id")
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX "entity_status_events_tenant_id_idx" ON "entity_status_events"("tenant_id");
CREATE INDEX "entity_status_events_entity_lookup_idx" ON "entity_status_events"("entity_type", "entity_id");

-- Ensure vehicle plate numbers are unique per tenant
CREATE UNIQUE INDEX "vehicles_tenant_id_plate_no_key" ON "vehicles"("tenant_id", "plate_no");

-- Regex validation triggers for tenant identifiers (FN/GISA/UID)
CREATE TRIGGER "tenant_ids_fn_format_insert"
BEFORE INSERT ON "tenant_ids"
WHEN NEW."id_type" = 'FN' AND NEW."id_value" NOT GLOB 'FN[0-9][0-9][0-9][0-9][0-9][0-9][A-Z0-9]?'
BEGIN
    SELECT RAISE(FAIL, 'Invalid FN format');
END;

CREATE TRIGGER "tenant_ids_fn_format_update"
BEFORE UPDATE ON "tenant_ids"
WHEN NEW."id_type" = 'FN' AND NEW."id_value" NOT GLOB 'FN[0-9][0-9][0-9][0-9][0-9][0-9][A-Z0-9]?'
BEGIN
    SELECT RAISE(FAIL, 'Invalid FN format');
END;

CREATE TRIGGER "tenant_ids_gisa_format_insert"
BEFORE INSERT ON "tenant_ids"
WHEN NEW."id_type" = 'GISA' AND NEW."id_value" NOT GLOB 'GISA[0-9][0-9][0-9][0-9][0-9]*'
BEGIN
    SELECT RAISE(FAIL, 'Invalid GISA format');
END;

CREATE TRIGGER "tenant_ids_gisa_format_update"
BEFORE UPDATE ON "tenant_ids"
WHEN NEW."id_type" = 'GISA' AND NEW."id_value" NOT GLOB 'GISA[0-9][0-9][0-9][0-9][0-9]*'
BEGIN
    SELECT RAISE(FAIL, 'Invalid GISA format');
END;

CREATE TRIGGER "tenant_ids_uid_format_insert"
BEFORE INSERT ON "tenant_ids"
WHEN NEW."id_type" = 'UID' AND NEW."id_value" NOT GLOB 'ATU[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
    SELECT RAISE(FAIL, 'Invalid UID format');
END;

CREATE TRIGGER "tenant_ids_uid_format_update"
BEFORE UPDATE ON "tenant_ids"
WHEN NEW."id_type" = 'UID' AND NEW."id_value" NOT GLOB 'ATU[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
BEGIN
    SELECT RAISE(FAIL, 'Invalid UID format');
END;
