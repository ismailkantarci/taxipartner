import { prisma } from "../identity/src/db.js";
import { hash } from "../identity/src/crypto.js";

async function main() {
  const email = process.env.SEED_USER_EMAIL || "ui.test@taxipartner.test";
  const passwordHash = await hash(process.env.SEED_USER_PASSWORD || "Admin!234");
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      mfaEnabled: false,
      mfaSecret: null
    },
    create: { email, password: passwordHash, mfaEnabled: false }
  });

  const code = process.env.SEED_TENANT_CODE || "tp-demo";
  const tenant = await prisma.tenant.upsert({
    where: { code },
    update: {},
    create: { code, name: "TAXIPartner Demo" }
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: "Admin" },
    create: { tenantId: tenant.id, userId: user.id, role: "Admin" }
  });

  console.log("[SEED] user:", user.email, "tenant:", tenant.code, "tenantId:", tenant.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
