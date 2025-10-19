import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";
import { importOfficialRegisters } from "../src/importers/fnGisaImporter.js";

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

class MockPrisma {
  tenants = new Map<string, any>();
  tenantIdentifiers: any[] = [];
  tenantIdentities: any[] = [];
  attachments: any[] = [];
  companies = new Map<string, any>();
  companyPermits = new Map<string, any>();
  companyPermitEvents: any[] = [];
  statusEvents: any[] = [];

  tenant = {
    findUnique: async ({ where }: any) => this.tenants.get(where.tenantId) ?? null,
    create: async ({ data }: any) => {
      const record = { ...data };
      this.tenants.set(record.tenantId, record);
      return { ...record };
    },
    update: async ({ where, data }: any) => {
      const existing = this.tenants.get(where.tenantId);
      if (!existing) throw new Error("tenant not found");
      const updated = { ...existing, ...data };
      this.tenants.set(where.tenantId, updated);
      return { ...updated };
    }
  };

  tenantIdentifier = {
    findFirst: async ({ where }: any) =>
      this.tenantIdentifiers.find(
        (item) =>
          item.tenantId === where.tenantId &&
          item.idType === where.idType &&
          item.idValue === where.idValue &&
          item.validFrom.getTime() === where.validFrom.getTime()
      ) ?? null,
    updateMany: async ({ where, data }: any) => {
      this.tenantIdentifiers = this.tenantIdentifiers.map((item) =>
        item.tenantId === where.tenantId ? { ...item, ...data } : item
      );
      return { count: this.tenantIdentifiers.length };
    },
    create: async ({ data }: any) => {
      const record = { id: nextId("tid"), ...data };
      this.tenantIdentifiers.push(record);
      return { ...record };
    },
    update: async ({ where, data }: any) => {
      const index = this.tenantIdentifiers.findIndex((item) => item.id === where.id);
      if (index === -1) throw new Error("tenant identifier missing");
      const updated = { ...this.tenantIdentifiers[index], ...data };
      this.tenantIdentifiers[index] = updated;
      return { ...updated };
    }
  };

  tenantIdentity = {
    deleteMany: async ({ where }: any) => {
      this.tenantIdentities = this.tenantIdentities.filter((item) => item.tenantId !== where.tenantId);
      return { count: this.tenantIdentities.length };
    },
    create: async ({ data }: any) => {
      const record = { id: nextId("tidentity"), ...data };
      this.tenantIdentities.push(record);
      return { ...record };
    }
  };

  attachment = {
    findFirst: async ({ where }: any) =>
      this.attachments.find(
        (item) => item.ownerType === where.ownerType && item.ownerId === where.ownerId && item.fileRef === where.fileRef
      ) ?? null,
    create: async ({ data }: any) => {
      const record = { id: nextId("att"), ...data };
      this.attachments.push(record);
      return { ...record };
    }
  };

  company = {
    findUnique: async ({ where }: any) => this.companies.get(where.companyId) ?? null,
    create: async ({ data }: any) => {
      const record = { ...data };
      this.companies.set(record.companyId, record);
      return { ...record };
    },
    update: async ({ where, data }: any) => {
      const existing = this.companies.get(where.companyId);
      if (!existing) throw new Error("company missing");
      const updated = { ...existing, ...data };
      this.companies.set(where.companyId, updated);
      return { ...updated };
    }
  };

  companyPermit = {
    findFirst: async ({ where }: any) =>
      Array.from(this.companyPermits.values()).find(
        (item) =>
          item.companyId === where.companyId &&
          item.permitType === where.permitType &&
          item.referenceNo === where.referenceNo
      ) ?? null,
    create: async ({ data }: any) => {
      const record = { id: nextId("permit"), ...data };
      this.companyPermits.set(record.id, record);
      return { ...record };
    },
    update: async ({ where, data }: any) => {
      const existing = this.companyPermits.get(where.id);
      if (!existing) throw new Error("permit missing");
      const updated = { ...existing, ...data };
      this.companyPermits.set(where.id, updated);
      return { ...updated };
    }
  };

