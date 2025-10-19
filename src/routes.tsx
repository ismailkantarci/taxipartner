import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building,
  Building2,
  Car,
  CircleUser,
  ClipboardList,
  Factory,
  FileText,
  LayoutDashboard,
  ListChecks,
  Package,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PermissionKey } from './lib/rbac/policy';

export type AppRoute = {
  path: string;
  label: string;
  icon?: LucideIcon;
  permission?: PermissionKey;
};

export const PRIMARY_ROUTES: AppRoute[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/program/goals', label: 'Goals', icon: Target },
  { path: '/program/audits', label: 'Audits', icon: ClipboardList },
  { path: '/iam/users', label: 'Users', icon: Users, permission: 'iam.users.read' },
  { path: '/iam/approvals', label: 'Approvals', icon: ShieldCheck, permission: 'iam.users.read' },
  { path: '/iam/roles', label: 'Roles', icon: ListChecks, permission: 'iam.roles.read' },
  { path: '/iam/permissions', label: 'Permissions', icon: ShieldCheck, permission: 'iam.permissions.read' },
  { path: '/iam/sessions', label: 'Sessions', icon: Shield, permission: 'iam.sessions.read' },
  { path: '/iam/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'reports.auditLogs.read' },
  { path: '/tenants', label: 'Tenants', icon: Building2, permission: 'tenants.manage' },
  { path: '/tenants/organizations', label: 'Organizations', icon: Building, permission: 'tenants.manage' },
  { path: '/tenants/companies', label: 'Companies', icon: Factory, permission: 'tenants.manage' },
  { path: '/tenants/shareholders', label: 'Shareholders', icon: CircleUser, permission: 'tenants.manage' },
  { path: '/tenants/mandates', label: 'Mandates', icon: FileText, permission: 'tenants.manage' },
  { path: '/tenants/ous', label: 'Org Units', icon: FileText, permission: 'tenants.manage' },
  { path: '/tenants/vehicles', label: 'Vehicles', icon: Car, permission: 'tenants.manage' },
  { path: '/assets', label: 'Assets', icon: Package },
  { path: '/controls', label: 'Controls', icon: Shield },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'system.devtools' },
  { path: '/risk', label: 'Risk', icon: AlertTriangle, permission: 'risk.read' },
  { path: '/audit', label: 'Audit', icon: ClipboardList, permission: 'audit.read' },
  { path: '/secops', label: 'SecOps', icon: Shield },
  { path: '/compliance', label: 'Compliance', icon: ShieldCheck, permission: 'compliance.read' },
  { path: '/release', label: 'Release Mgmt', icon: Rocket, permission: 'system.devtools' },
  { path: '/library', label: 'Design Library', icon: BookOpen, permission: 'system.devtools' },
  { path: '/system/settings', label: 'System Settings', icon: Settings, permission: 'system.settings.read' }
];

export const PROGRAM_TABS = [
  { to: '/program/goals', label: 'Goals' },
  { to: '/program/audits', label: 'Audits' }
];
