/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,legalName]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Company_tenantId_legalName_key" ON "Company"("tenantId", "legalName");
