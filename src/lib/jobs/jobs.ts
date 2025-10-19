import { nanoid } from 'nanoid';
import type { Job, JobKind, JobListener, JobState } from './types';

const listeners = new Map<string, Set<JobListener>>();
const jobMap = new Map<string, Job>();

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt = (min: number, max: number) => Math.floor(randomInRange(min, max + 1));

const emit = (job: Job) => {
  const subs = listeners.get(job.id);
  if (!subs) return;
  subs.forEach(listener => {
    try {
      listener(job);
    } catch (error) {
      console.error('[jobs] listener error', error);
    }
  });
};

const updateJob = <T,>(job: Job<T>, changes: Partial<Job<T>>): Job<T> => {
  const next: Job<T> = {
    ...job,
    ...changes,
    updatedAt: Date.now()
  };
  jobMap.set(next.id, next);
  emit(next);
  return next;
};

const finalizeJob = <T,>(job: Job<T>, state: JobState, error?: string) =>
  updateJob(job, {
    state,
    progress: state === 'success' ? 100 : job.progress,
    error
  });

export const createJob = <TPayload,>(kind: JobKind, payload: TPayload): Job<TPayload> => {
  const job: Job<TPayload> = {
    id: nanoid(),
    kind,
    payload,
    state: 'queued',
    progress: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  jobMap.set(job.id, job);
  emit(job);
  queueMicrotask(() => runJob(job.id));
  return job;
};

export const getJob = <T,>(id: string): Job<T> | undefined => jobMap.get(id) as Job<T> | undefined;

export const subscribe = <TPayload,>(id: string, listener: JobListener<TPayload>) => {
  const set = listeners.get(id) ?? new Set<JobListener<TPayload>>();
  set.add(listener as JobListener);
  listeners.set(id, set as Set<JobListener>);
  const job = jobMap.get(id);
  if (job) listener(job as Job<TPayload>);
  return () => {
    const local = listeners.get(id);
    local?.delete(listener as JobListener);
    if (local && local.size === 0) {
      listeners.delete(id);
    }
  };
};

const simulateProgress = async <TPayload,>(job: Job<TPayload>) => {
  let current = job;
  while (current.state === 'running') {
    await new Promise(resolve => setTimeout(resolve, randomInt(300, 1200)));
    const increment = randomInt(10, 25);
    current = updateJob(current, {
      progress: Math.min(100, current.progress + increment)
    });
    if (current.progress >= 100) break;
  }
  return current;
};

export const runJob = async (id: string) => {
  const job = jobMap.get(id);
  if (!job || (job.state !== 'queued' && job.state !== 'running')) return;
  let current = job.state === 'queued' ? updateJob(job, { state: 'running', progress: 5 }) : job;

  try {
    current = await simulateProgress(current);
    if (current.state === 'canceled') {
      finalizeJob(current, 'canceled');
      return;
    }
    const failureChance = Math.random();
    if (failureChance < 0.12) {
      finalizeJob(current, 'failed', 'Simulated import failure. Please retry.');
      return;
    }
    finalizeJob(current, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Job execution failed.';
    finalizeJob(current, 'failed', message);
  }
};

export const cancelJob = (id: string) => {
  const job = jobMap.get(id);
  if (!job) return;
  if (job.state === 'success' || job.state === 'failed' || job.state === 'canceled') return;
  finalizeJob(job, 'canceled');
};

export const clearJobs = () => {
  jobMap.clear();
  listeners.clear();
};
