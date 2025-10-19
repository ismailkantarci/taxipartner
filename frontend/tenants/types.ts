import type { JsonValue } from '../types/json';

export interface TenantIdentifierItem {
  id: string;
  tenantId: string;
  idType: string;
  idValue: string;
  countryCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  primaryFlag?: boolean;
  target?: string | null;
}

export interface TenantItem {
  tenantId: string;
  legalName: string;
  legalForm?: string | null;
  seatAddress?: string | null;
  status?: string | null;
  currentIdentity?: {
    legalName?: string | null;
    legalForm?: string | null;
    seatAddress?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
    currentFlag?: boolean;
  } | null;
  primaryIdentifier?: TenantIdentifierItem | null;
}

export interface TenantIdentityItem {
  id: string;
  tenantId: string;
  currentFlag: boolean;
  legalName?: string | null;
  legalForm?: string | null;
  seatAddress?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  idType?: string | null;
  idValue?: string | null;
}

export interface CorporateActionItem {
  actionId: string;
  actionType: string;
  effectiveDate: string;
  sourceTenantIds: string[];
  targetTenantId: string;
  note?: string | null;
}

export interface ShareholdingItem {
  id: string;
  tenantId: string;
  partyId: string;
  roleType: string;
  quotaPercent?: string | null;
  einlageAmount?: string | null;
  liability?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
}

export interface AttachmentItem {
  id: string;
  ownerType: string;
  ownerId: string;
  attachmentType: string;
  fileRef: string;
  issuedAt?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
}

export interface OfficerItem {
  id: string;
  level: string;
  tenantId?: string | null;
  companyId?: string | null;
  partyId: string;
  officerType: string;
  validFrom?: string | null;
  validTo?: string | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
}

export interface VehicleAssignmentItem {
  id: string;
  vehicleId: string;
  tenantId: string;
  companyId: string;
  assignedFrom: string;
  assignedTo?: string | null;
  approvalId?: string | null;
}

export interface DriverAssignmentItem {
  id: string;
  partyId: string;
  tenantId: string;
  companyId: string;
  assignedFrom: string;
  assignedTo?: string | null;
  approvalId?: string | null;
  party?: {
    partyId: string;
    type: string;
    displayName: string;
  } | null;
}

export interface TenantApprovalItem {
  id: string;
  tenantId: string;
  scope: string;
  objectId?: string | null;
  op: string;
  payload?: JsonValue;
  status: string;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface ApiResponseBase {
  ok: boolean;
  status: number;
  error?: string;
}

export interface ApiListResponse<T> extends ApiResponseBase {
  items?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiItemResponse<T> extends ApiResponseBase {
  item?: T;
}

export type ApiMutationResponse = ApiResponseBase;

export interface CreateTenantInput {
  tenantId?: string;
  legalName: string;
  legalForm?: string;
  seatAddress?: string;
}

export interface ListTenantsParams {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: 'created' | 'name' | 'tenantid' | 'status';
  order?: 'asc' | 'desc';
}

export interface AssignTenantUserInput {
  userId: string;
  role?: string;
}

export interface CreateTenantIdentityInput {
  idType: string;
  idValue: string;
  countryCode?: string;
  validFrom?: string;
  validTo?: string;
  primaryFlag?: boolean;
  target?: string;
}

export interface CreateCorporateActionInput {
  actionType: string;
  effectiveDate: string;
  sourceTenantIds: string[];
  targetTenantId: string;
  note?: string;
}

export interface CreateShareholdingInput {
  roleType: string;
  quotaPercent?: string;
  einlageAmount?: string;
  liability?: string;
  validFrom?: string;
  validTo?: string;
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
}

export interface CreateAttachmentInput {
  ownerType: 'TENANT' | 'COMPANY' | 'COMPANY_PERMIT';
  ownerId: string;
  attachmentType: string;
  fileRef: string;
  issuedAt?: string;
  sourceUrl?: string;
}

export interface CreateOfficerInput {
  level: 'TENANT' | 'COMPANY';
  companyId?: string;
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
  officerType: string;
  validFrom?: string;
  validTo?: string;
}

export interface CreateVehicleAssignmentInput {
  vehicleId: string;
  companyId: string;
  assignedFrom: string;
  assignedTo?: string;
  approvalId?: string;
}

export interface CreateDriverAssignmentInput {
  partyId?: string;
  party?: {
    type: string;
    displayName: string;
  };
  companyId: string;
  assignedFrom: string;
  assignedTo?: string;
  approvalId?: string;
}

export interface CreateApprovalInput {
  scope: string;
  objectId?: string;
  op: string;
  payload?: JsonValue;
  idempotencyKey?: string;
}
