export type NoticeType = 'success' | 'warning' | 'error' | 'info';

export interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  body?: string;
  ts: number;
  read: boolean;
  link?: string;
  jobId?: string;
  progress?: number;
  tenantId?: string;
}
