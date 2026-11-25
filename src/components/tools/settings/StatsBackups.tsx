import { RotateCcw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels, type StatsBackupInfo } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { useStatsStore } from '../../../store/statsStore';
import { Button } from '../../ui/Button';

function kindKey(kind: StatsBackupInfo['kind']) {
  switch (kind) {
    case 'last':
      return 'backups.stats.kindLast' as const;
    case 'before-reset':
      return 'backups.stats.kindBeforeReset' as const;
    case 'before-reset-everything':
      return 'backups.stats.kindBeforeResetAll' as const;
    default:
      return 'backups.stats.kindDaily' as const;
  }
}

/** Settings > Backups > Leaderboards: bring back an earlier copy of the leaderboard stats (asks once). */
export function StatsBackups() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const restoreFromJson = useStatsStore((s) => s.restoreFromJson);
  const [backups, setBackups] = useState<StatsBackupInfo[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await rpc.invoke(Channels.StatsBackupsList, undefined);
      setBackups(res.backups);
    } catch {
      setBackups([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const restore = async (name: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await rpc.invoke(Channels.StatsBackupRestore, { name });
      if (res.ok && res.json && restoreFromJson(res.json)) setMessage({ ok: true, text: t(lang, 'backups.stats.restored') });
      else setMessage({ ok: false, text: t(lang, 'backups.stats.failed') });
    } catch {
      setMessage({ ok: false, text: t(lang, 'backups.stats.failed') });
    }
    setConfirming(null);
    setBusy(false);
    void load();
  };

  const formatWhen = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <div className="space-y-3 border-t border-white/[0.08] pt-4">
      <div className="flex items-center gap-2 font-sans text-[13px] font-semibold text-ink">
        <Trophy size={14} className="text-amber-300" />
        {t(lang, 'backups.stats.title')}
      </div>
      <p className="font-sans text-xs leading-relaxed text-muted">{t(lang, 'backups.stats.desc')}</p>

      {message && (
        <div
          role="status"
          className={
            message.ok
              ? 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-sans text-xs text-emerald-200'
              : 'rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 font-sans text-xs text-rose-200'
          }
        >
          {message.text}
        </div>
      )}

      {backups === null ? null : backups.length === 0 ? (
        <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-3 font-sans text-xs text-muted">{t(lang, 'backups.stats.empty')}</div>
      ) : (
        <ul className="space-y-2">
          {backups.map((b) => (
            <li key={b.name} className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-sans text-xs font-semibold text-ink">{t(lang, kindKey(b.kind))}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted">{formatWhen(b.modified)}</div>
                  <div className="mt-1 font-sans text-[11.5px] text-muted">{t(lang, 'backups.stats.users', { n: b.users })}</div>
                </div>
                {confirming === b.name ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy} onClick={() => void restore(b.name)}>
                      <RotateCcw size={12} /> {t(lang, 'backups.stats.confirm')}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>
                      {t(lang, 'common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(b.name)}>
                    <RotateCcw size={12} /> {t(lang, 'backups.restore')}
                  </Button>
                )}
              </div>
              {confirming === b.name && <p className="mt-2 font-sans text-[11.5px] text-amber-300">{t(lang, 'backups.stats.confirmHint')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
