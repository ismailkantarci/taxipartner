import React, { useMemo, useState } from 'react';
import Modal from '../../../../components/overlay/Modal';
import type { GoalDynamicStatus } from '../../../../lib/repo/goals/types';
import type { GoalsImportPayload, ParsedGoalRow } from './importJob';

const validStatuses: GoalDynamicStatus[] = ['ok', 'warn', 'risk'];

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return { rows: [] as ParsedGoalRow[], errors: ['CSV must include a header row and at least one data row.'] };
  }
  const header = parseCsvLine(lines[0]).map(value => value.toLowerCase());
  const indexes = {
    name: header.indexOf('name'),
    owner: header.indexOf('owner'),
    status: header.indexOf('dynamicstatus'),
    audits: header.indexOf('audits'),
    summary: header.indexOf('summary')
  };
  const missing = Object.entries(indexes)
    .filter(([key, index]) => key !== 'summary' && index === -1)
    .map(([key]) => key);
  if (missing.length) {
    return { rows: [], errors: [`Missing required column(s): ${missing.join(', ')}`] };
  }

  const rows: ParsedGoalRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const raw = parseCsvLine(lines[i]);
    const name = raw[indexes.name].trim();
    const owner = raw[indexes.owner].trim();
    const status = (raw[indexes.status] || 'ok').toLowerCase() as GoalDynamicStatus;
    const auditsValue = raw[indexes.audits];
    const summary = indexes.summary >= 0 ? raw[indexes.summary] : '';

    if (!name || !owner) {
      errors.push(`Row ${i + 1}: name and owner are required.`);
      continue;
    }
    if (!validStatuses.includes(status)) {
      errors.push(`Row ${i + 1}: invalid status '${raw[indexes.status]}'.`);
      continue;
    }
    const audits = Number(auditsValue ?? '0');
    if (Number.isNaN(audits) || audits < 0) {
      errors.push(`Row ${i + 1}: audits must be a number >= 0.`);
      continue;
    }
    rows.push({
      name,
      owner,
      dynamicStatus: status,
      audits,
      summary
    });
  }

  return { rows, errors };
};

type ImportDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onStart: (payload: GoalsImportPayload) => Promise<void> | void;
};

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, onStart }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filename = useMemo(() => file?.name ?? 'No file selected', [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Please choose a CSV file.');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.errors.length) {
        setError(parsed.errors.join('\n'));
        setBusy(false);
        return;
      }
      if (parsed.rows.length === 0) {
        setError('No valid rows found in the CSV file.');
        setBusy(false);
        return;
      }
      await onStart({ rows: parsed.rows, sourceName: file.name });
      setFile(null);
      setError(null);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to read the selected file.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!busy) {
          onClose();
          setError(null);
        }
      }}
      title="Import goals from CSV"
      description="Provide a UTF-8 CSV with columns: name, owner, dynamicStatus, audits, summary."
      size="lg"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
          <label htmlFor="csv-file" className="flex flex-col gap-2">
            <span className="font-medium text-slate-700 dark:text-slate-200">Select CSV file</span>
            <input
              id="csv-file"
              name="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={busy}
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">{filename}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <p className="font-semibold text-slate-600 dark:text-slate-200">CSV expectations</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Required columns: <code>name</code>, <code>owner</code>, <code>dynamicStatus</code>, <code>audits</code>.</li>
            <li><code>dynamicStatus</code> must be one of <code>ok</code>, <code>warn</code>, <code>risk</code>.</li>
            <li><code>audits</code> must be a number greater or equal to zero.</li>
            <li>Optional column: <code>summary</code>.</li>
          </ul>
        </div>
        {error ? (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
            {error.split('\n').map(line => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {busy ? 'Starting…' : 'Start import'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ImportDialog;
