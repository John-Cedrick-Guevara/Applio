export interface BlocksProps {
  filled: number;
  total: number;
  tone: 'lavender' | 'ice';
  /** Block height: `lg` for a hero card (28px), `sm` for a table or panel (16px). */
  size?: 'lg' | 'sm';
  /** Gap between blocks in px. */
  gap?: number;
  /** Extra classes, for layout or a page's own hooks. */
  className?: string;
  /** Gives the blocks a meter role with its own value, for a figure that is not stated elsewhere as text. */
  meter?: { label: string; now: number };
}

/**
 * A row of blocks, the first `filled` solid: the v5 meter. Decorative (hidden from
 * assistive tech) unless given `meter`, since the figure it draws is usually in the text beside it.
 */
export function Blocks({ filled, total, tone, size = 'sm', gap = 4, className, meter }: BlocksProps) {
  return (
    <div
      className={['blocks', `blocks-${tone}`, `blocks-${size}`, className].filter(Boolean).join(' ')}
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))`, gap }}
      {...(meter ? { role: 'meter', 'aria-label': meter.label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': meter.now } : { 'aria-hidden': true })}
    >
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < filled ? 'on' : undefined} />)}
    </div>
  );
}
