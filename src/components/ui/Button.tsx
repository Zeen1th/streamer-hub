import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-accent-fill bg-accent-fill text-on-accent hover:brightness-95 active:brightness-90',
  outline: 'border-rule bg-transparent text-ink hover:bg-accent-soft active:bg-accent-soft',
  ghost: 'border-transparent bg-transparent text-ink hover:bg-accent-soft active:bg-accent-soft',
  danger: 'border-rule bg-transparent text-accent-text hover:border-accent-fill hover:bg-accent-fill hover:text-on-accent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[26px] gap-1.5 px-2.5 text-[11px]',
  md: 'h-[30px] gap-2 px-3 text-[12px]',
  lg: 'h-[34px] gap-2 px-4 text-[13px]',
};

export function Button({ variant = 'primary', size = 'md', className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center border font-sans font-semibold',
        'disabled:pointer-events-none disabled:opacity-45',
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
