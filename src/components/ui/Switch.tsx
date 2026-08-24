import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[22px] w-10 shrink-0 border transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        checked ? 'ember-track border-primary bg-primary' : 'border-ink/30 bg-ink/10',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute start-0.5 top-1/2 size-[14px] -translate-y-1/2 rounded-full transition-transform duration-150',
          checked ? 'translate-x-5 rtl:-translate-x-5 bg-on-primary' : 'translate-x-0 bg-ink',
        )}
      />
    </button>
  );
}
