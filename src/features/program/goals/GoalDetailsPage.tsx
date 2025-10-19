import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, Clock, Loader2, Pencil, Trash2, User } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Modal from '../../../components/overlay/Modal';
import ConfirmDialog from '../../../components/overlay/ConfirmDialog';
import GoalForm from './GoalForm';
import QueryErrorBoundary from '../../../components/errors/QueryErrorBoundary';
import type { GoalDynamicStatus } from '../../../lib/repo/goals/types';
import type { GoalFormValues } from '../../../lib/forms/validation';
import { useGoal, useUpdateGoal, useDeleteGoal } from '../../../features/program/goals/api';

const statusBadgeStyles: Record<GoalDynamicStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
  risk: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
};

const statusLabels: Record<GoalDynamicStatus, string> = {
  ok: 'On Track',
  warn: 'At Risk',
  risk: 'Blocked'
};

const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch (_) {
    return '—';
  }
};

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(value));
  } catch (_) {
    return '—';
  }
};

const GoalDetailsPageContent: React.FC = () => {
  const { goalId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data: goal, isLoading, isError, error } = useGoal(goalId ?? null);
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const modal = searchParams.get('modal');

  useEffect(() => {
    if (goal) {
      headingRef.current?.focus();
    }
  }, [goal?.id]);

  if (!goalId) {
    return (
      <section className="flex flex-1 flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/program/goals')}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to goals
        </button>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Goal not found</p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex flex-1 flex-col gap-6" aria-busy="true">
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Loading goal…</span>
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/60" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200/70 dark:bg-slate-700/60" />
        </div>
      </section>
    );
  }

  if (isError) {
    throw error ?? new Error('Failed to load goal');
  }

  if (!goal) {
    return (
      <section className="flex flex-1 flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/program/goals')}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to goals
        </button>
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <ClipboardList className="mb-3 h-10 w-10 text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Goal not found</p>
        </div>
      </section>
    );
  }

  const openEditModal = () => {
    const params = new URLSearchParams(location.search);
    params.set('modal', 'edit');
    params.set('modalGoal', goal.id);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: false });
  };

  const closeModal = () => {
    const params = new URLSearchParams(location.search);
    params.delete('modal');
    params.delete('modalGoal');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  const handleEdit = async (values: GoalFormValues) => {
    await updateGoal.mutateAsync({ id: goal.id, input: values });
    closeModal();
  };

  const handleDelete = async () => {
    await deleteGoal.mutateAsync(goal.id);
    navigate('/program/goals');
  };

  const editModalOpen = modal === 'edit';

  return (
    <section className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-500/60 dark:text-slate-100"
          >
            {goal.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Keep program stakeholders aligned and provide visibility into progress updates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        </div>
      </header>

      <section
        aria-labelledby="goal-overview"
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="goal-overview" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <p
              className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${statusBadgeStyles[goal.dynamicStatus]}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabels[goal.dynamicStatus]}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase tracking-wide text-slate-500">Audits completed</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{goal.audits}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase tracking-wide text-slate-500">Owner</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <User className="h-4 w-4" aria-hidden="true" />
              {goal.owner}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last updated</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDateTime(goal.updatedAt)}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="goal-metadata"
        className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 id="goal-metadata" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Metadata
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Identifier</dt>
            <dd className="mt-2 font-medium text-slate-800 dark:text-slate-100">{goal.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
            <dd className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDate(goal.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
            <dd className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDate(goal.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Last audit</dt>
            <dd className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDate(goal.lastAuditAt)}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="goal-activity"
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-2">
          <h2 id="goal-activity" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Activity &amp; notes
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            Read only
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Surface updates from audits, stakeholders, and pending actions here. The panel will sync with audit workflow data in v0.5.
        </p>
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />
          Timeline streaming soon. Add updates via the audit workspace in the meantime.
        </div>
      </section>

      <Modal
        isOpen={editModalOpen}
        onClose={closeModal}
        title="Edit goal"
        description={goal ? `Update ${goal.name} and keep stakeholders in sync.` : undefined}
      >
        <GoalForm
          initialValues={goal ?? undefined}
          onSubmit={async values => {
            await handleEdit(values);
          }}
          onCancel={closeModal}
          submitLabel="Save changes"
          busy={updateGoal.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete goal"
        description={goal ? `This will remove ${goal.name} from the program goals.` : undefined}
        confirmLabel={deleteGoal.isPending ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
        loading={deleteGoal.isPending}
      />
    </section>
  );
};

const GoalDetailsPage: React.FC = () => (
  <QueryErrorBoundary>
    <GoalDetailsPageContent />
  </QueryErrorBoundary>
);

export default GoalDetailsPage;
