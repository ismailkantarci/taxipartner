import { buildAuthHeaders, buildJsonHeaders } from '../api/http';
import type { JsonObject } from '../types/json';

const API = (import.meta.env.VITE_IDENTITY_API ?? 'http://localhost:3000').replace(/\/+$/, '');

export interface TaskItem {
  id: string;
  name: string;
  description?: string | null;
  cron: string;
  isEnabled: boolean;
  channels?: string | null;
  payload?: string | null;
  lastRunAt?: string | null;
  createdAt?: string;
}

export interface TasksResponse {
  ok: boolean;
  items?: TaskItem[];
  error?: string;
}

export interface TaskMutationResponse {
  ok: boolean;
  task?: TaskItem;
  error?: string;
}

export interface TaskMutationInput {
  name: string;
  description?: string;
  cron: string;
  channels: JsonObject;
  payload: JsonObject;
  isEnabled: boolean;
}

async function asJson<T extends { ok?: boolean; error?: string }>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return { ok: false, error: 'Beklenmeyen yanıt' } as T;
  }
}

export async function listTasks(): Promise<TasksResponse> {
  const response = await fetch(`${API}/tasks`, { headers: buildAuthHeaders() });
  return asJson<TasksResponse>(response);
}

export async function createTask(body: TaskMutationInput): Promise<TaskMutationResponse> {
  const response = await fetch(`${API}/tasks`, {
    method: 'POST',
    headers: buildJsonHeaders(buildAuthHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<TaskMutationResponse>(response);
}

export async function updateTask(id: string, body: TaskMutationInput): Promise<TaskMutationResponse> {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: buildJsonHeaders(buildAuthHeaders()),
    body: JSON.stringify(body)
  });
  return asJson<TaskMutationResponse>(response);
}

export async function deleteTask(id: string): Promise<TaskMutationResponse> {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildAuthHeaders()
  });
  return asJson<TaskMutationResponse>(response);
}

export async function runTask(id: string): Promise<TaskMutationResponse> {
  const response = await fetch(`${API}/tasks/${encodeURIComponent(id)}/run`, {
    method: 'POST',
    headers: buildAuthHeaders()
  });
  return asJson<TaskMutationResponse>(response);
}
