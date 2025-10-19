import React, { useMemo } from 'react';
import type { AuditEvent } from '../lib/repo/audit';
import { Modal } from './overlay/Modal';
import { useTranslation } from '../lib/i18n';
import { formatDateTime } from '../lib/i18n/format';

type AuditDetailModalProps = {
  event: AuditEvent | null;
  isOpen: boolean;
  onClose: () => void;
};

const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ event, isOpen, onClose }) => {
  const { t } = useTranslation();

  const formattedTimestamp = useMemo(() => {
    if (!event) return '';
    return formatDateTime(event.ts, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }, [event]);

  if (!event) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={t('audit.detail.noData', { defaultValue: 'Audit event' })}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('audit.detail.missing', { defaultValue: 'This audit entry could not be loaded.' })}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={event.summary}
      description={event.action}
      size="lg"
      closeLabel={t('audit.detail.close', { defaultValue: 'Close audit event' })}
    >
      <dl className="grid gap-4 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('audit.detail.timestamp', { defaultValue: 'Timestamp' })}
          </dt>
          <dd className="mt-1">{formattedTimestamp}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('audit.detail.actor', { defaultValue: 'Actor' })}
          </dt>
          <dd className="mt-1">
            {event.actor.name}
            {event.actor.email ? <span className="text-xs text-slate-500 dark:text-slate-400"> · {event.actor.email}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('audit.detail.target', { defaultValue: 'Target' })}
          </dt>
          <dd className="mt-1">
            {event.target.name ?? event.target.id}{' '}
            <span className="text-xs text-slate-500 dark:text-slate-400">({event.target.type})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('audit.detail.source', { defaultValue: 'Source' })}
          </dt>
          <dd className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {event.source ?? 'ui'}
          </dd>
        </div>
        {event.severity ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t('audit.detail.severity', { defaultValue: 'Severity' })}
            </dt>
            <dd className="mt-1 capitalize">{event.severity}</dd>
          </div>
        ) : null}
      </dl>
      {event.metadata && Object.keys(event.metadata).length ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
            {t('audit.detail.metadata', { defaultValue: 'Payload' })}
          </h3>
          <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950/80 p-4 text-xs text-slate-100">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      ) : null}
      {event.context && Object.keys(event.context).length ? (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">
            {t('audit.detail.context', { defaultValue: 'Context' })}
          </h3>
          <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950/70 p-4 text-xs text-slate-100">
            {JSON.stringify(event.context, null, 2)}
          </pre>
        </div>
      ) : null}
    </Modal>
  );
};

export default AuditDetailModal;
