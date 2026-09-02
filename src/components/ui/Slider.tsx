interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function Slider({ value, min, max, step, onChange, ariaLabel, disabled }: SliderProps) {
  return (
    <input
      type="range"
      className="art-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
