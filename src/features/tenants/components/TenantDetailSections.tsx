import React from 'react';
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import TenantStatusBadge from './TenantStatusBadge';
import { formatTenantDate } from '../utils';
import { useTranslation } from '../../../lib/i18n';
import type {
  AttachmentItem,
  DriverAssignmentItem,
  OfficerItem,
  ShareholdingItem,
  TenantApprovalItem,
  TenantIdentifierItem,
  TenantIdentityItem,
  TenantItem,
  VehicleAssignmentItem
} from '../../../api/tenants/types';

type DetailSectionProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  hasItems: boolean;
  emptyMessage: string;
  children: React.ReactNode;
};

const SectionContainer: React.FC<DetailSectionProps> = ({
  title,
  description,
  actions,
  isLoading,
  loadingLabel,
  error,
  hasItems,
  emptyMessage,
  children
}) => (
  <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
    <div className="mt-4">
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingLabel ?? 'Loading…'}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : hasItems ? (
        children
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      )}
    </div>
  </section>
);

type TenantOverviewSectionProps = {
  tenant: TenantItem | null;
  isLoading: boolean;
  onBack: () => void;
  headingRef?: React.RefObject<HTMLHeadingElement>;
  onAssignUser: () => void;
  onCreateIdentity: () => void;
};

export const TenantOverviewSection: React.FC<TenantOverviewSectionProps> = ({
  tenant,
  isLoading,
  onBack,
  headingRef,
  onAssignUser,
  onCreateIdentity
}) => {
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('tenants.detail.backToList', { defaultValue: 'Back to list' })}
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('tenants.detail.overview.loading', { defaultValue: 'Loading tenant…' })}
          </div>
        ) : tenant ? (
          <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:text-slate-100 dark:focus-visible:ring-slate-300"
                >
                  {tenant.legalName}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{tenant.tenantId}</p>
              </div>
              <div className="flex items-center gap-3">
                <TenantStatusBadge status={tenant.status} />
                <button
                  type="button"
                  onClick={onAssignUser}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {t('tenants.actions.assignUser', { defaultValue: 'Assign user' })}
                </button>
                <button
                  type="button"
                  onClick={onCreateIdentity}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900"
                >
                  {t('tenants.detail.identity.create', { defaultValue: 'New identity' })}
                </button>
              </div>
            </header>

            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label={t('tenants.detail.labels.legalForm', { defaultValue: 'Legal form' })}>
                {tenant.legalForm ?? '—'}
              </DetailItem>
              <DetailItem
                label={t('tenants.detail.labels.seatAddress', { defaultValue: 'Seat address' })}
              >
                {tenant.seatAddress ?? tenant.currentIdentity?.seatAddress ?? '—'}
              </DetailItem>
              <DetailItem
                label={t('tenants.detail.labels.primaryIdentifier', {
                  defaultValue: 'Primary identifier'
                })}
              >
                {tenant.primaryIdentifier ? (
                  <div className="flex flex-col text-sm">
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {tenant.primaryIdentifier.idValue}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {tenant.primaryIdentifier.idType}
                    </span>
                  </div>
                ) : (
                  '—'
                )}
              </DetailItem>
              <DetailItem
                label={t('tenants.detail.labels.identityPeriod', { defaultValue: 'Identity period' })}
              >
                {tenant.currentIdentity
                  ? `${formatTenantDate(tenant.currentIdentity.validFrom)} → ${formatTenantDate(
                      tenant.currentIdentity.validTo
                    )}`
                  : '—'}
              </DetailItem>
            </dl>
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('tenants.detail.overview.missing', {
              defaultValue: 'Tenant record could not be found.'
            })}
          </div>
        )}
      </div>
    </section>
  );
};

type IdentifiersSectionProps = {
  items: TenantIdentifierItem[];
  isLoading: boolean;
  error?: string | null;
  onAdd: () => void;
};

