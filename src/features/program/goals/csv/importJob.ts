import type { GoalsAdapter } from '../../../../lib/repo/index.tsx';
import type { GoalDynamicStatus } from '../../../../lib/repo/goals/types';
import { createJob, subscribe, cancelJob } from '../../../../lib/jobs/jobs';
import type { Job } from '../../../../lib/jobs/types';
import { push, update } from '../../../../lib/notifications/store';

export type ParsedGoalRow = {
  name: string;
  owner: string;
  dynamicStatus: GoalDynamicStatus;
  audits: number;
  summary?: string;
};

export type GoalsImportPayload = {
  rows: ParsedGoalRow[];
  sourceName: string;
  tenantId?: string | null;
};

export type StartGoalsImportOptions = {
  repository: GoalsAdapter;
  onRefresh?: () => void;
};

const createErrorCsv = (rows: ParsedGoalRow[], reason: string) => {
  const header = 'name,owner,dynamicStatus,audits,summary,error';
  const lines = rows.map(row => {
    const values = [row.name, row.owner, row.dynamicStatus, String(row.audits), row.summary ?? '', reason];
    return values.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',');
  });
  const csv = [header, ...lines].join('\n');
  return URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
};

export const startGoalsImport = (
  payload: GoalsImportPayload,
  options: StartGoalsImportOptions
): { job: Job<GoalsImportPayload>; noticeId: string } => {
  const job = createJob('goals.csv.import', payload);
  const noticeId = push({
    type: 'info',
    title: 'Import started',
    body: `Processing ${payload.rows.length} rows from ${payload.sourceName}`,
    link: '/program/goals',
    jobId: job.id,
    progress: 0
  });

  let handled = false;

  const unsubscribe = subscribe(job.id, async next => {
    if (next.state === 'running') {
      update(noticeId, {
        body: `Import in progress (${next.progress}%)`,
        progress: next.progress
      });
      return;
    }

    if (handled) return;

    if (next.state === 'success') {
      handled = true;
      try {
        for (const row of payload.rows) {
          await options.repository.create({
            name: row.name,
            owner: row.owner,
            dynamicStatus: row.dynamicStatus,
            audits: row.audits,
            summary: row.summary
          });
        }
        update(noticeId, {
          type: 'success',
          title: 'Import completed',
          body: `${payload.rows.length} goals were imported successfully.`,
          progress: 100,
          read: false
        });
        options.onRefresh?.();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Failed to commit imported rows.';
        const link = createErrorCsv(payload.rows, reason);
        update(noticeId, {
          type: 'error',
          title: 'Import commit failed',
          body: reason,
          link,
          read: false
        });
      }
      unsubscribe();
      return;
    }

    if (next.state === 'failed') {
      handled = true;
      const reason = next.error ?? 'Import job failed. Please review the error log.';
      const link = createErrorCsv(payload.rows, reason);
      update(noticeId, {
        type: 'error',
        title: 'Import failed',
        body: reason,
        link,
        read: false
      });
      unsubscribe();
      return;
    }

    if (next.state === 'canceled') {
      handled = true;
      update(noticeId, {
        type: 'warning',
        title: 'Import canceled',
        body: 'The import job was canceled before completion.',
        progress: next.progress,
        read: false
      });
      unsubscribe();
    }
  });

  return { job, noticeId };
};

export const abortImportJob = (jobId: string) => {
  cancelJob(jobId);
};
