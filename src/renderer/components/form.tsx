import { useId, type ReactNode } from 'react';

interface ToggleProps {
  label: string;
  /** Keeps the label for screen readers only, e.g. in a table row that already names the item. */
  hideLabel?: boolean;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** On/off switch built on a button with `role="switch"` so it's keyboard and screen-reader friendly. */
export function Toggle({ label, hideLabel, description, checked, disabled, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div>
        <span id={id} className={hideLabel ? 'visually-hidden' : 'toggle-label'}>{label}</span>
        {description ? <p className="field-hint">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className="toggle"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