  companyPermitEvent = {
    findFirst: async ({ where }: any) =>
      this.companyPermitEvents.find(
        (item) =>
          item.companyId === where.companyId &&
          item.permitId === where.permitId &&
          item.eventType === where.eventType &&
          item.eventDate.getTime() === where.eventDate.getTime()
      ) ?? null,
    create: async ({ data }: any) => {
      const record = { id: nextId("pevent"), ...data };
      this.companyPermitEvents.push(record);
      return { ...record };
    }
  };

  entityStatusEvent = {
    create: async ({ data }: any) => {
      const record = { id: nextId("sevent"), ...data };
      this.statusEvents.push(record);
      return { ...record };
    }
  };

  async $transaction(cb: (client: this) => Promise<any>) {
    return cb(this);
  }
}

test("importOfficialRegisters builds tenants, companies and permits", async () => {
  const mock = new MockPrisma();
  const bundle = {
    firmenbuch: [
      {
        fn: "FN123456Z",
        legalName: "Taxi Muster GmbH",
        legalForm: "GmbH",
        seatAddress: "Heldenplatz 1, 1010 Wien",
        identifiers: [
          { type: "FN", value: "FN123456Z", primary: true },
          { type: "UID", value: "ATU99999999" }
        ],
        identities: [
          { legalName: "Taxi Muster GmbH", legalForm: "GmbH", seatAddress: "Heldenplatz 1, 1010 Wien", validFrom: "2023-01-01" },
          { legalName: "Taxi Muster GmbH & Co KG", legalForm: "KG", seatAddress: "Heldenplatz 2, 1010 Wien", validFrom: "2024-01-01" }
        ],
        attachments: [
          { type: "FIRMBUCH_AUSZUG", fileRef: "fb-2024.pdf", issuedAt: "2024-01-05" }
        ]
      }
    ],
    gisa: [
      {
        gisa: "GISA123456789",
        fn: "FN123456Z",
        legalName: "Taxi Muster Standort Innenstadt",
        address: "Opernring 5, 1010 Wien",
        status: "Active",
        attachments: [{ type: "GISA_AUSZUG", fileRef: "gisa-standort.pdf" }],
        permits: [
          {
            type: "Taxi",
            issuingAuthority: "MA65",
            referenceNo: "TAX-2024-01",
            registeredOn: "2024-01-02",
            events: [
              { type: "REGISTERED", date: "2024-01-02" },
              { type: "ACTIVE", date: "2024-02-01" }
            ],
            attachments: [{ type: "WKO_ZULASSUNGSBESTAETIGUNG", fileRef: "zulassung.pdf" }]
          }
        ]
      }
    ]
  };

  const report = await importOfficialRegisters({ bundle }, mock as unknown as PrismaClient);

  const tenant = mock.tenants.get("FN123456Z");
  assert.ok(tenant, "tenant should exist");
  assert.equal(tenant.legalName, "Taxi Muster GmbH");
  assert.equal(mock.tenantIdentifiers.length, 2);
  const primary = mock.tenantIdentifiers.find((item) => item.primaryFlag);
  assert.equal(primary?.idType, "FN");
  assert.equal(mock.tenantIdentities.length, 2);
  const currentIdentity = mock.tenantIdentities.find((item) => item.currentFlag);
  assert.ok(currentIdentity);
  assert.equal(currentIdentity?.legalForm, "KG");

  const company = mock.companies.get("GISA123456789");
  assert.ok(company, "company should exist");
  assert.equal(company?.tenantId, "FN123456Z");
  assert.equal(company?.status, "Active");
  assert.equal(mock.attachments.length, 3);
  const attachmentOwners = new Set(mock.attachments.map((item) => item.ownerType));
  assert.ok(attachmentOwners.has("TENANT"));
  assert.ok(attachmentOwners.has("COMPANY"));
  assert.ok(attachmentOwners.has("COMPANY_PERMIT"));

  assert.equal(mock.companyPermits.size, 1);
  assert.equal(mock.companyPermitEvents.length, 2);
  assert.ok(mock.statusEvents.some((item) => item.entityType === "COMPANY"));

  assert.deepEqual(report, {
    dryRun: false,
    tenantsCreated: 1,
    tenantsUpdated: 0,
    companiesCreated: 1,
    companiesUpdated: 0,
    permitsUpserted: 1,
    permitEventsCreated: 2,
    attachmentsCreated: 3
  });
});
