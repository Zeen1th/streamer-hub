import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, action, className, children }: CardProps) {
  return (
    <section className={cn('border-t border-rule bg-surface', className)}>
      {title && (
        <header className="flex min-h-[34px] items-center justify-between gap-4 border-b border-hair py-2">
          <h2 className="font-sans text-[12px] font-extrabold uppercase leading-tight tracking-[0.06em] text-ink">
            {title}
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="py-3">{children}</div>
    </section>
  );
}
