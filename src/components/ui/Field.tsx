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
      <span className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-[.1em] text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block font-sans text-[11px] text-accent-text">{error}</span>
      ) : hint ? (
        <span className="mt-1 block font-sans text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}
