import { Trash2 } from 'lucide-react';
import type { LogKind } from '../../../rpc/contracts';
import { formatTime } from '../../../lib/format';
import { useLogStore } from '../../../store/logStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useToolStore } from '../../../store/toolStore';
import { t } from '../../../i18n/translations';
import { Button } from '../../ui/Button';

const FILTERS: { value: 'all' | LogKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'trigger', label: 'TRIGGER' },
  { value: 'obs-ok', label: 'WRITE' },
  { value: 'permission-denied', label: 'DENY' },
  { value: 'cooldown-denied', label: 'SKIP' },
  { value: 'obs-error', label: 'ERROR' },
];

const KIND_LABEL: Record<LogKind, string> = {
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

const KIND_COLOR: Record<LogKind, string> = {
  chat: 'text-[#9AA3AF]',
  trigger: 'text-[#A5B4FC]',
  'obs-ok': 'text-[#5FD0A8]',
  'permission-denied': 'text-[#F5B324]',
  'cooldown-denied': 'text-[#9AA3AF]',
  manual: 'text-[#A5B4FC]',
  reset: 'text-[#A5B4FC]',
  system: 'text-[#9AA3AF]',
  'obs-error': 'text-[#F04E5A]',
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
    <section className={`app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#23282e] p-[16px_18px_28px] text-[#f0f3f7] ${className}`} aria-label={t(lang, 'workspace.activity')}>
      {/* View Head */}
      <div className="mb-[14px]">
        <h1 className="m-0 font-sans text-[19px] font-extrabold tracking-[-0.015em] text-white">
          Activity
        </h1>
        <p className="mt-1 font-sans text-[12.5px] text-[#9AA3AF]">
          The full log — triggers, writes, denials and errors, newest first.
        </p>
      </div>

      {/* Filter Chips Bar */}
      <div className="mb-3 flex items-center gap-1.5" data-od-id="activity-filters">
        {FILTERS.map((item) => {
          const isActive = filter === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setFilter(item.value)}
              className={`h-[30px] rounded-[6px] border px-3 text-[11.5px] font-semibold transition-colors ${
                isActive
                  ? 'border-[#6366F1] bg-[#6366F1] text-white'
                  : 'border-white/[0.08] bg-white/[0.04] text-[#9AA3AF] hover:bg-white/[0.09] hover:text-[#f0f3f7]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <Button size="sm" variant="outline" className="ms-auto h-[30px] text-[11.5px]" onClick={clear} disabled={entries.length === 0}>
          <Trash2 size={12} />{t(lang, 'feed.clear')}
        </Button>
      </div>

      {/* Log Box */}
      <div className="overflow-hidden rounded-[7px] border border-white/[0.08] bg-[#2e3438] font-mono text-[11.5px]" data-od-id="activity-log" tabIndex={0}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center font-sans text-[12px] text-[#9AA3AF]">
            {t(lang, 'workspace.noActivity')}
          </div>
        ) : (
          filtered.map((entry) => {
            const isError = entry.kind === 'obs-error';
            return (
              <div
                key={entry.id}
                className={`grid grid-cols-[88px_74px_minmax(0,1fr)] gap-3 border-b border-white/[0.08] p-[9px_14px] text-[#CBD3DC] transition-colors last:border-b-0 ${
                  isError ? 'bg-[#f04e5a]/[0.07]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-[#9AA3AF]">{formatTime(entry.timestamp)}</span>
                <span className={`font-semibold ${KIND_COLOR[entry.kind] || 'text-[#9AA3AF]'}`}>
                  {KIND_LABEL[entry.kind]}
                </span>
                <span dir="auto" className={`min-w-0 break-words ${isError ? 'text-[#FF8A93]' : ''}`}>
                  {entry.message}
                  {entry.count !== undefined ? ` · ${entry.count}` : ''}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
