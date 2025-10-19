import React from 'react';
import { Modal } from '../../components/overlay/Modal';
import { cx } from './utils';

type FormDialogProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: React.ReactNode;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  disableSubmit?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeLabel?: string;
};

export const FormDialog: React.FC<FormDialogProps> = ({
  isOpen,
  title,
  description,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  disableSubmit = false,
  size,
  footer,
  secondaryAction,
  initialFocusRef,
  closeLabel
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    description={description}
    size={size}
    initialFocusRef={initialFocusRef}
    closeLabel={closeLabel}
  >
    <form
      onSubmit={event => {
        event.preventDefault();
        void onSubmit(event);
      }}
      className="flex flex-col gap-6"
    >
      <div className="space-y-4">{children}</div>
      {footer ? (
        footer
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          {secondaryAction}
          <button
            type="submit"
            disabled={disableSubmit || isSubmitting}
            className={cx(
              'inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900',
              disableSubmit || isSubmitting ? 'opacity-60' : 'hover:bg-slate-800 dark:hover:bg-slate-200'
            )}
          >
            {isSubmitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      )}
    </form>
  </Modal>
);

export default FormDialog;
