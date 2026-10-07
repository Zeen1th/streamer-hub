interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Called once when the user lets go (pointer up / key up). Use it for values that resize the page. */
  onCommit?: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
}

export function Slider({ value, min, max, step, onChange, onCommit, ariaLabel, disabled }: SliderProps) {
  const commit = (event: { currentTarget: HTMLInputElement }) => onCommit?.(Number(event.currentTarget.value));
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
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
}
