import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, details, [tabindex]:not([tabindex="-1"])';

const getFocusableElements = (node: HTMLElement | null): HTMLElement[] => {
  if (!node) return [];
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    element => !element.hasAttribute('data-focus-guard')
  );
};

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  initialFocusRef?: React.RefObject<HTMLElement>;
  labelledById?: string;
  closeLabel?: string;
};

const container = () => {
  const existing = document.getElementById('modal-root');
  if (existing) return existing;
  const element = document.createElement('div');
  element.setAttribute('id', 'modal-root');
  document.body.appendChild(element);
  return element;
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  initialFocusRef,
  labelledById,
  closeLabel = 'Close dialog'
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const focusFirst = useCallback(() => {
    const first =
      initialFocusRef?.current ??
      getFocusableElements(contentRef.current)[0] ??
      contentRef.current;
    requestAnimationFrame(() => first?.focus());
  }, [initialFocusRef]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    lastFocusedRef.current = document.activeElement as HTMLElement;
    focusFirst();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first || !contentRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (lastFocusedRef.current) {
        lastFocusedRef.current.focus();
      }
    };
  }, [focusFirst, isOpen, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const widthClass =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  const labelledBy = labelledById ?? 'modal-title';

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm"
      onMouseDown={handleOverlayClick}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={description ? `${labelledBy}-description` : undefined}
        tabIndex={-1}
        className={`${widthClass} relative w-full rounded-2xl bg-white p-6 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:bg-slate-900 dark:text-slate-100`}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={labelledBy} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {title}
            </h2>
            {description ? (
              <p id={`${labelledBy}-description`} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div>{children}</div>
      </div>
    </div>,
    container()
  );
};

export default Modal;
