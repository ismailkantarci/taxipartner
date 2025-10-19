import stringify from 'fast-json-stable-stringify';
import { push, update } from '../notifications/store';

export type ExportColumn<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => unknown;
};

export type CsvExportOptions<T> = {
  module: string;
  filename?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  totalCount: number;
  query: Record<string, unknown>;
  threshold?: number;
  delayMs?: number;
};

type ActiveJob = {
  noticeId: string;
  timer: ReturnType<typeof setTimeout>;
};

const activeJobs = new Map<string, ActiveJob>();

const serializeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return stringify(value);
  return String(value);
};

const escapeCsv = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const buildCsv = <T,>(columns: ExportColumn<T>[], rows: T[]) => {
  const headers = columns.map(column => escapeCsv(column.header));
  const body = rows.map(row =>
    columns
      .map(column => {
        const raw = column.accessor
          ? column.accessor(row)
          : isRecord(row)
            ? (row[column.id] as unknown)
            : undefined;
        return escapeCsv(serializeValue(raw));
      })
      .join(',')
  );
  return [headers.join(','), ...body].join('\n');
};

const triggerDownload = (csv: string, filename: string) => {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
};

const jobKey = (module: string, columns: Array<ExportColumn<unknown>>, query: Record<string, unknown>) =>
  stringify({
    module,
    query,
    columns: columns.map(column => column.id).sort()
  });

export const startCsvExport = <T,>({
  module,
  filename,
  columns,
  rows,
  totalCount,
  query,
  threshold = 750,
  delayMs = 1500
}: CsvExportOptions<T>): void => {
  if (!columns.length) {
    push({
      type: 'warning',
      title: 'Nothing to export',
      body: 'Please select at least one column before exporting.'
    });
    return;
  }

  const effectiveFilename =
    filename ??
    `${module.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (totalCount <= threshold) {
    const csv = buildCsv(columns, rows);
    triggerDownload(csv, effectiveFilename);
    push({
      type: 'success',
      title: 'CSV downloaded',
      body: effectiveFilename
    });
    return;
  }

  const key = jobKey(module, columns as Array<ExportColumn<unknown>>, query);
  if (activeJobs.has(key)) {
    const job = activeJobs.get(key);
    if (job) {
      update(job.noticeId, {
        body: 'Still preparing this export. We will notify you once it is ready.'
      });
    }
    return;
  }

  const noticeId = push({
    type: 'info',
    title: 'Preparing CSV…',
    body: 'Large exports run in the background. We will notify you when the file is ready.'
  });

  const timer = setTimeout(() => {
    const csv = buildCsv(columns, rows);
    const url = triggerDownload(csv, effectiveFilename);
    update(noticeId, {
      type: 'success',
      title: 'CSV ready',
      body: effectiveFilename,
      link: url
    });
    activeJobs.delete(key);
  }, delayMs);

  activeJobs.set(key, { noticeId, timer });
};

export const resetCsvJobs = () => {
  activeJobs.forEach(job => clearTimeout(job.timer));
  activeJobs.clear();
};
