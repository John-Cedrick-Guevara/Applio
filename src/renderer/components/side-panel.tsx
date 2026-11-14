import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

export interface SidePanelPosition {
  /** 1-based place in the list the panel was opened from. */
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Details for one list row, sliding over the page's right edge (v5 layout: lists take
 * the full width, details open only when asked). Mounting opens it. It takes focus,
 * traps Tab, makes the page behind inert, and on close returns focus to the row.
 */
export function SidePanel({ title, onClose, position, titleHidden = false, fallbackFocus, returnFocus, children }: { title: string; /** Where focus goes on close when the opener is gone (it was decided away): a selector for a row in the list behind. */ fallbackFocus?: string; onClose: () => void; position?: SidePanelPosition; /** The body already shows the title; keep it for the dialog's name only. */ titleHidden?: boolean; /** Evaluated on close: the row for the item being shown then, since stepping can leave the opener behind. */ returnFocus?: () => HTMLElement | null | undefined; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open/close effect on every parent render.
  const close = useRef(onClose);
  close.current = onClose;
  const focusBack = useRef(returnFocus);
  focusBack.current = returnFocus;

  // Read during render: a child's autoFocus runs at commit, before any effect, and would be captured instead.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const page = document.getElementById('root');
    page?.setAttribute('inert', '');
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      page?.removeAttribute('inert');
      const target = focusBack.current?.() ?? (opener?.isConnected && opener !== document.body ? opener : fallbackFocus ? document.querySelector<HTMLElement>(fallbackFocus) : null);
      target?.focus();
    };
  }, [opener, fallbackFocus]);

  /** Stepping remounts the detail, which would drop an open editor's text: focus the editor instead. */
  const step = (go: () => void) => {
    const editor = panel.current?.querySelector<HTMLElement>('textarea');
    if (editor) editor.focus();
    else go();
  };

  // On the document, not the layer: focus can fall to <body> (a button that just disabled itself) and Escape must still close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // Escape and the dim layer must not throw away a draft being edited: an open editor has a textarea.
        if (!panel.current?.querySelector('textarea')) close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (!panel.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return createPortal(
    <div className="side-panel-layer">
      <div className="side-panel-dim" data-testid="side-panel-dim" onClick={() => { if (!panel.current?.querySelector('textarea')) onClose(); }} />
      <div className="side-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="side-panel-bar">
          {position ? (
            <>
              <span className="side-panel-pos">{position.index} of {position.total}</span>
              <button type="button" className="btn btn-icon" aria-label="Previous" disabled={position.index <= 1} onClick={() => step(position.onPrev)}><Icon name="chevronLeft" /></button>
              <button type="button" className="btn btn-icon" aria-label="Next" disabled={position.index >= position.total} onClick={() => step(position.onNext)}><Icon name="chevronRight" /></button>
            </>
          ) : null}
          <button type="button" className="btn btn-icon side-panel-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <h2 id={titleId} className={titleHidden ? 'visually-hidden' : 'side-panel-title'}>{title}</h2>
        <div className="side-panel-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
