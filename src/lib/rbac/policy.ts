import { useMemo } from 'react';

/**
 * Permission keys follow the pattern `<domain>.<resource>.<action>`
 * to make grouping easier across modules.
 */
export type PermissionKey =
  | 'program.goals.read'
  | 'program.goals.write'
  | 'program.goals.delete'
  | 'program.goals.import'
  | 'program.goals.export'
  | 'program.audits.read'
  | 'program.audits.write'
  | 'program.audits.delete'
  | 'compliance.read'
  | 'compliance.write'
  | 'compliance.delete'
  | 'risk.read'
  | 'risk.write'
  | 'risk.delete'
  | 'iam.users.read'
  | 'iam.roles.read'
  | 'iam.permissions.read'
  | 'iam.sessions.read'
  | 'tenants.manage'
  | 'reports.auditLogs.read'
  | 'system.devtools'
  | 'system.settings.read'
  | 'system.settings.write'
  | 'audit.read';

export const PERMISSIONS: PermissionKey[] = [
  'program.goals.read',
  'program.goals.write',
  'program.goals.delete',
  'program.goals.import',
  'program.goals.export',
  'program.audits.read',
  'program.audits.write',
  'program.audits.delete',
  'compliance.read',
  'compliance.write',
  'compliance.delete',
  'risk.read',
  'risk.write',
  'risk.delete',
  'iam.users.read',
  'iam.roles.read',
  'iam.permissions.read',
  'iam.sessions.read',
  'tenants.manage',
  'reports.auditLogs.read',
  'system.devtools',
  'system.settings.read',
  'system.settings.write',
  'audit.read'
];

export type RoleId = 'superAdmin' | 'tenantAdmin' | 'complianceOfficer' | 'auditor';

export type TenantScopedPermission =
  | 'program.goals.read'
  | 'program.goals.write'
  | 'program.goals.delete'
  | 'program.goals.import'
  | 'program.goals.export'
  | 'program.audits.read'
  | 'program.audits.write'
  | 'program.audits.delete'
  | 'compliance.read'
  | 'compliance.write'
  | 'compliance.delete'
  | 'risk.read'
  | 'risk.write'
  | 'risk.delete'
  | 'iam.users.read'
  | 'iam.roles.read'
  | 'iam.permissions.read'
  | 'iam.sessions.read'
  | 'tenants.manage'
  | 'system.settings.read'
  | 'system.settings.write'
  | 'audit.read';

const TENANT_SCOPED: Set<PermissionKey> = new Set<TenantScopedPermission>([
  'program.goals.read',
  'program.goals.write',
  'program.goals.delete',
  'program.goals.import',
  'program.goals.export',
  'program.audits.read',
  'program.audits.write',
  'program.audits.delete',
  'compliance.read',
  'compliance.write',
  'compliance.delete',
  'risk.read',
  'risk.write',
  'risk.delete',
  'iam.users.read',
  'iam.roles.read',
  'iam.permissions.read',
  'iam.sessions.read',
  'tenants.manage',
  'system.settings.read',
  'system.settings.write',
  'audit.read'
]);

export type RbacUser = {
  id: string;
  name: string;
  role: RoleId;
  tenantIds: string[];
  /**
   * Optional fine-grained permission overrides for the user.
   * These are merged with the role derived permissions.
   */
  extraPermissions?: PermissionKey[];
};

export const ROLES: Array<{ id: RoleId; label: string }> = [
  { id: 'superAdmin', label: 'Super Admin' },
  { id: 'tenantAdmin', label: 'Tenant Admin' },
  { id: 'complianceOfficer', label: 'Compliance Officer' },
  { id: 'auditor', label: 'Auditor' }
];

