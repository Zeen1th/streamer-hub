import { ExternalLink, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../../i18n/translations';
import { rpc } from '../../rpc';
import { Channels, Events } from '../../rpc/contracts';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { Button } from '../ui/Button';

const STORAGE_KEY = 'streamer-hub-lead-mod-reminders';

interface Pending {
  login: string;
  reason?: string;
}

function readPending(): Pending[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    // Older versions kept plain logins
    return list
      .map((x) => (typeof x === 'string' ? { login: x } : x && typeof x.login === 'string' ? { login: x.login, reason: x.reason } : null))
      .filter((x): x is Pending => x !== null);
  } catch {
    return [];
  }
}

function writePending(list: Pending[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // the reminder still shows for this session
  }
}

const REASON_KEYS: Record<string, string> = {
  'not-logged-in': 'leadMod.reasonNotLoggedIn',
  'wrong-account': 'leadMod.reasonWrongAccount',
  LEAD_LIMIT_REACHED: 'leadMod.reasonLimit',
  USER_NOT_IN_ROLES: 'leadMod.reasonNotListed',
};

/**
 * Twitch gives a timed-out lead moderator back only the normal mod role (apps cannot grant Lead). When the automatic
 * way (Settings > Twitch) is off or did not work, this card reminds the streamer and offers to try again or to open
 * Roles Manager. It stays until dismissed, even across restarts, and clears itself when Lead is given back.
 */
export function LeadModReminder() {
  const [pending, setPending] = useState<Pending[]>(readPending);
  const [retrying, setRetrying] = useState(false);
  const channel = useConnectionStore((s) => s.twitchChannel);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';

  const update = (next: (current: Pending[]) => Pending[]) =>
    setPending((current) => {
      const value = next(current);
      writePending(value);
      return value;
    });

  useEffect(() => {
    const offNeeded = rpc.on(Events.TwitchLeadModRestoreNeeded, ({ login, reason }) => {
      if (!login) return;
      update((current) => [...current.filter((p) => p.login.toLowerCase() !== login.toLowerCase()), { login, reason }]);
    });
    const offRestored = rpc.on(Events.TwitchLeadModRestored, ({ login }) => {
      update((current) => current.filter((p) => p.login.toLowerCase() !== login.toLowerCase()));
    });
    return () => {
      offNeeded();
      offRestored();
    };
  }, []);

  if (pending.length === 0) return null;

  const dismiss = () => update(() => []);
  const names = pending.map((p) => `@${p.login}`).join(lang === 'ar' ? '، ' : ', ');
  const reason = pending.map((p) => p.reason).find((r) => r && REASON_KEYS[r]);
  const retry = async () => {
    setRetrying(true);
    for (const p of pending) {
      try {
        await rpc.invoke(Channels.TwitchDashboardRetryLead, { login: p.login }, 150_000);
      } catch {
        // the host posts the reminder again with the reason
      }
    }
    setRetrying(false);
  };
  const openRoles = async () => {
    try {
      const res = await rpc.invoke(Channels.TwitchDashboardOpenRoles, undefined);
      if (res?.ok) return;
    } catch {
      // fall back to the browser
    }
    const url = channel ? `https://dashboard.twitch.tv/u/${encodeURIComponent(channel)}/community/roles` : 'https://dashboard.twitch.tv/';
    window.open(url, '_blank', 'noreferrer');
  };

  return (
    <div
      role="status"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="fixed bottom-4 start-4 z-[55] w-[380px] max-w-[calc(100vw-32px)] rounded-lg border border-amber-500/40 bg-[#171e25]/95 p-3.5 text-ink shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start gap-2.5 text-[12.5px]">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <div className="font-semibold">{t(lang, 'leadMod.title')}</div>
          <div className="mt-1 text-muted">
            {t(lang, 'leadMod.body')}{' '}
            <bdi dir="ltr" className="font-medium text-ink">{names}</bdi>
          </div>
          {reason && <div className="mt-1.5 text-[11.5px] text-amber-200">{t(lang, REASON_KEYS[reason])}</div>}
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
      <div className="mt-2.5 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={dismiss}>{t(lang, 'leadMod.done')}</Button>
        <Button size="sm" variant="outline" disabled={retrying} onClick={() => void retry()}>
          <RotateCcw size={13} />
          {retrying ? t(lang, 'leadMod.retrying') : t(lang, 'leadMod.retry')}
        </Button>
        <Button size="sm" onClick={() => void openRoles()}>
          <ExternalLink size={13} />
          {t(lang, 'leadMod.open')}
        </Button>
      </div>
    </div>
  );
}
