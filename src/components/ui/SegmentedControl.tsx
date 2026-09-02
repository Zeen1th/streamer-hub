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
    <div role="radiogroup" className={cn('flex min-w-0 border border-rule', className)}>
      {options.map((option, index) => {
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
              'h-[30px] min-w-0 flex-1 select-none px-2 font-sans text-[11px] font-medium',
              index > 0 && 'border-s border-rule',
              selected ? 'bg-accent-fill font-extrabold text-on-accent' : 'bg-transparent text-ink hover:bg-accent-soft',
            )}
          >
            <span className="block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
