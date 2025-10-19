import { prisma } from "../identity/src/db.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL || "ui.test@taxipartner.test";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: "dev-placeholder", mfaEnabled: false }
  });

  const tenantId = process.env.SEED_TENANT_ID || "FN-DEMO-0001";
  const tenant = await prisma.tenant.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      legalName: "TAXIPartner Demo GmbH",
      legalForm: "GmbH",
      seatAddress: "Demo Straße 1, 1010 Wien"
    }
  });

  await prisma.$transaction(async (tx) => {
    const currentIdentity = await tx.tenantIdentity.findFirst({
      where: { tenantId: tenant.tenantId, currentFlag: true }
    });
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const baseIdentity = {
      legalName: tenant.legalName,
      legalForm: tenant.legalForm,
      seatAddress: tenant.seatAddress
    };
    if (!currentIdentity) {
      await tx.tenantIdentity.create({
        data: {
          tenantId: tenant.tenantId,
          currentFlag: true,
          ...baseIdentity,
          validFrom: now
        }
      });
      return;
    }
    const differs =
      currentIdentity.legalName !== baseIdentity.legalName ||
      currentIdentity.legalForm !== baseIdentity.legalForm ||
      currentIdentity.seatAddress !== baseIdentity.seatAddress;
    if (!differs) {
      return;
    }
    await tx.tenantIdentity.update({
      where: { id: currentIdentity.id },
      data: { currentFlag: false, validTo: now }
    });
    await tx.tenantIdentity.create({
      data: {
        tenantId: tenant.tenantId,
        currentFlag: true,
        ...baseIdentity,
        validFrom: now
      }
    });
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.tenantId, userId: user.id } },
    update: { role: "Admin" },
    create: { tenantId: tenant.tenantId, userId: user.id, role: "Admin" }
  });

  console.log("[SEED] user:", user.email, "tenant:", tenant.tenantId);
  console.log("[SEED] OK – use tenantId:", tenant.tenantId, "in x-tenant-id header");
}

main()
  .catch((e) => {
    console.error("[SEED] Error:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
