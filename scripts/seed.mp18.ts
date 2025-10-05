import { prisma } from "../identity/src/db.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL || "ui.test@taxipartner.test";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password: "dev-placeholder", mfaEnabled: false }
  });

  const tcode = process.env.SEED_TENANT_CODE || "tp-demo";
  const tenant = await prisma.tenant.upsert({
    where: { code: tcode },
    update: {},
    create: { code: tcode, name: "TAXIPartner Demo" }
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: "Admin" },
    create: { tenantId: tenant.id, userId: user.id, role: "Admin" }
  });

  console.log("[SEED] user:", user.email, "tenant:", tenant.code);
  console.log("[SEED] OK – use tenantId:", tenant.id, "in x-tenant-id header");
}

main()
  .catch((e) => {
    console.error("[SEED] Error:", e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
