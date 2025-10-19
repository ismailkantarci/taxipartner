import matrix from '../seeds/role_incompatible.json' assert { type: 'json' };
import { requireClaimsForAuditRoles } from './claims.js';
import { TAG, roleHasPolicyTag } from './permissions.js';
const incompatMatrix = matrix;
const exclusives = new Set(incompatMatrix.exclusive);
const operationalRoles = new Set(TAG.ANY_OPERATIONAL);
const WRITE_TAGS = new Set(['Identity-Write', 'Finance-Write', 'Operations-Write']);
export function isExclusive(role) {
    return exclusives.has(role);
}
function roleHasAnyWrite(role) {
    for (const tag of WRITE_TAGS) {
        if (roleHasPolicyTag(role, tag)) {
            return true;
        }
    }
    return false;
}
function matchesCondition(role, condition) {
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
export function conflicts(roleA, roleB) {
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
export function assignRole(user, newRole) {
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
    const updatedUser = {
        ...user,
        roles: [...user.roles, newRole],
        mfaEnabled: true,
        sessions: []
    };
    return updatedUser;
}
