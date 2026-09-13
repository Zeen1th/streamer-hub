import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-[#cbd3e6]',
  primary: 'border-purple-500/30 bg-purple-500/15 text-[#d8b4fe] font-semibold',
  secondary: 'border-white/[0.06] bg-white/[0.025] text-[#9ca3b8]',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-300',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-2 py-0.5 font-sans text-[10px] font-semibold tracking-wide', toneClasses[tone], className)}>
      {children}
    </span>
  );
}
