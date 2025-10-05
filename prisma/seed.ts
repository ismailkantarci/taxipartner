import { PrismaClient } from '@prisma/client';
import seedRoles from '../identity/seeds/seed_roles.json' assert { type: 'json' };
import { hash as hashPassword } from '../identity/src/crypto.ts';

const prisma = new PrismaClient();

async function main() {
  for (const role of (seedRoles as any).roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        scope: role.scope,
        isSystem: !!role.is_system,
        isExclusive: !!role.is_exclusive,
        template: !!role.template
      },
      create: {
        name: role.name,
        scope: role.scope,
        isSystem: !!role.is_system,
        isExclusive: !!role.is_exclusive,
        template: !!role.template
      }
    });
  }

  const passwordHash = await hashPassword('Admin!234');

  const demoUser = await prisma.user.upsert({
    where: { email: 'admin@taxipartner.test' },
    update: {
      password: passwordHash
    },
    create: {
      email: 'admin@taxipartner.test',
      password: passwordHash
    }
  });

  const adminRole = await prisma.role.findFirst({ where: { name: 'Superadmin' } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demoUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: demoUser.id, roleId: adminRole.id }
    });
  }

  console.log('Seed completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
