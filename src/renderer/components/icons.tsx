import type { SVGProps } from 'react';

/**
 * Stroke icons from the prototype, drawn on a 20×20 grid in `currentColor`.
 * Decorative by default (aria-hidden); pair with visible text or an aria-label.
 */
const PATHS = {
  review: <><path d="M3 12h4l1 2h4l1-2h4" /><path d="M5 4h10l2 8v4H3v-4z" /></>,
  applications: <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M3 8h14" /></>,
  profile: <><circle cx="10" cy="7" r="3" /><path d="M4 17c1-3 3.5-4.5 6-4.5s5 1.5 6 4.5" /></>,
  usage: <path d="M4 16v-5M10 16V4M16 16V9" />,
  settings: <><path d="M3 6h8M15 6h2M3 14h2M9 14h8" /><circle cx="13" cy="6" r="2" /><circle cx="7" cy="14" r="2" /></>,
  plus: <path d="M10 4v12M4 10h12" />,
  matches: <path d="M4 5h12M4 10h12M4 15h7" />,
  check: <path d="M4 10l4 4 8-8" />,
  minus: <path d="M5 10h10" />,
  shield: <><path d="M10 2l6 3v5c0 4-3 7-6 8-3-1-6-4-6-8V5z" /><path d="M7 10l2 2 4-4" /></>,
  external: <path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8" />,
  search: <><circle cx="9" cy="9" r="5" /><path d="M13 13l4 4" /></>,
  edit: <path d="M4 16h3l9-9-3-3-9 9zM12 5l3 3" />,
  chevronLeft: <path d="M12 5l-5 5 5 5" />,
  chevronRight: <path d="m8 5 5 5-5 5" />,
  close: <path d="M5 5l10 10M15 5 5 15" />,
  doneCircle: <><circle cx="10" cy="10" r="8" /><path d="M6.5 10l2.5 2.5 4.5-5" /></>,
} as const;

export type IconName = keyof typeof PATHS;

/** One prototype icon by name; `currentColor` stroke so it follows the text color. */
export function Icon({ name, size = 16, strokeWidth = 1.6, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * Applio mark (v5): an A whose crossbar becomes a lavender arrow, on a rounded tile.
 * `tone="light"` is a white tile for the dark rail; `"dark"` an ink tile for light surfaces.
 */
export function Logo({ tone = 'dark', size = 34 }: { tone?: 'light' | 'dark'; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" className="logo" style={{ flex: 'none' }}>
      <rect width="34" height="34" rx="10" style={{ fill: tone === 'light' ? 'var(--on-ink)' : 'var(--ink)' }} />
      <path d="M7 26 14 8l7 18" fill="none" style={{ stroke: tone === 'light' ? 'var(--ink)' : 'var(--on-ink)' }} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 19H27M24 16l3 3-3 3" fill="none" style={{ stroke: 'var(--lavender-mark)' }} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A file outline used for resume attachments. */
export function FileIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#5F6672" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10l5 5v17H7z" />
      <path d="M17 3v5h5" />
    </svg>
  );
}
