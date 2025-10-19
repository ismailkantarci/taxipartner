import roleTemplates from '../seeds/seed_role_permissions.json' assert { type: 'json' };
export function getTemplate(role) {
    const source = roleTemplates.templates ??
        roleTemplates.default?.templates ??
        [];
    const templates = source;
    return templates.find((x) => x.role === role);
}
/**
 * Resolve a role's effective permission list by subtracting deny patterns.
 * This is a minimal resolver; in a real system you'd expand wildcards against a catalog.
 */
export function resolveEffectivePermissions(template) {
    const allow = new Set(template.allow);
    for (const d of template.deny) {
        // naive pattern remover: if an allow string startsWith deny's prefix (up to * or :write), remove it
        const writeOnly = d.includes(':write');
        const prefix = d.replace('*', '').replace(':write', '');
        for (const a of Array.from(allow)) {
            if (!prefix || !a.startsWith(prefix)) {
                continue;
            }
            if (writeOnly) {
                const isWriteLike = /write|update|approve/i.test(a);
                if (!isWriteLike) {
                    continue;
                }
            }
            allow.delete(a);
        }
    }
    return { allow: Array.from(allow) };
}
