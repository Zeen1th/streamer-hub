import type { ReactNode } from 'react';

/*
 * Windows 11 style settings rows: an icon, a title with one line of help, and the control on the far side.
 * Rows sit in a group under a small heading. Hard-coded colors are kept on purpose so the Fluent skin
 * generator (npm run gen:skin) can turn the row fill into a see-through layer.
 */

export function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      {title && <h2 className="mb-1.5 font-sans text-[13.5px] font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

interface SettingRowProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** The switch, button or value shown at the far end. */
  children?: ReactNode;
}

/** A small number box with "s" after it, for cooldowns in a setting row. Zero turns the limit off. */
export function SecondsBox({ value, onChange, label, max = 3600 }: { value: number; onChange: (seconds: number) => void; label: string; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="number"
        dir="ltr"
        min={0}
        max={max}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Math.max(0, Math.min(max, Number(event.target.value) || 0)))}
        className="h-[32px] w-[76px] rounded-[4px] border border-white/[0.09] bg-white/[0.05] px-2.5 text-end font-mono text-[13px] text-ink outline-none focus:border-accent"
      />
      <span className="text-[12.5px] text-muted">s</span>
    </span>
  );
}

export function SettingRow({ icon, title, description, children }: SettingRowProps) {
  return (
    <div className="setting-row flex min-h-[64px] items-center gap-4 rounded-[6px] border border-white/[0.07] bg-[#2a3036] px-4 py-3">
      {icon && <span className="grid size-5 shrink-0 place-items-center text-ink/85" aria-hidden>{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="font-sans text-[13.5px] leading-5 text-ink">{title}</div>
        {description && <div className="mt-0.5 font-sans text-[12px] leading-4 text-muted">{description}</div>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
