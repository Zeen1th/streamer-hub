import { cn } from '../../lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  name?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" className={cn('flex min-w-0 rounded-[4px] border border-[#2a323a] bg-[#161c22] p-0.5 gap-0.5', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-[26px] min-w-0 flex-1 select-none rounded-[3px] px-2 font-sans text-[11px] font-medium transition-all duration-150',
              selected
                ? 'bg-[#2e3338] text-white border border-[#3d4856] shadow-xs'
                : 'bg-transparent text-[#8a94a0] hover:bg-[#20272e] hover:text-[#f0f3fa]',
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
