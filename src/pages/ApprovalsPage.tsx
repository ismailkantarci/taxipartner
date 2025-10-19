import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import RequirePermission from '../components/rbac/RequirePermission';
import { useGuardContext } from '../lib/rbac/guard';
import { listApprovals, startApproval, applyApproval } from '../../frontend/users/api.ts';

type ApprovalRecord = {
  id: string;
  op: string;
  tenantId?: string;
  targetId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  initiatorUserId?: string;
  approvals?: Array<{ userId: string }>;
};

const statusBadgeStyles: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  CANCELLED: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
};

const ApprovalsContent: React.FC = () => {
  const { user } = useGuardContext();
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({ op: '', tenantId: '', targetId: '' });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await listApprovals()) as ApprovalRecord[];
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onay listesi yüklenemedi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formState.op.trim()) {
      setError('Operasyon anahtarı gerekli.');
      return;
    }
    if (!formState.tenantId.trim()) {
      setError('Tenant ID gerekli.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await startApproval(formState.op.trim(), formState.tenantId.trim(), user.id, formState.targetId.trim() || undefined);
      setFormState({ op: '', tenantId: formState.tenantId, targetId: '' });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onay başlatılırken hata oluştu.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => {
    const pending = records.filter(record => record.status === 'PENDING');
    const resolved = records.filter(record => record.status !== 'PENDING');
    return { pending, resolved };
  }, [records]);

  const approve = async (approvalId: string) => {
    try {
      await applyApproval(approvalId, user.id);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onay uygulanamadı.';
      setError(message);
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-5">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Four-eyes approvals</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tenant bazlı iki aşamalı işlemler için approval kuyruğu. Legacy IAM modülünden taşındı.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-200">Yeni onay oluştur</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Operasyon anahtarı</label>
            <input
              value={formState.op}
              onChange={event => setFormState(prev => ({ ...prev, op: event.target.value }))}
              placeholder="ör. vehicle.decommission"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tenant ID</label>
            <input
              value={formState.tenantId}
              onChange={event => setFormState(prev => ({ ...prev, tenantId: event.target.value }))}
              placeholder="örn. tenant-vienna"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Target ID (opsiyonel)</label>
            <input
              value={formState.targetId}
              onChange={event => setFormState(prev => ({ ...prev, targetId: event.target.value }))}
              placeholder="ör. VEH-9123"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-inner focus:border-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Onay başlat
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400">İşlem sahibi: {user.id}</span>
        </div>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <ApprovalList
          title="Bekleyen onaylar"
          subtitle="Aşağıdaki işlemler ikinci göz onayı bekliyor."
          emptyText="Bekleyen kayıt yok."
          loading={loading}
          approvals={grouped.pending}
          onApprove={approve}
        />
        <ApprovalList
          title="Tamamlanan / iptal edilen"
          subtitle="Geçmiş onay hareketleri."
          emptyText="Geçmiş kayıt yok."
          loading={loading}
          approvals={grouped.resolved}
        />
      </section>
    </section>
  );
};

type ApprovalListProps = {
  title: string;
  subtitle: string;
  emptyText: string;
  approvals: ApprovalRecord[];
  loading: boolean;
  onApprove?: (id: string) => void;
};

const ApprovalList: React.FC<ApprovalListProps> = ({ title, subtitle, approvals, emptyText, loading, onApprove }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-200">{title}</h2>
    <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    <div className="mt-3 space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yükleniyor…
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {emptyText}
        </div>
      ) : (
        approvals.map(record => (
          <div key={record.id} className="rounded-xl border border-slate-200 p-3 shadow-sm dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">{record.op}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tenant: {record.tenantId ?? '—'}</p>
                {record.targetId ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target: {record.targetId}</p>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-400">Başlatan: {record.initiatorUserId ?? '—'}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeStyles[record.status ?? 'PENDING'] ?? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                {record.status === 'APPROVED' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {record.status ?? 'PENDING'}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Onaylayanlar: {(record.approvals ?? []).map(item => item.userId).join(', ') || '—'}
            </p>
            {record.status === 'PENDING' && onApprove ? (
              <button
                type="button"
                onClick={() => onApprove(record.id)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Onayla
              </button>
            ) : null}
          </div>
        ))
      )}
    </div>
  </article>
);

const ApprovalsPage: React.FC = () => (
  <RequirePermission permission="iam.users.read">
    <ApprovalsContent />
  </RequirePermission>
);

export default ApprovalsPage;
