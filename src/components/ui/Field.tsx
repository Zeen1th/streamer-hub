import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-2 block font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink/70">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block font-sans text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block font-sans text-xs text-ink/70">{hint}</span>
      ) : null}
    </label>
  );
}