export const ROLE_PERMISSIONS: Record<RoleId, PermissionKey[]> = {
  superAdmin: PERMISSIONS,
  tenantAdmin: [
    'program.goals.read',
    'program.goals.write',
    'program.goals.delete',
    'program.goals.import',
    'program.goals.export',
    'program.audits.read',
    'program.audits.write',
    'program.audits.delete',
    'compliance.read',
    'compliance.write',
    'compliance.delete',
    'risk.read',
    'risk.write',
    'risk.delete',
    'iam.users.read',
    'iam.roles.read',
    'iam.permissions.read',
    'iam.sessions.read',
    'tenants.manage',
    'reports.auditLogs.read',
    'system.settings.read',
    'system.settings.write',
    'audit.read'
  ],
  complianceOfficer: [
    'program.goals.read',
    'program.goals.write',
    'program.goals.import',
    'program.goals.export',
    'program.audits.read',
    'compliance.read',
    'compliance.write',
    'risk.read',
    'reports.auditLogs.read',
    'system.settings.read'
  ],
  auditor: [
    'program.goals.read',
    'program.goals.export',
    'program.audits.read',
    'compliance.read',
    'risk.read',
    'reports.auditLogs.read',
    'audit.read'
  ]
};

export type PolicyDecisionReason =
  | 'granted'
  | 'missing-user'
  | 'missing-permission'
  | 'missing-tenant'
  | 'tenant-mismatch';

export type PolicyDecision = {
  permission: PermissionKey;
  allowed: boolean;
  reason: PolicyDecisionReason;
  requiredTenant?: string | null;
};

export type PolicyInput = {
  permission: PermissionKey;
  user: RbacUser | null | undefined;
  currentTenantId?: string | null;
  resourceTenantId?: string | null;
};

const getRolePermissions = (role: RoleId): Set<PermissionKey> =>
  new Set<PermissionKey>(ROLE_PERMISSIONS[role]);

export const policy = {
  evaluate({ permission, user, currentTenantId, resourceTenantId }: PolicyInput): PolicyDecision {
    if (!user) {
      return {
        permission,
        allowed: false,
        reason: 'missing-user'
      };
    }

    const rolePermissions = getRolePermissions(user.role);
    const extraPermissions = new Set(user.extraPermissions ?? []);
    const hasPermission = rolePermissions.has(permission) || extraPermissions.has(permission);

    if (!hasPermission) {
      return {
        permission,
        allowed: false,
        reason: 'missing-permission'
      };
    }

    const tenantScoped = TENANT_SCOPED.has(permission);
    const effectiveTenant = resourceTenantId ?? currentTenantId ?? null;

    if (tenantScoped) {
      if (!effectiveTenant) {
        return {
          permission,
          allowed: false,
          reason: 'missing-tenant',
          requiredTenant: resourceTenantId ?? currentTenantId ?? null
        };
      }

      const isSuperAdmin = user.role === 'superAdmin';
      const hasTenantAccess = isSuperAdmin || user.tenantIds.includes(effectiveTenant);

      if (!hasTenantAccess) {
        return {
          permission,
          allowed: false,
          reason: 'tenant-mismatch',
          requiredTenant: effectiveTenant
        };
      }
    }

    return {
      permission,
      allowed: true,
      reason: 'granted',
      requiredTenant: tenantScoped ? effectiveTenant ?? null : undefined
    };
  },
  can(input: PolicyInput): boolean {
    return policy.evaluate(input).allowed;
  },
  isTenantScoped(permission: PermissionKey): boolean {
    return TENANT_SCOPED.has(permission);
  }
};

export type UsePolicyOptions = {
  resourceTenantId?: string | null;
};

/**
 * Lightweight helper for functional components that prefer a hook-only API.
 * (Guard components use the context-aware hook in guard.tsx instead.)
 */
export const usePolicyDecision = (
  permission: PermissionKey,
  user: RbacUser | null | undefined,
  currentTenantId: string | null,
  options?: UsePolicyOptions
) =>
  useMemo(
    () =>
      policy.evaluate({
        permission,
        user,
        currentTenantId,
        resourceTenantId: options?.resourceTenantId ?? null
      }),
    [permission, user, currentTenantId, options?.resourceTenantId]
  );
