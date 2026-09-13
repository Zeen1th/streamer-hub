import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'border border-white/[0.09] bg-white/[0.06] text-[#f0f3fa] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.2)] hover:bg-white/[0.11] hover:border-white/[0.18] hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] active:bg-black/25 active:border-white/[0.06] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]',
  outline:
    'border border-white/[0.07] bg-white/[0.035] text-[#cbd3e6] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.08] hover:border-white/[0.14] hover:text-white active:bg-black/20 active:border-white/[0.05]',
  ghost:
    'border border-transparent bg-transparent text-[#9da6bc] hover:bg-white/[0.06] hover:text-[#f0f3fa] active:bg-white/[0.03]',
  danger:
    'border border-rose-500/30 bg-rose-500/15 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-rose-500/25 hover:border-rose-500/45 hover:text-white active:bg-rose-500/35',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[26px] gap-1.5 px-2.5 text-[11.5px] rounded-[4px]',
  md: 'h-[30px] gap-2 px-3 text-[12px] rounded-[4px]',
  lg: 'h-[34px] gap-2.5 px-4 text-[13px] rounded-[4px]',
};

export function Button({ variant = 'primary', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-sans font-medium tracking-normal transition-all duration-150 active:scale-[0.985] active:translate-y-[0.5px]',
        'disabled:pointer-events-none disabled:opacity-30 disabled:border-white/[0.04] disabled:bg-white/[0.015] disabled:text-[#636b80] disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
