import { Flame, Trash2 } from 'lucide-react';
import type { LogKind } from '../../../rpc/contracts';
import { formatTime } from '../../../lib/format';
import type { LogEntry } from '../../../store/logStore';
import { useLogStore } from '../../../store/logStore';
import { cn } from '../../../lib/cn';
import { t } from '../../../i18n/translations';
import { useSettingsStore } from '../../../store/settingsStore';
import type { BadgeTone } from '../../ui/Badge';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

const KIND_KEYS: Record<LogKind, string> = {
  chat: 'badge.chat',
  trigger: 'badge.trigger',
  'cooldown-denied': 'badge.cooldown',
  'permission-denied': 'badge.denied',
  manual: 'badge.manual',
  reset: 'badge.reset',
  system: 'badge.system',
  'obs-ok': 'badge.obs',
  'obs-error': 'badge.obs',
};

const KIND_TONES: Record<LogKind, BadgeTone> = {
  chat: 'secondary',
  trigger: 'success',
  'cooldown-denied': 'warning',
  'permission-denied': 'warning',
  manual: 'primary',
  reset: 'neutral',
  system: 'secondary',
  'obs-ok': 'success',
  'obs-error': 'danger',
};

function LogRow({ entry, lang }: { entry: LogEntry; lang: 'en' | 'ar' }) {
  return (
    <li className="flex items-center gap-4 px-4 py-2.5">
      <span dir="ltr" className="w-16 shrink-0 font-mono text-xs text-ink/70">
        {formatTime(entry.timestamp)}
      </span>
      <span className="w-24 shrink-0">
        <Badge tone={KIND_TONES[entry.kind]}>{t(lang, KIND_KEYS[entry.kind])}</Badge>
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate font-mono text-sm text-ink',
          entry.kind === 'permission-denied' && 'struck text-ink/75',
        )}
        title={entry.message}
      >
        {entry.message}
      </span>
      {entry.count !== undefined && (
        <span dir="ltr" className="shrink-0 border border-ink/20 bg-surface px-2 py-0.5 font-mono text-sm font-bold text-ink">
          {String(entry.count).padStart(3, '0')}
        </span>
      )}
    </li>
  );
}

interface ActivityLogProps {
  className?: string;
}

export function ActivityLog({ className }: ActivityLogProps) {
  const entries = useLogStore((s) => s.entries);
  const clear = useLogStore((s) => s.clear);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  return (
    <Card
      title={t(lang, 'feed.title')}
      className={className}
      action={
        <Button variant="ghost" size="sm" onClick={clear} disabled={entries.length === 0} title={t(lang, 'feed.clear')}>
          <Trash2 size={13} />
          {t(lang, 'feed.clear')}
        </Button>
      }
    >
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Flame size={26} strokeWidth={1.5} className="text-primary/60" />
          <div className="mt-4 font-display text-lg uppercase tracking-[0.04em] text-ink/70">
            {t(lang, 'feed.empty')}
          </div>
          <div className="mt-2 font-sans text-xs font-semibold uppercase tracking-[0.15em] text-ink/70">
            {t(lang, 'feed.emptyHint')}
          </div>
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-ink/10 overflow-y-auto border border-ink/15 bg-surface">
          {entries.map((entry) => (
            <LogRow key={entry.id} entry={entry} lang={lang} />
          ))}
        </ul>
      )}
    </Card>
  );
}
