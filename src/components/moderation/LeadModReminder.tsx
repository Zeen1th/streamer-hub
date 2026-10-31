import { ExternalLink, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Events } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../ui/Button';

const STORAGE_KEY = 'streamer-hub-lead-mod-reminders';

function readPending(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePending(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // the reminder still shows for this session
  }
}

/**
 * Twitch gives a timed-out lead moderator back only the normal mod role (apps cannot grant Lead). This card reminds
 * the streamer to give Lead back in Twitch's Roles Manager, and stays until dismissed, even across restarts.
 */
export function LeadModReminder() {
  const [pending, setPending] = useState<string[]>(readPending);
  const channel = useConnectionStore((s) => s.twitchChannel);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  useEffect(
    () =>
      rpc.on(Events.TwitchLeadModRestoreNeeded, ({ login }) => {
        if (!login) return;
        setPending((current) => {
          const next = [...current.filter((l) => l.toLowerCase() !== login.toLowerCase()), login];
          writePending(next);
          return next;
        });
      }),
    [],
  );

  if (pending.length === 0) return null;

  const dismiss = () => {
    setPending([]);
    writePending([]);
  };
  const names = pending.map((l) => `@${l}`).join(lang === 'ar' ? '، ' : ', ');
  const rolesUrl = channel
    ? `https://dashboard.twitch.tv/u/${encodeURIComponent(channel)}/community/roles`
    : 'https://dashboard.twitch.tv/';

  return (
    <div
      role="status"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed bottom-4 start-4 z-[55] w-[360px] max-w-[calc(100vw-32px)] rounded-lg border border-amber-500/40 bg-[#171e25]/95 p-3.5 text-ink shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start gap-2.5 text-[12.5px]">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <div className="font-semibold">{t(lang, 'leadMod.title')}</div>
          <div className="mt-1 text-muted">
            {t(lang, 'leadMod.body')}{' '}
            <bdi dir="ltr" className="font-medium text-ink">{names}</bdi>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t(lang, 'updates.dismiss')}
          className="ms-auto grid size-5 shrink-0 place-items-center rounded text-muted hover:text-white"
        >
          <X size={13} />
        </button>
      </div>
      <div className="mt-2.5 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={dismiss}>{t(lang, 'leadMod.done')}</Button>
        <Button size="sm" onClick={() => window.open(rolesUrl, '_blank', 'noreferrer')}>
          <ExternalLink size={13} />
          {t(lang, 'leadMod.open')}
        </Button>
      </div>
    </div>
  );
}
