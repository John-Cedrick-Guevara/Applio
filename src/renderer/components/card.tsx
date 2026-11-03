import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** No inner padding: header gets a divider and children run edge to edge (lists, tables). */
  flush?: boolean;
  className?: string;
  label?: string;
  children: ReactNode;
}

/** White bordered section — the prototype's main container. */
export function Card({ title, description, actions, flush, className, label, children }: CardProps) {
  return (
    <section className={['card', flush && 'card-flush', className].filter(Boolean).join(' ')} aria-label={title ? undefined : label}>
      {title || actions ? (
        <div className="card-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
