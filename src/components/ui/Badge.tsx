import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-rule text-muted',
  primary: 'border-accent text-accent-text',
  secondary: 'border-rule text-muted',
  success: 'border-rule text-ink',
  warning: 'border-rule text-ink',
  danger: 'border-accent text-accent-text',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-0.5 font-sans text-[9.5px] font-semibold uppercase tracking-[.09em]', toneClasses[tone], className)}>
      {children}
    </span>
  );
}
