import { cn } from '../../lib/cn';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  size?: 'inspector' | 'settings';
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, size = 'inspector', disabled = false }: SwitchProps) {
  const large = size === 'settings';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 border border-rule bg-transparent disabled:opacity-45',
        large ? 'h-5 w-[38px]' : 'h-[18px] w-[34px]',
        checked && 'border-accent-fill bg-accent-fill',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2',
          large ? 'size-[14px]' : 'size-3',
          checked ? 'right-0.5 bg-on-accent' : 'left-0.5 bg-muted',
        )}
      />
    </button>
  );
}
