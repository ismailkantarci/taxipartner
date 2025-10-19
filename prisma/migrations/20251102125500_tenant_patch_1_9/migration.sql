-- Tenant Patch 1.9 — Party & Gesellschafter (Shareholding)

-- CreateTable
CREATE TABLE "party" (
    "party_id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "shareholdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role_type" TEXT NOT NULL,
    "quota_percent" DECIMAL,
    "einlage_amount" DECIMAL,
    "liability" TEXT,
    "valid_from" DATETIME,
    "valid_to" DATETIME,
    CONSTRAINT "shareholdings_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shareholdings_party_id_fkey"
      FOREIGN KEY ("party_id") REFERENCES "party" ("party_id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "shareholdings_tenant_id_idx" ON "shareholdings"("tenant_id");

-- CreateIndex
CREATE INDEX "shareholdings_party_id_idx" ON "shareholdings"("party_id");
