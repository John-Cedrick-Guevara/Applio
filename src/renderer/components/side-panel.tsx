import { useEffect, useId, useRef, type ReactNode } from 'react';
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

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const page = document.getElementById('root');
    page?.setAttribute('inert', '');
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      page?.removeAttribute('inert');
      trigger?.focus();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
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
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="side-panel-layer" onKeyDown={onKeyDown}>
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
