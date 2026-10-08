import { Gift, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TwitchGiftEvent } from '../../rpc/contracts';
import { activeGifts, giftText } from '../../lib/giftStrip';

interface GiftStripProps {
  gifts: readonly TwitchGiftEvent[];
  lang: 'en' | 'ar';
  onDismiss: () => void;
  compact?: boolean;
}

/** Pinned to the top of the streamer's chat: the latest gifted subs, each fading out after a minute and a half. */
export function GiftStrip({ gifts, lang, onDismiss, compact }: GiftStripProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (gifts.length === 0) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [gifts]);

  const shown = activeGifts(gifts, now);
  if (shown.length === 0) return null;

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="relative shrink-0 border-b border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-600/25 via-purple-600/20 to-indigo-600/25"
      aria-live="polite"
    >
      <ul className={`flex flex-col ${compact ? 'gap-0.5 px-2 py-1' : 'gap-1 px-3 py-1.5'}`}>
        {shown.map((gift) => (
          <li
            key={gift.id}
            className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300"
            title={gift.totalGifted > 0 && !gift.anonymous ? `${gift.totalGifted} total` : undefined}
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-fuchsia-500/30 text-fuchsia-200">
              <Gift size={12} />
            </span>
            <span dir="auto" className={`min-w-0 flex-1 truncate font-semibold text-white ${compact ? 'text-[11.5px]' : 'text-[12.5px]'}`}>
              {giftText(gift, lang)}
            </span>
            {gift.count > 1 && (
              <span className="shrink-0 rounded-full bg-fuchsia-500/35 px-1.5 text-[10.5px] font-bold text-fuchsia-100">×{gift.count}</span>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute end-1 top-1 grid size-4 place-items-center rounded text-white/50 hover:bg-white/10 hover:text-white"
      >
        <X size={10} />
      </button>
    </div>
  );
}
