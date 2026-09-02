import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-[30px] w-full border border-rule bg-surface px-2.5 font-sans text-[13px] text-ink placeholder:text-faint',
        'focus:border-accent focus:outline-none disabled:opacity-45',
        className,
      )}
      {...rest}
    />
  );
}
