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
    <section className={cn('rounded-[5px] border border-[#384048] bg-[#2e3338] p-4 shadow-xs transition-colors', className)}>
      {title && (
        <header className="flex min-h-[30px] items-center justify-between gap-4 border-b border-[#384048] pb-2.5 mb-3">
          <h2 className="font-sans text-[13px] font-bold tracking-wide text-[#f0f3fa]">
            {title}
          </h2>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}
