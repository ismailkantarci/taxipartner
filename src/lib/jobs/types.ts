export type JobState = 'queued' | 'running' | 'success' | 'failed' | 'canceled';
export type JobKind = 'goals.csv.import';

export interface Job<T = any> {
  id: string;
  kind: JobKind;
  payload: T;
  state: JobState;
  progress: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export type JobListener<T = any> = (job: Job<T>) => void;
