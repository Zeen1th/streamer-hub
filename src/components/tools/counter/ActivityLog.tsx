import { Trash2 } from 'lucide-react';
import type { LogKind } from '../../../rpc/contracts';
import { formatTime } from '../../../lib/format';
import { useLogStore } from '../../../store/logStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useToolStore } from '../../../store/toolStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';

const FILTERS: { value: 'all' | LogKind; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'trigger', label: 'TRIGGER' },
  { value: 'obs-ok', label: 'WRITE' },
  { value: 'permission-denied', label: 'DENY' },
  { value: 'cooldown-denied', label: 'SKIP' },
  { value: 'obs-error', label: 'ERROR' },
];

const KIND: Record<LogKind, string> = {
  chat: 'CHAT',
  trigger: 'TRIGGER',
  'cooldown-denied': 'SKIP',
  'permission-denied': 'DENY',
  manual: 'MANUAL',
  reset: 'RESET',
  system: 'SYSTEM',
  'obs-ok': 'WRITE',
  'obs-error': 'ERROR',
};

interface ActivityLogProps { className?: string }

export function ActivityLog({ className = '' }: ActivityLogProps) {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const filter = useToolStore((s) => s.logFilter);
  const setFilter = useToolStore((s) => s.setLogFilter);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const filtered = filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);

  return (
    <section className={`flex min-h-0 flex-1 flex-col bg-surface ${className}`} aria-label={t(lang, 'workspace.activity')}>
      <div className="flex h-[38px] shrink-0 items-center gap-1.5 border-b border-rule bg-surface-2 px-2.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`h-[26px] border px-2.5 font-sans text-[10px] font-semibold tracking-[.06em] ${filter === item.value ? 'border-accent-fill bg-accent-fill text-on-accent' : 'border-rule bg-transparent text-ink hover:bg-accent-soft'}`}
          >
            {item.label}
          </button>
        ))}
        <Button size="sm" variant="outline" className="ms-auto" onClick={clear} disabled={entries.length === 0}>
          <Trash2 size={12} />{t(lang, 'feed.clear')}
        </Button>
      </div>
      <div className="app-scroll min-h-0 flex-1 px-3 py-2 font-mono text-[11.5px] leading-[1.75]" tabIndex={0}>
        {filtered.length === 0 ? (
          <div className="py-10 text-center font-sans text-[12px] text-muted">{t(lang, 'workspace.noActivity')}</div>
        ) : filtered.map((entry) => (
          <div key={entry.id} className={`grid grid-cols-[74px_64px_minmax(0,1fr)] gap-2 ${entry.kind === 'obs-error' ? 'text-accent-text' : 'text-ink'}`}>
            <span className="text-faint">{formatTime(entry.timestamp)}</span>
            <span className={entry.kind === 'trigger' ? 'text-accent-deep' : 'text-muted'}>{KIND[entry.kind]}</span>
            <span dir="auto" className="min-w-0 break-words">{entry.message}{entry.count !== undefined ? ` · ${entry.count}` : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
