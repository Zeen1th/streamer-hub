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
        'relative shrink-0 rounded-full border transition-all duration-150 disabled:opacity-35',
        large ? 'h-5 w-[38px]' : 'h-[18px] w-[34px]',
        checked
          ? 'border-[#8b5cf6] bg-[#8b5cf6] shadow-[0_0_8px_rgba(139,92,246,0.35)]'
          : 'border-white/[0.16] bg-white/[0.06] hover:border-white/[0.24] hover:bg-white/[0.09]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150 shadow-xs',
          large ? 'size-[14px]' : 'size-3',
          checked
            ? 'start-[calc(100%-16px)] bg-white'
            : 'start-0.5 bg-[#8c96ae]',
        )}
      />
    </button>
  );
}
