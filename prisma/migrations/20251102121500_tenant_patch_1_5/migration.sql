-- Tenant Patch 1.5 — Vehicle authorizations binding

-- CreateTable
CREATE TABLE "vehicle_authorizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "permit_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "vin" TEXT NOT NULL,
    "authorized_on" DATETIME NOT NULL,
    "revoked_on" DATETIME,
    CONSTRAINT "vehicle_authorizations_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "company_permits" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicle_authorizations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles" ("vehicle_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "vehicle_authorizations_vehicle_id_idx" ON "vehicle_authorizations"("vehicle_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_authorizations_permit_id_vin_key" ON "vehicle_authorizations"("permit_id", "vin");
