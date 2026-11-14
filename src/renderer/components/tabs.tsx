import type { KeyboardEvent, ReactNode } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** A count shown in a bubble after the label. */
  count?: number;
}

/**
 * Pill tabs (v5) with the tabs pattern's keyboard: arrows, Home and End move and wrap,
 * and only the selected tab is in the Tab order. Pair each tab with a `TabPanel`.
 */
export function TabList<T extends string>({ tabs, value, onChange, label, idPrefix }: { tabs: TabDef<T>[]; value: T; onChange: (id: T) => void; label: string; idPrefix: string }) {
  const onKeyDown = (e: KeyboardEvent) => {
    const at = tabs.findIndex((t) => t.id === value);
    const to = e.key === 'ArrowRight' ? (at + 1) % tabs.length : e.key === 'ArrowLeft' ? (at + tabs.length - 1) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = tabs[to]!.id;
    onChange(next);
    document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button key={t.id} id={`${idPrefix}-tab-${t.id}`} type="button" role="tab" className="tab" tabIndex={value === t.id ? 0 : -1} aria-selected={value === t.id} aria-controls={`${idPrefix}-${t.id}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * A tab's panel. Every panel stays mounted and only the active one shows, so an open
 * editor or a half-typed field survives a look at another tab.
 */
export function TabPanel({ idPrefix, id, active, children }: { idPrefix: string; id: string; active: boolean; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-${id}`} aria-labelledby={`${idPrefix}-tab-${id}`} hidden={!active} className="tab-panel">
      {children}
    </div>
  );
}
