import React, { useEffect, useMemo, useState } from 'react';
import type { GoalDynamicStatus } from '../../../lib/repo/goals/types';
import { coerceGoalFormSchema } from '../../../lib/forms/validation';
import type { GoalFormValues } from '../../../lib/forms/validation';

type GoalFormState = {
  name: string;
  owner: string;
  dynamicStatus: GoalDynamicStatus;
  audits: string;
};

type FieldErrors = Partial<Record<keyof GoalFormState, string>>;

type GoalFormProps = {
  initialValues?: Partial<GoalFormValues>;
  onSubmit: (values: GoalFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
  busy?: boolean;
};

const defaultState: GoalFormState = {
  name: '',
  owner: '',
  dynamicStatus: 'ok',
  audits: '0'
};

const statusOptions: Array<{ value: GoalDynamicStatus; label: string }> = [
  { value: 'ok', label: 'On Track' },
  { value: 'warn', label: 'At Risk' },
  { value: 'risk', label: 'Blocked' }
];

const toState = (values?: Partial<GoalFormValues>): GoalFormState => ({
  name: values?.name ?? defaultState.name,
  owner: values?.owner ?? defaultState.owner,
  dynamicStatus: values?.dynamicStatus ?? defaultState.dynamicStatus,
  audits: values?.audits !== undefined ? String(values.audits) : defaultState.audits
});

const parseState = (state: GoalFormState) =>
  coerceGoalFormSchema.safeParse({
    ...state,
    audits: state.audits
  });

export const GoalForm: React.FC<GoalFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save goal',
  busy = false
}) => {
  const [state, setState] = useState<GoalFormState>(() => toState(initialValues));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setState(toState(initialValues));
    setFieldErrors({});
    setFormError(null);
  }, [initialValues]);

  const validation = useMemo(() => parseState(state), [state]);
  const isValid = validation.success;

  useEffect(() => {
    if (validation.success) {
      setFieldErrors({});
      return;
    }
    const nextErrors: FieldErrors = {};
    validation.error.issues.forEach(issue => {
      const path = issue.path[0];
      if (typeof path === 'string') {
        nextErrors[path as keyof GoalFormState] = issue.message;
      }
    });
    setFieldErrors(nextErrors);
  }, [validation]);

  const handleChange = (field: keyof GoalFormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value;
    setState(prev => ({
      ...prev,
      [field]: field === 'audits' ? value.replace(/[^0-9]/g, '') : value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.success || busy) {
      return;
    }
    setFormError(null);
    try {
      await onSubmit(validation.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not save the goal. Please try again.';
      setFormError(message);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="goal-name" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Goal name
          </label>
          <input
            id="goal-name"
            name="name"
            type="text"
            value={state.name}
            onChange={handleChange('name')}
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'goal-name-error' : undefined}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            maxLength={120}
          />
          {fieldErrors.name ? (
            <p id="goal-name-error" className="mt-1 text-sm text-rose-500">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col">
          <label htmlFor="goal-owner" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Owner
          </label>
          <input
            id="goal-owner"
            name="owner"
            type="text"
            value={state.owner}
            onChange={handleChange('owner')}
            required
            aria-invalid={Boolean(fieldErrors.owner)}
            aria-describedby={fieldErrors.owner ? 'goal-owner-error' : undefined}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            maxLength={80}
          />
          {fieldErrors.owner ? (
            <p id="goal-owner-error" className="mt-1 text-sm text-rose-500">
              {fieldErrors.owner}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col">
          <label htmlFor="goal-status" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Status
          </label>
          <select
            id="goal-status"
            name="dynamicStatus"
            value={state.dynamicStatus}
            onChange={handleChange('dynamicStatus')}
            className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label htmlFor="goal-audits" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Completed audits
          </label>
          <input
            id="goal-audits"
            name="audits"
            type="number"
            inputMode="numeric"
            min={0}
            value={state.audits}
            onChange={handleChange('audits')}
            required
            aria-invalid={Boolean(fieldErrors.audits)}
            aria-describedby={fieldErrors.audits ? 'goal-audits-error' : undefined}
            className="mt-1 w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          {fieldErrors.audits ? (
            <p id="goal-audits-error" className="mt-1 text-sm text-rose-500">
              {fieldErrors.audits}
            </p>
          ) : null}
        </div>
      </div>

      {formError ? <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">{formError}</div> : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isValid || busy}
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
};

export default GoalForm;
