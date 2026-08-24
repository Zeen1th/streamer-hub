import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, action, className, children }: CardProps) {
  return (
    <section className={cn('slab', className)}>
      {title && (
        <header className="flex items-start justify-between gap-4 border-b border-ink/15 px-6 py-4">
          <h2 className="font-display text-lg uppercase leading-tight tracking-[0.04em] text-ink">
            {title}
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}
