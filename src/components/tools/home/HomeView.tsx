import { ChevronRight, Flame, MessageSquare, Tally5 } from 'lucide-react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { formatTime } from '../../../lib/format';
import { useConnectionStore } from '../../../store/connectionStore';
import { useCounterStore } from '../../../store/counterStore';
import { useLogStore } from '../../../store/logStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useToolStore } from '../../../store/toolStore';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export function HomeView() {
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const counters = useCounterStore((s) => s.counters);
  const entries = useLogStore((s) => s.entries);
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const authRequired = useConnectionStore((s) => s.authRequired);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const total = counters.reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Flame size={22} className="text-primary" aria-hidden />
          <h1 className="font-display text-3xl uppercase leading-none text-ink">{t(lang, 'home.title')}</h1>
        </div>
        <div className="mt-5 h-px bg-ink/20">
          <div className="h-px w-56 bg-primary" />
        </div>
        <p className="mt-4 font-sans text-sm font-semibold uppercase tracking-[0.12em] text-ink/65">
          {t(lang, 'home.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card title={t(lang, 'home.connection')} className="xl:col-span-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-[0.1em] text-ink/80">
                <span
                  aria-hidden
                  className={`inline-block size-2 rounded-full ${
                    twitchConnected ? 'ember-glow bg-primary' : 'border border-ink/40 bg-transparent'
                  }`}
                />
                {t(lang, 'titlebar.twitch')}
              </span>
              {twitchConnected ? (
                <span dir="ltr" className="font-mono text-xs text-ink/70">{twitchChannel ?? ''}</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    rpc.invoke(Channels.TwitchAuthorize).catch(() => undefined);
                  }}
                >
                  {t(lang, 'home.connect')}
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-ink/15 pt-4">
              <span className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-[0.1em] text-ink/80">
                <span aria-hidden className="ember-glow inline-block size-2 rounded-full bg-success" />
                {t(lang, 'home.core')}
              </span>
              <span dir="ltr" className="font-mono text-xs text-ink/70">OK</span>
            </div>
            {authRequired && (
              <div className="border-t border-ink/15 pt-4">
                <Badge tone="warning">{t(lang, 'home.authRequired')}</Badge>
              </div>
            )}
          </div>
        </Card>

        <button
          type="button"
          onClick={() => setActiveTool('counter')}
          className="slab cursor-pointer p-6 text-start transition-colors duration-150 hover:border-ink/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:col-span-4"
        >
          <div className="flex items-center gap-2">
            <Tally5 size={16} className="text-primary" aria-hidden />
            <h2 className="font-display text-lg uppercase tracking-[0.04em] text-ink">
              {t(lang, 'home.counters')}
            </h2>
          </div>
          <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">
            {t(lang, counters.length === 1 ? 'home.countersStat' : 'home.countersStatPlural', {
              n: counters.length,
              total,
            })}
          </p>
          <div className="mt-4 space-y-1.5">
            {counters.length === 0 && (
              <p className="font-sans text-sm text-ink/70">{t(lang, 'home.noCountersYet')}</p>
            )}
            {counters.slice(0, 5).map((counter) => (
              <div key={counter.id} className="flex items-center justify-between">
                <span className="truncate font-sans text-sm text-ink/80">{counter.name}</span>
                <span className="shrink-0 border border-ink/20 bg-surface px-2 py-0.5 font-mono text-sm font-bold text-ink">
                  {String(counter.count).padStart(3, '0')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-1 font-sans text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {t(lang, 'home.openCounters')}
            <ChevronRight size={13} aria-hidden className="rtl:rotate-180" />
          </div>
        </button>

        <Card title={t(lang, 'home.recentActivity')} className="xl:col-span-4">
          <div className="space-y-2.5">
            {entries.length === 0 && (
              <p className="font-sans text-sm text-ink/70">{t(lang, 'home.nothingYet')}</p>
            )}
            {entries.slice(0, 4).map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className="shrink-0 font-mono text-xs text-ink/70">{formatTime(entry.timestamp)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink/80" title={entry.message}>
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-ink/15 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTool('counter')}
              title={t(lang, 'home.openFeed')}
            >
              {t(lang, 'home.openFeed')}
              <ChevronRight size={13} aria-hidden className="rtl:rotate-180" />
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:col-span-12">
          {[
            { icon: MessageSquare, name: t(lang, 'nav.alerts'), note: t(lang, 'home.alertsNote') },
          ].map((tool) => (
            <button
              key={tool.name}
              type="button"
              disabled
              className="slab cursor-not-allowed p-6 text-start opacity-70"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <tool.icon size={16} className="text-ink/50" aria-hidden />
                  <h2 className="font-display text-lg uppercase tracking-[0.04em] text-ink/70">{tool.name}</h2>
                </div>
                <span className="border border-ink/30 px-1 py-0.5 font-sans text-xs font-bold tracking-wider text-ink/65">
                  {t(lang, 'common.soon')}
                </span>
              </div>
              <p className="mt-3 font-sans text-sm text-ink/70">{tool.note}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
