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
export function SidePanel({ title, onClose, position, children }: { title: string; onClose: () => void; position?: SidePanelPosition; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open/close effect on every parent render.
  const close = useRef(onClose);
  close.current = onClose;

  // Read during render: a child's autoFocus runs at commit, before any effect, and would be captured instead.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const page = document.getElementById('root');
    page?.setAttribute('inert', '');
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      page?.removeAttribute('inert');
      opener?.focus();
    };
  }, [opener]);

  // On the document, not the layer: focus can fall to <body> (a button that just disabled itself) and Escape must still close.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
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
      <div className="side-panel-dim" data-testid="side-panel-dim" onClick={onClose} />
      <div className="side-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <div className="side-panel-bar">
          {position ? (
            <>
              <span className="side-panel-pos">{position.index} of {position.total}</span>
              <button type="button" className="btn btn-icon" aria-label="Previous" disabled={position.index <= 1} onClick={position.onPrev}><Icon name="chevronLeft" /></button>
              <button type="button" className="btn btn-icon" aria-label="Next" disabled={position.index >= position.total} onClick={position.onNext}><Icon name="chevronRight" /></button>
            </>
          ) : null}
          <button type="button" className="btn btn-icon side-panel-close" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <h2 id={titleId} className="side-panel-title">{title}</h2>
        <div className="side-panel-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
