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
    'border-primary bg-primary text-on-primary hover:brightness-110 active:brightness-95',
  outline:
    'border-ink/30 bg-surface-2 text-ink hover:border-ink/60 hover:bg-ink/5 active:bg-ink/10',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10',
  danger:
    'border-danger/60 bg-surface-2 text-danger hover:border-danger hover:bg-danger hover:text-on-primary active:brightness-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-xs',
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center border font-sans font-semibold uppercase tracking-[0.08em] transition-[filter,background-color,color,border-color] duration-150',
        'disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
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
