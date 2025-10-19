const AUDIT_ROLES = [
    'Kontroller',
    'Wirtschaftsprüfer',
    'Compliance Officer',
    'Internal Auditor'
];
export function requireClaimsForAuditRoles(user, newRole) {
    if (!AUDIT_ROLES.includes(newRole)) {
        return;
    }
    const claims = user.claims ?? {};
    if (!Array.isArray(claims.tenants) || claims.tenants.length === 0) {
        throw new Error(`'${newRole}' rolü için en az bir kiracı (tenant) beyanı zorunludur.`);
    }
    if (!claims.period || !claims.period.from || !claims.period.to) {
        throw new Error(`'${newRole}' rolü için geçerli bir dönem (from/to) beyanı zorunludur.`);
    }
}
