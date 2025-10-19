import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export type RepoUser = {
  id: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  preferredLanguage?: string | null;
  preferredTheme?: string | null;
  roles: string[];
  claims?: unknown;
  mfaEnabled?: boolean;
  sessions?: string[];
};

const mem = new Map<string, RepoUser>();

function safeParse(value: string | null | undefined): unknown {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

type PrismaUserWithRelations = Prisma.UserGetPayload<{
  include: {
    roles: { include: { role: true } };
    sessions: true;
  };
}> & {
  fullName?: string | null;
  phone?: string | null;
  preferredLanguage?: string | null;
  preferredTheme?: string | null;
};

function mapDbUser(user: PrismaUserWithRelations): RepoUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName ?? null,
    phone: user.phone ?? null,
    preferredLanguage: user.preferredLanguage ?? null,
    preferredTheme: user.preferredTheme ?? null,
    roles: user.roles.map((entry) => entry.role.name),
    claims: safeParse(user.claimsJson ?? undefined),
    mfaEnabled: user.mfaEnabled ?? undefined,
    sessions: user.sessions.filter((s) => !s.revoked).map((s) => s.id)
  };
}

export async function repoListUsers(q?: string, skip = 0, take = 50): Promise<RepoUser[]> {
  try {
    const users = await prisma.user.findMany({
      skip,
      take,
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { id: { contains: q } }
            ]
          }
        : undefined,
      include: {
        roles: { include: { role: true } },
        sessions: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return users.map((user) => mapDbUser(user));
  } catch (error) {
    const values = Array.from(mem.values());
    const filtered = q
      ? values.filter((user) =>
          [user.email ?? '', user.id]
            .join(' ')
            .toLowerCase()
            .includes(q.toLowerCase())
        )
      : values;
    return filtered.slice(skip, skip + take);
  }
}

export async function repoCountUsers(q?: string): Promise<number> {
  try {
    return prisma.user.count({
      where: q
        ? {
            OR: [
              { email: { contains: q } },
              { id: { contains: q } }
            ]
          }
        : undefined
    });
  } catch (error) {
    const values = Array.from(mem.values());
    if (!q) {
      return values.length;
    }
    const query = q.toLowerCase();
    return values.filter((user) =>
      [user.email ?? '', user.id]
        .join(' ')
        .toLowerCase()
        .includes(query)
    ).length;
  }
}

export async function repoGetUser(id: string): Promise<RepoUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
        sessions: true
      }
    });
    if (!user) {
      return null;
    }
    return mapDbUser(user);
  } catch (error) {
    return mem.get(id) ?? null;
  }
}

export async function repoCreateUser(email?: string): Promise<RepoUser> {
  try {
    const user = await prisma.user.create({
      data: {
        email: email ?? `user${Date.now()}@example.com`,
        password: 'dev-placeholder'
      },
      include: { roles: { include: { role: true } }, sessions: true }
    });
    return mapDbUser(user);
  } catch (error) {
    const id = `mem_${Math.random().toString(36).slice(2)}`;
    const repoUser: RepoUser = {
      id,
      email: email ?? `user${Date.now()}@example.com`,
      roles: [],
      mfaEnabled: false,
      sessions: []
    };
    mem.set(id, repoUser);
    return repoUser;
  }
}

export async function repoSaveUser(user: RepoUser): Promise<RepoUser> {
  try {
    const updates: Promise<unknown>[] = [];
    const userData: {
      claimsJson?: string | null;
      mfaEnabled?: boolean;
      fullName?: string | null;
      phone?: string | null;
      preferredLanguage?: string | null;
      preferredTheme?: string | null;
    } = {};

    if (user.claims !== undefined) {
      userData.claimsJson = user.claims ? JSON.stringify(user.claims) : null;
    }
    if (user.mfaEnabled !== undefined) {
      userData.mfaEnabled = user.mfaEnabled;
    }
    if (user.fullName !== undefined) {
      userData.fullName = user.fullName ?? null;
    }
    if (user.phone !== undefined) {
      userData.phone = user.phone ?? null;
    }
    if (user.preferredLanguage !== undefined) {
      userData.preferredLanguage = user.preferredLanguage ?? null;
    }
    if (user.preferredTheme !== undefined) {
      userData.preferredTheme = user.preferredTheme ?? null;
    }

    if (Object.keys(userData).length > 0) {
      updates.push(prisma.user.update({ where: { id: user.id }, data: userData }));
    }

    if (Array.isArray(user.roles)) {
      updates.push(
        (async () => {
          const dbRoles = await prisma.role.findMany({ where: { name: { in: user.roles } } });
          const roleIds = new Set(dbRoles.map((role) => role.id));

          const existing = await prisma.userRole.findMany({ where: { userId: user.id } });
          const existingIds = new Set(existing.map((entry) => entry.roleId));

          const toAdd = [...roleIds].filter((roleId) => !existingIds.has(roleId));
          const toRemove = [...existingIds].filter((roleId) => !roleIds.has(roleId));

          const operations = [
            ...toAdd.map((roleId) =>
              prisma.userRole.create({ data: { userId: user.id, roleId } })
            ),
            ...toRemove.map((roleId) =>
              prisma.userRole.delete({ where: { userId_roleId: { userId: user.id, roleId } } })
            )
          ];

          if (operations.length > 0) {
            await prisma.$transaction(operations);
          }
        })()
      );
    }

    if (user.sessions && user.sessions.length === 0) {
      updates.push(
        prisma.session.updateMany({
          where: { userId: user.id, revoked: false },
          data: { revoked: true }
        })
      );
    }

    await Promise.all(updates);

    return repoGetUser(user.id).then((updated) => updated ?? user);
  } catch (error) {
    mem.set(user.id, { ...mem.get(user.id), ...user } as RepoUser);
    return user;
  }
}

export function repoUpsertUser(user: RepoUser): void {
  mem.set(user.id, user);
}

export async function repoRemoveUserRole(userId: string, roleName: string) {
  try {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return false;
    }
    await prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId: role.id } }
    });
    return true;
  } catch (error: unknown) {
    const prismaError = error as { code?: string } | undefined;
    if (prismaError?.code === 'P2025') {
      return false;
    }
    const user = mem.get(userId);
    if (!user) {
      return false;
    }
    user.roles = (user.roles || []).filter((role) => role !== roleName);
    mem.set(userId, user);
    return true;
  }
}
