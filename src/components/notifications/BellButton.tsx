import React from 'react';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '../../lib/notifications/store';

type BellButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
};

const BellButton: React.FC<BellButtonProps> = ({ isOpen, onToggle }) => {
  const unread = useUnreadCount();
  const label = unread > 0 ? `${unread} unread notifications` : 'Notifications';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={label}
      className="relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-semibold text-white dark:bg-rose-400">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
  );
};

export default BellButton;
