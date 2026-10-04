import { useState, useEffect } from 'react';
import { Slider } from './Slider';
import { cn } from '../../lib/cn';

export interface DurationPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: number[];
  unit?: string;
  label?: string;
  sublabel?: string;
  ariaLabel?: string;
  accentColor?: 'sky' | 'amber' | 'rose' | 'emerald' | 'purple' | 'teal' | 'default';
  className?: string;
  disabled?: boolean;
}

export function DurationPicker({
  value,
  onChange,
  min = 1,
  max = 300,
  step = 1,
  presets,
  unit = 's',
  label,
  sublabel,
  ariaLabel,
  accentColor = 'default',
  className,
  disabled = false,
}: DurationPickerProps) {
  const [textValue, setTextValue] = useState<string>(String(value ?? min));

  // Sync internal text state with external value changes
  useEffect(() => {
    setTextValue(String(value ?? min));
  }, [value, min]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);
    const num = Number(raw);
    if (!isNaN(num) && raw.trim() !== '') {
      onChange(Math.max(min, num));
    }
  };

  const handleTextBlur = () => {
    const num = Number(textValue);
    if (isNaN(num) || textValue.trim() === '' || num < min) {
      setTextValue(String(min));
      onChange(min);
    } else {
      onChange(num);
    }
  };

  const colorStyles = {
    sky: {
      activePreset: 'border-sky-500/40 bg-sky-500/20 text-sky-300',
      activeText: 'text-sky-400',
      focusRing: 'focus-within:border-sky-500/50',
    },
    amber: {
      activePreset: 'border-amber-500/40 bg-amber-500/20 text-amber-300',
      activeText: 'text-amber-400',
      focusRing: 'focus-within:border-amber-500/50',
    },
    rose: {
      activePreset: 'border-rose-500/40 bg-rose-500/20 text-rose-300',
      activeText: 'text-rose-400',
      focusRing: 'focus-within:border-rose-500/50',
    },
    emerald: {
      activePreset: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
      activeText: 'text-emerald-400',
      focusRing: 'focus-within:border-emerald-500/50',
    },
    purple: {
      activePreset: 'border-purple-500/40 bg-purple-500/20 text-purple-300',
      activeText: 'text-purple-400',
      focusRing: 'focus-within:border-purple-500/50',
    },
    teal: {
      activePreset: 'border-teal-500/40 bg-teal-500/20 text-teal-300',
      activeText: 'text-teal-400',
      focusRing: 'focus-within:border-teal-500/50',
    },
    default: {
      activePreset: 'border-accent/40 bg-accent/20 text-accent-text',
      activeText: 'text-accent',
      focusRing: 'focus-within:border-accent/50',
    },
  }[accentColor];

  // Dynamic slider max: if user types higher than default max, slider expands
  const sliderMax = Math.max(max, value || 0);

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3 transition-colors',
        className,
      )}
    >
      {/* Header: Label on left, Presets + Typed Number on right */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label ? (
          <div className="flex flex-col min-w-0">
            <span className="font-sans text-[12px] font-medium text-zinc-300">{label}</span>
            {sublabel && <span className="text-[10.5px] text-muted">{sublabel}</span>}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 ms-auto">
          {/* Quick Preset Chips */}
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {presets.map((p) => {
                const isSelected = value === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setTextValue(String(p));
                      onChange(p);
                    }}
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                      isSelected
                        ? colorStyles.activePreset
                        : 'bg-white/5 text-muted hover:text-white hover:bg-white/10',
                    )}
                  >
                    {p}
                    {unit}
                  </button>
                );
              })}
            </div>
          )}

          {/* Numeric typed input box */}
          <div
            className={cn(
              'flex h-6.5 items-center rounded border border-white/15 bg-black/40 px-1.5 font-mono text-[11px] shadow-inner transition-colors',
              colorStyles.focusRing,
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            <input
              type="number"
              min={min}
              step={step}
              value={textValue}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              disabled={disabled}
              className="w-11 bg-transparent text-end font-mono text-[11.5px] text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label={ariaLabel || label || 'Duration amount'}
            />
            <span className="ms-0.5 text-zinc-400 select-none text-[10px]">{unit}</span>
          </div>
        </div>
      </div>

      {/* Slider */}
      <Slider
        value={Math.min(sliderMax, Math.max(min, value || min))}
        min={min}
        max={sliderMax}
        step={step}
        onChange={(newVal) => {
          setTextValue(String(newVal));
          onChange(newVal);
        }}
        ariaLabel={ariaLabel || label || 'Duration'}
        disabled={disabled}
      />
    </div>
  );
}
