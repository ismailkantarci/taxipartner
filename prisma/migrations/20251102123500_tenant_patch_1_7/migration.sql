-- Tenant Patch 1.7 — Kurumsal İşlemler (Umwandlung/Verschmelzung/Spaltung)

-- CreateTable
CREATE TABLE "corporate_actions" (
    "action_id" TEXT NOT NULL PRIMARY KEY,
    "action_type" TEXT NOT NULL,
    "effective_date" DATETIME NOT NULL,
    "source_tenant_ids" TEXT NOT NULL,
    "target_tenant_id" TEXT NOT NULL,
    "note" TEXT,
    CONSTRAINT "corporate_actions_target_tenant_id_fkey"
      FOREIGN KEY ("target_tenant_id") REFERENCES "tenants" ("tenant_id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "corporate_actions_target_tenant_id_idx" ON "corporate_actions"("target_tenant_id");

-- CreateIndex
CREATE INDEX "corporate_actions_effective_date_idx" ON "corporate_actions"("effective_date");
