import React, { useEffect, useRef, useState } from 'react';
import { BellOff, Check, Clock3, Trash2, X } from 'lucide-react';
import {
  useNotices,
  markRead,
  markUnread,
  markAllRead,
  clear,
  update
} from '../../lib/notifications/store';
import type { Notice } from '../../lib/notifications/types';
import { useJob } from '../../lib/jobs/hooks';
import { cancelJob } from '../../lib/jobs/jobs';
import { useCan } from '../../lib/rbac/guard';

const formatTimestamp = (ts: number) => {
  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'Just now';
  if (diff < hour) {
    const mins = Math.round(diff / minute);
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  if (diff < day) {
    const hours = Math.round(diff / hour);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const date = new Date(ts);
  return date.toLocaleString();
};

type NotificationCenterProps = {
  isOpen: boolean;
  onClose: () => void;
};

type NoticeItemProps = {
  notice: Notice;
  canManageJobs: boolean;
  onToggleRead: (notice: Notice) => void;
  onCancelJob: (notice: Notice) => void;
};

const NoticeItem: React.FC<NoticeItemProps> = ({ notice, canManageJobs, onToggleRead, onCancelJob }) => {
  const job = useJob(notice.jobId ?? null);
  const progress = job?.progress ?? notice.progress;
  const jobState = job?.state;
  const running = jobState === 'queued' || jobState === 'running';

  return (
    <li
      className={`rounded-2xl border px-4 py-3 shadow-sm transition focus-within:ring-2 focus-within:ring-slate-500/40 dark:border-slate-800 ${
        notice.type === 'success'
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : notice.type === 'warning'
          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
          : notice.type === 'error'
          ? 'border-rose-200 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/15'
          : 'border-slate-200 bg-white dark:bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notice.title}</p>
          {notice.body ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notice.body}</p> : null}
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{formatTimestamp(notice.ts)}</p>

          {typeof progress === 'number' && (jobState || notice.jobId) ? (
            <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{jobState ? `Job ${jobState}` : 'Queued'} • {progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-slate-900 transition-all dark:bg-slate-100"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {running && canManageJobs ? (
                <button
                  type="button"
                  onClick={() => onCancelJob(notice)}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel job
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {notice.link ? (
            <a
              href={notice.link}
              target={notice.link.startsWith('blob:') ? '_blank' : '_self'}
              rel="noopener"
              className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Open
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => onToggleRead(notice)}
            className="text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            Mark {notice.read ? 'unread' : 'read'}
          </button>
        </div>
      </div>
    </li>
  );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const notices = useNotices();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [announce, setAnnounce] = useState('');
  const canManageJobs = useCan('program.goals.import');

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (notices.length === 0) return;
    const latest = notices[0];
    setAnnounce(`${latest.title}${latest.body ? `. ${latest.body}` : ''}`);
  }, [notices.length, notices[0]?.id]);

  const handleToggleRead = (notice: Notice) => {
    if (notice.read) {
      markUnread(notice.id);
    } else {
      markRead(notice.id);
    }
  };

  const handleCancelJob = (notice: Notice) => {
    if (!notice.jobId) return;
    cancelJob(notice.jobId);
    update(notice.id, {
      type: 'warning',
      title: 'Import canceled',
      body: 'The import job has been canceled.',
      read: false,
      progress: 0
    });
  };

  if (!isOpen) {
    return <div className="sr-only" aria-live="polite">{announce}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm dark:bg-black/30">
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Notifications</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Track background jobs and critical events.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Close notifications"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear all
            </button>
          </div>
          <span>{notices.length} total</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {notices.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <BellOff className="h-8 w-8" aria-hidden="true" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notices.map(notice => (
                <NoticeItem
                  key={notice.id}
                  notice={notice}
                  canManageJobs={canManageJobs}
                  onToggleRead={handleToggleRead}
                  onCancelJob={handleCancelJob}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
