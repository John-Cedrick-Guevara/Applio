import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './button';

/**
 * Confirms a hard-to-undo action. The title names the exact thing ('Skip job
 * "Platform Engineer" at Ledgerly?'), the button repeats the verb. Focus starts on
 * Cancel and stays inside; Escape or the backdrop cancels; focus goes back to the
 * trigger on close.
 */
export function ConfirmDialog({ title, confirmLabel, onConfirm, onCancel, children }: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => trigger?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Tab') {
      // Two buttons: Tab and Shift+Tab both just swap between them.
      e.preventDefault();
      (document.activeElement === cancelRef.current ? confirmRef : cancelRef).current?.focus();
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} className="dialog" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <h2 id={titleId} className="dialog-title">{title}</h2>
        <p id={bodyId} className="dialog-body">{children}</p>
        <div className="dialog-actions">
          <Button ref={cancelRef} onClick={onCancel}>Cancel</Button>
          <Button ref={confirmRef} variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
