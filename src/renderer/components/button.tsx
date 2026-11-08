import type { ButtonHTMLAttributes, Ref } from 'react';

export type ButtonVariant = 'primary' | 'strong' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'link' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary/strong = blue (one accent per view), secondary = outlined, destructive = filled red (confirm dialogs only). */
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  /** Disables the button and marks it busy while an action runs. */
  busy?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** The one button style used across the app. Defaults to `type="button"` so it never submits forms by accident. */
export function Button({ variant = 'secondary', size = 'md', busy, disabled, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    />
  );
}

/** Button classes for elements that must be links (`<a>`) but look like buttons. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: 'sm' | 'md' = 'md', extra?: string): string {
  return ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', extra].filter(Boolean).join(' ');
}
