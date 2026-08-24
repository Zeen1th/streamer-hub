import type { CSSProperties } from 'react';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}

export function Slider({ value, min, max, step, onChange, ariaLabel }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const fill = `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percent}%, color-mix(in srgb, var(--ink) 15%, transparent) ${percent}%, color-mix(in srgb, var(--ink) 15%, transparent) 100%)`;
  return (
    <input
      type="range"
      className="art-slider"
      style={{ '--slider-fill': fill } as CSSProperties}
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