export const IdentifiersSection: React.FC<IdentifiersSectionProps> = ({
  items,
  isLoading,
  error,
  onAdd
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.identifiers', { defaultValue: 'Identifiers' })}
      description={t('tenants.detail.identifiers.description', {
        defaultValue: 'Primary and secondary identifiers registered for this tenant.'
      })}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.identifiers.add', { defaultValue: 'Add identifier' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.identifiers.loading', { defaultValue: 'Loading identifiers…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.identifiers.empty', { defaultValue: 'No identifiers recorded.' })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.dialog.type', { defaultValue: 'Type' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.dialog.value', { defaultValue: 'Value' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.country', { defaultValue: 'Country' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.dialog.target', { defaultValue: 'Target' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.primary', { defaultValue: 'Primary' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.validRange', { defaultValue: 'Valid' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">
                  {item.idType}
                </td>
                <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-100">
                  {item.idValue}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.countryCode ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.target ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.primaryFlag
                    ? t('common.yes', { defaultValue: 'Yes' })
                    : t('common.no', { defaultValue: 'No' })}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {`${formatTenantDate(item.validFrom)} → ${formatTenantDate(item.validTo)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type IdentityHistorySectionProps = {
  items: TenantIdentityItem[];
  isLoading: boolean;
  error?: string | null;
};

export const IdentityHistorySection: React.FC<IdentityHistorySectionProps> = ({
  items,
  isLoading,
  error
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.identityHistory', { defaultValue: 'Identity history' })}
      description={t('tenants.detail.identity.description', {
        defaultValue: 'Historical changes to names, forms and addresses.'
      })}
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.identity.loading', { defaultValue: 'Loading history…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.identity.empty', {
        defaultValue: 'No historical identity records found.'
      })}
    >
      <ul className="space-y-4">
        {items.map(item => (
          <li key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {item.legalName ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.legalForm ?? '—'}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {`${formatTenantDate(item.validFrom)} → ${formatTenantDate(item.validTo)}`}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {item.seatAddress ?? '—'}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </SectionContainer>
  );
};

type ShareholdingsSectionProps = {
  items: ShareholdingItem[];
  isLoading: boolean;
  error?: string | null;
  onAdd: () => void;
};

export const ShareholdingsSection: React.FC<ShareholdingsSectionProps> = ({
  items,
  isLoading,
  error,
  onAdd
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.shareholdings', { defaultValue: 'Shareholdings' })}
      description={t('tenants.detail.shareholdings.description', {
        defaultValue: 'Roles, quotas and liabilities for related parties.'
      })}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.shareholdings.add', { defaultValue: 'Add shareholding' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.shareholdings.loading', { defaultValue: 'Loading shareholdings…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.shareholdings.empty', {
        defaultValue: 'No shareholdings recorded.'
      })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.shareholdings.party', { defaultValue: 'Party' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.shareholdings.role', { defaultValue: 'Role' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.shareholdings.quota', { defaultValue: 'Quota %' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.shareholdings.liability', { defaultValue: 'Liability' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.shareholdings.capital', { defaultValue: 'Capital' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.validRange', { defaultValue: 'Valid' })}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {item.party?.displayName ??
                        item.partyId ??
                        t('tenants.detail.shareholdings.unknownParty', { defaultValue: 'Unknown party' })}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.party?.type ??
                        t('tenants.detail.shareholdings.partyTypeLabel', { defaultValue: 'Party' })}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.roleType}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.quotaPercent ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.liability ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.einlageAmount ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {`${formatTenantDate(item.validFrom)} → ${formatTenantDate(item.validTo)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type AttachmentsSectionProps = {
  items: AttachmentItem[];
  isLoading: boolean;
  error?: string | null;
  onAdd: () => void;
  onDelete: (item: AttachmentItem) => void;
};

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  items,
  isLoading,
  error,
  onAdd,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.attachments', { defaultValue: 'Attachments' })}
      description={t('tenants.detail.attachments.description', {
        defaultValue: 'Uploaded certificates and notices for this tenant.'
      })}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.attachments.add', { defaultValue: 'Add attachment' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.attachments.loading', { defaultValue: 'Loading attachments…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.attachments.empty', {
        defaultValue: 'No attachments uploaded.'
      })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.attachments.owner', { defaultValue: 'Owner' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.attachments.dialog.type', { defaultValue: 'Type' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.attachments.fileRef', { defaultValue: 'File reference' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.attachments.createdAt', { defaultValue: 'Issued' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.attachments.source', { defaultValue: 'Source URL' })}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.ownerType} · {item.ownerId}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.attachmentType}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                  {item.fileRef}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {formatTenantDate(item.issuedAt)}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      className="text-slate-700 underline transition hover:text-slate-900 dark:text-slate-200"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.sourceUrl}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type ApprovalsSectionProps = {
  items: TenantApprovalItem[];
  isLoading: boolean;
  error?: string | null;
  onAdd: () => void;
  onDelete: (item: TenantApprovalItem) => void;
};

export const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({
  items,
  isLoading,
  error,
  onAdd,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.approvals', { defaultValue: 'Approvals' })}
      description={t('tenants.detail.approvals.description', {
        defaultValue: 'Manual approvals linked to this tenant.'
      })}
      actions={
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.approvals.add', { defaultValue: 'Add approval' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.approvals.loading', { defaultValue: 'Loading approvals…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.approvals.empty', { defaultValue: 'No approvals registered.' })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.scope', { defaultValue: 'Scope' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.operation', { defaultValue: 'Operation' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.status', { defaultValue: 'Status' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.object', { defaultValue: 'Object' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.createdAt', { defaultValue: 'Created' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.approvals.payload', { defaultValue: 'Payload' })}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.scope}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.op}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.status}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.objectId ?? '—'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {formatTenantDate(item.createdAt)}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                  {item.payload ? JSON.stringify(item.payload, null, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type OfficersSectionProps = {
  items: OfficerItem[];
  isLoading: boolean;
  error?: string | null;
  onCreate: () => void;
  onEdit: (item: OfficerItem) => void;
  onDelete: (item: OfficerItem) => void;
};

export const OfficersSection: React.FC<OfficersSectionProps> = ({
  items,
  isLoading,
  error,
  onCreate,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.officers', { defaultValue: 'Officers' })}
      description={t('tenants.detail.officers.description', {
        defaultValue: 'Responsible officers at tenant or company level.'
      })}
      actions={
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.officers.add', { defaultValue: 'Add officer' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.officers.loading', { defaultValue: 'Loading officers…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.officers.empty', { defaultValue: 'No officers recorded.' })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.officers.dialog.officerType', { defaultValue: 'Type' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.officers.dialog.level', { defaultValue: 'Level' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.officers.party', { defaultValue: 'Party' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.validRange', { defaultValue: 'Valid' })}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.officerType}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.level === 'TENANT'
                    ? t('tenants.detail.officers.level.tenant', { defaultValue: 'Tenant' })
                    : t('tenants.detail.officers.level.company', { defaultValue: 'Company' })}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {item.party?.displayName ?? item.partyId ?? '—'}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.party?.type ??
                        t('tenants.detail.shareholdings.partyTypeLabel', { defaultValue: 'Party' })}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {`${formatTenantDate(item.validFrom)} → ${formatTenantDate(item.validTo)}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.edit', { defaultValue: 'Edit' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type VehiclesSectionProps = {
  items: VehicleAssignmentItem[];
  isLoading: boolean;
  error?: string | null;
  onCreate: () => void;
  onEdit: (item: VehicleAssignmentItem) => void;
  onDelete: (item: VehicleAssignmentItem) => void;
};

export const VehiclesSection: React.FC<VehiclesSectionProps> = ({
  items,
  isLoading,
  error,
  onCreate,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.vehicles', { defaultValue: 'Vehicle assignments' })}
      description={t('tenants.detail.vehicles.description', {
        defaultValue: 'Vehicles assigned to this tenant or its companies.'
      })}
      actions={
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.vehicles.add', { defaultValue: 'Add vehicle' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.vehicles.loading', { defaultValue: 'Loading vehicles…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.vehicles.empty', {
        defaultValue: 'No vehicle assignments recorded.'
      })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.vehicles.dialog.vehicle', { defaultValue: 'Vehicle' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.vehicles.dialog.company', { defaultValue: 'Company' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.validRange', { defaultValue: 'Assigned' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.vehicles.dialog.approval', { defaultValue: 'Approval' })}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.vehicleId}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.companyId}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {`${formatTenantDate(item.assignedFrom)} → ${formatTenantDate(item.assignedTo)}`}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.approvalId ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover	bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.edit', { defaultValue: 'Edit' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type DriversSectionProps = {
  items: DriverAssignmentItem[];
  isLoading: boolean;
  error?: string | null;
  onCreate: () => void;
  onEdit: (item: DriverAssignmentItem) => void;
  onDelete: (item: DriverAssignmentItem) => void;
};

export const DriversSection: React.FC<DriversSectionProps> = ({
  items,
  isLoading,
  error,
  onCreate,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <SectionContainer
      title={t('tenants.detail.section.drivers', { defaultValue: 'Driver assignments' })}
      description={t('tenants.detail.drivers.description', {
        defaultValue: 'Drivers linked to this tenant.'
      })}
      actions={
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('tenants.detail.drivers.add', { defaultValue: 'Add driver' })}
        </button>
      }
      isLoading={isLoading}
      loadingLabel={t('tenants.detail.drivers.loading', { defaultValue: 'Loading drivers…' })}
      error={error}
      hasItems={items.length > 0}
      emptyMessage={t('tenants.detail.drivers.empty', { defaultValue: 'No driver assignments recorded.' })}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm leading-6 dark:divide-slate-800">
          <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">
                {t('tenants.detail.drivers.party', { defaultValue: 'Party' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.drivers.dialog.company', { defaultValue: 'Company' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.identifiers.validRange', { defaultValue: 'Assigned' })}
              </th>
              <th className="px-3 py-2">
                {t('tenants.detail.drivers.dialog.approval', { defaultValue: 'Approval' })}
              </th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {items.map(item => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {item.party?.displayName ?? item.partyId ?? '—'}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.party?.type ??
                        t('tenants.detail.shareholdings.partyTypeLabel', { defaultValue: 'Party' })}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.companyId}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {`${formatTenantDate(item.assignedFrom)} → ${formatTenantDate(item.assignedTo)}`}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                  {item.approvalId ?? '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.edit', { defaultValue: 'Edit' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('tenants.detail.actions.remove', { defaultValue: 'Remove' })}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionContainer>
  );
};

type DetailItemProps = {
  label: string;
  children: React.ReactNode;
};

const DetailItem: React.FC<DetailItemProps> = ({ label, children }) => (
  <div className="space-y-1 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <div className="text-sm text-slate-700 dark:text-slate-200">{children}</div>
  </div>
);

export default SectionContainer;
