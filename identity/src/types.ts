export type RoleName =
  | 'Superadmin'
  | 'Compliance Officer'
  | 'Wirtschaftsprüfer'
  | 'Internal Auditor'
  | 'Kontroller'
  | 'Steuerberater'
  | 'Avukat'
  | 'Handelsrechtliche GF'
  | 'Gewerberechtliche GF'
  | 'HR Manager'
  | 'Fuhrparkleiter'
  | 'Fahrer'
  | 'Mitarbeiter'
  | 'Gesellschafter'
  | 'Hauptgesellschafter'
  | 'Data Entry'
  | 'Recruiter'
  | 'Bank Viewer'
  | 'Versicherungspartner'
  | 'Notar'
  | 'Betriebsrat';

export type RoleScope = 'global' | 'tenant';

export interface RoleDef {
  name: RoleName;
  scope: RoleScope;
  is_system?: boolean;
  is_exclusive?: boolean;
  template?: boolean;
}

export interface Claims {
  tenants?: string[];
  period?: { from: string; to: string };
  ous?: string[];
  docScopes?: string[];
  piiMask?: 'strict' | 'standard' | 'none';
}

export interface User {
  id: string;
  roles: RoleName[];
  claims?: Claims;
  mfaEnabled?: boolean;
  sessions?: string[];
}
