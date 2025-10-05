import matrix from '../seeds/role_incompatible.json' assert { type: 'json' };

import { requireClaimsForAuditRoles } from './claims.js';
import { TAG, roleHasPolicyTag } from './permissions.js';
import type { RoleName, User } from './types.js';

interface RoleIncompatMatrix {
  exclusive: string[];
  pairs: [string, string][];
}

const incompatMatrix = matrix as RoleIncompatMatrix;
const exclusives = new Set(incompatMatrix.exclusive as RoleName[]);
const operationalRoles = new Set<RoleName>(TAG.ANY_OPERATIONAL);
const WRITE_TAGS = new Set(['Identity-Write', 'Finance-Write', 'Operations-Write']);

export function isExclusive(role: RoleName): boolean {
  return exclusives.has(role);
}

function roleHasAnyWrite(role: RoleName): boolean {
  for (const tag of WRITE_TAGS) {
    if (roleHasPolicyTag(role, tag)) {
      return true;
    }
  }
  return false;
}

function matchesCondition(role: RoleName, condition: string): boolean {
  if (condition === role) {
    return true;
  }

  if (condition === 'ANY_OPERATIONAL') {
    return operationalRoles.has(role);
  }

  if (condition === 'ANY_WRITE') {
    return roleHasAnyWrite(role);
  }

  if (WRITE_TAGS.has(condition)) {
    return roleHasPolicyTag(role, condition);
  }

  return false;
}

export function conflicts(roleA: RoleName, roleB: RoleName): boolean {
  for (const [left, right] of incompatMatrix.pairs) {
    if (matchesCondition(roleA, left) && matchesCondition(roleB, right)) {
      return true;
    }
    if (matchesCondition(roleB, left) && matchesCondition(roleA, right)) {
      return true;
    }
  }
  return false;
}

export function assignRole(user: User, newRole: RoleName): User {
  if (user.roles.includes(newRole)) {
    return user;
  }

  if (isExclusive(newRole) && user.roles.length > 0) {
    throw new Error(`'${newRole}' rolü tekil olduğu için mevcut rollerle birlikte atanamaz.`);
  }

  for (const existing of user.roles) {
    if (conflicts(existing, newRole)) {
      throw new Error(`'${existing}' ile '${newRole}' birlikte atanamaz.`);
    }
  }

  const existingExclusive = user.roles.find(isExclusive);
  if (existingExclusive) {
    throw new Error(`'${existingExclusive}' rolüne sahip kullanıcıya başka rol atanamaz.`);
  }

  requireClaimsForAuditRoles(user, newRole);

  const updatedUser: User = {
    ...user,
    roles: [...user.roles, newRole],
    mfaEnabled: true,
    sessions: []
  };

  return updatedUser;
}
