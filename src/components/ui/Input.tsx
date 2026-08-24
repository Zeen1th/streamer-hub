import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full border border-ink/25 bg-surface-2 px-3 font-mono text-sm text-ink placeholder:text-ink/65',
        'transition-colors duration-150',
        'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
        'disabled:opacity-40',
        className,
      )}
      {...rest}
    />
  );
}
