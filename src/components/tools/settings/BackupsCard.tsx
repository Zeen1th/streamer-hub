import { DatabaseBackup, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels, type SettingsBackupInfo } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

function kindKey(kind: SettingsBackupInfo['kind']) {
  switch (kind) {
    case 'last':
      return 'backups.kindLast' as const;
    case 'pending':
      return 'backups.kindPending' as const;
    case 'before-restore':
      return 'backups.kindBeforeRestore' as const;
    default:
      return 'backups.kindSnapshot' as const;
  }
}

/** Settings > Backups: pick an earlier copy of settings.json and bring it back (the app restarts to load it). */
export function BackupsCard() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [backups, setBackups] = useState<SettingsBackupInfo[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await rpc.invoke(Channels.SettingsListBackups, undefined);
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
      const res = await rpc.invoke(Channels.SettingsRestoreBackup, { name });
      if (!res.ok) setMessage(t(lang, 'backups.failed'));
      else setMessage(t(lang, res.restarting ? 'backups.restarting' : 'backups.restoredRestart'));
    } catch {
      setMessage(t(lang, 'backups.failed'));
    }
    setConfirming(null);
    setBusy(false);
  };

  const formatWhen = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <Card title={t(lang, 'backups.title')}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-sans text-xs leading-relaxed text-muted">{t(lang, 'backups.desc')}</p>
          <button
            type="button"
            onClick={() => void load()}
            title={t(lang, 'backups.refresh')}
            aria-label={t(lang, 'backups.refresh')}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-white/[0.08] hover:text-ink"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {message && (
          <div role="status" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-sans text-xs text-emerald-200">
            {message}
          </div>
        )}

        {backups === null ? null : backups.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-3 font-sans text-xs text-muted">
            <DatabaseBackup size={15} className="shrink-0" />
            {t(lang, 'backups.empty')}
          </div>
        ) : (
          <ul className="space-y-2">
            {backups.map((b) => (
              <li key={b.name} className="rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-sans text-xs font-semibold text-ink">{t(lang, kindKey(b.kind))}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">{formatWhen(b.modified)}</div>
                    <div className="mt-1 font-sans text-[11.5px] text-muted">
                      {t(lang, 'backups.contents', { counters: b.counters, replies: b.replies, sequences: b.sequences, keybinds: b.keybinds })}
                    </div>
                  </div>
                  {confirming === b.name ? (
                    <div className="flex items-center gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void restore(b.name)}>
                        <RotateCcw size={12} /> {t(lang, 'backups.confirm')}
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
                {confirming === b.name && <p className="mt-2 font-sans text-[11.5px] text-amber-300">{t(lang, 'backups.confirmHint')}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
