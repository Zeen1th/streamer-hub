import { Download, FileUp, Share2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../../i18n/translations';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { useSettingsStore } from '../../../store/settingsStore';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Switch } from '../../ui/Switch';

/** A file picker waits for the person, so these calls get far longer than the usual RPC timeout. */
const DIALOG_TIMEOUT_MS = 10 * 60 * 1000;

interface ChosenFile {
  fileName: string;
  appVersion: string;
  counters: number;
  replies: number;
  sequences: number;
  overlays: number;
}

function errorKey(error?: string) {
  switch (error) {
    case 'NOT A SHARE FILE':
      return 'share.errNotShare' as const;
    case 'NEWER VERSION':
      return 'share.errNewer' as const;
    case 'FILE TOO LARGE':
      return 'share.errTooLarge' as const;
    default:
      return 'share.errGeneric' as const;
  }
}

/** Settings > Share: save commands and chat overlay looks to a file, or add somebody else's file to this app. */
export function ShareCard() {
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const [commands, setCommands] = useState(true);
  const [overlays, setOverlays] = useState(true);
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const exportFile = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await rpc.invoke(Channels.SettingsExportShare, { commands, overlays }, DIALOG_TIMEOUT_MS);
      if (res.ok) {
        setMessage({
          tone: 'ok',
          text: t(lang, 'share.exported', { counters: res.counters ?? 0, replies: res.replies ?? 0, sequences: res.sequences ?? 0, overlays: res.overlays ?? 0 }),
        });
      } else if (!res.cancelled) {
        setMessage({ tone: 'error', text: t(lang, 'share.errGeneric') });
      }
    } catch {
      setMessage({ tone: 'error', text: t(lang, 'share.errGeneric') });
    }
    setBusy(false);
  };

  const chooseFile = async () => {
    setBusy(true);
    setMessage(null);
    setChosen(null);
    try {
      const res = await rpc.invoke(Channels.SettingsImportShareChoose, undefined, DIALOG_TIMEOUT_MS);
      if (res.ok) {
        setChosen({
          fileName: res.fileName ?? '',
          appVersion: res.appVersion ?? '',
          counters: res.counters ?? 0,
          replies: res.replies ?? 0,
          sequences: res.sequences ?? 0,
          overlays: res.overlays ?? 0,
        });
      } else if (!res.cancelled) {
        setMessage({ tone: 'error', text: t(lang, errorKey(res.error)) });
      }
    } catch {
      setMessage({ tone: 'error', text: t(lang, 'share.errGeneric') });
    }
    setBusy(false);
  };

  const applyImport = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await rpc.invoke(Channels.SettingsImportShareApply, undefined, 60_000);
      if (res.ok) {
        const added = t(lang, 'share.imported', {
          counters: res.counters ?? 0,
          replies: res.replies ?? 0,
          sequences: res.sequences ?? 0,
          overlays: res.overlays ?? 0,
          skipped: res.skipped ?? 0,
        });
        const clashes = res.clashes && res.clashes.length > 0 ? ` ${t(lang, 'share.clashes', { list: res.clashes.join(', ') })}` : '';
        const restart = ` ${t(lang, res.restarting ? 'share.restarting' : 'share.restartManually')}`;
        setMessage({ tone: 'ok', text: added + clashes + restart });
        setChosen(null);
      } else {
        setMessage({ tone: 'error', text: t(lang, 'share.errGeneric') });
      }
    } catch {
      setMessage({ tone: 'error', text: t(lang, 'share.errGeneric') });
    }
    setBusy(false);
  };

  return (
    <Card title={t(lang, 'share.title')}>
      <div className="space-y-4">
        <p className="font-sans text-xs leading-relaxed text-muted">{t(lang, 'share.desc')}</p>

        {message && (
          <div
            role="status"
            className={
              message.tone === 'ok'
                ? 'rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-sans text-xs text-emerald-200'
                : 'rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 font-sans text-xs text-red-200'
            }
          >
            {message.text}
          </div>
        )}

        <section className="space-y-2 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
          <h3 className="flex items-center gap-2 font-sans text-xs font-semibold text-ink">
            <Share2 size={14} /> {t(lang, 'share.exportTitle')}
          </h3>
          <div className="flex items-center justify-between gap-3">
            <span className="font-sans text-xs text-ink">{t(lang, 'share.includeCommands')}</span>
            <Switch checked={commands} onChange={setCommands} label={t(lang, 'share.includeCommands')} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-sans text-xs text-ink">{t(lang, 'share.includeOverlays')}</span>
            <Switch checked={overlays} onChange={setOverlays} label={t(lang, 'share.includeOverlays')} />
          </div>
          <p className="font-sans text-[11.5px] text-muted">{t(lang, 'share.exportHint')}</p>
          <Button size="sm" disabled={busy || (!commands && !overlays)} onClick={() => void exportFile()}>
            <Download size={12} /> {t(lang, 'share.exportButton')}
          </Button>
        </section>

        <section className="space-y-2 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
          <h3 className="flex items-center gap-2 font-sans text-xs font-semibold text-ink">
            <FileUp size={14} /> {t(lang, 'share.importTitle')}
          </h3>
          <p className="font-sans text-[11.5px] text-muted">{t(lang, 'share.importHint')}</p>
          {chosen ? (
            <div className="space-y-2">
              <div className="rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 font-sans text-xs text-ink">
                <div className="font-mono text-[11px] text-muted">{chosen.fileName}</div>
                <div className="mt-1">
                  {t(lang, 'share.contents', { counters: chosen.counters, replies: chosen.replies, sequences: chosen.sequences, overlays: chosen.overlays })}
                </div>
              </div>
              <p className="font-sans text-[11.5px] text-amber-300">{t(lang, 'share.confirmHint')}</p>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy} onClick={() => void applyImport()}>
                  {t(lang, 'share.confirmButton')}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setChosen(null)}>
                  {t(lang, 'common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void chooseFile()}>
              <FileUp size={12} /> {t(lang, 'share.chooseButton')}
            </Button>
          )}
        </section>
      </div>
    </Card>
  );
}
