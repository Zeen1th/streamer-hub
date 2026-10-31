import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PlayCircle, X } from 'lucide-react';
import { demoFor } from '../../lib/featureDemos';
import { cn } from '../../lib/cn';

const TEXT = {
  en: { open: 'See how it works', close: 'Close' },
  ar: { open: 'شاهد كيف يعمل', close: 'إغلاق' },
} as const;

/** "See how it works": opens a short looping video of the feature. Renders nothing for a feature without a demo. */
export function FeatureDemoButton({ feature, lang, className }: { feature: string | undefined; lang: 'en' | 'ar'; className?: string }) {
  const demo = demoFor(feature);
  const [open, setOpen] = useState(false);
  const tx = TEXT[lang];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close only the player, not the editor underneath it
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!demo) return null;
  const copy = demo[lang];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-2.5 text-[11.5px] font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25 hover:text-white',
          className,
        )}
      >
        <PlayCircle size={13} />
        {tx.open}
      </button>
      {open &&
        createPortal(
          <div
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
            className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={copy.title}
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              className="w-full max-w-[900px] overflow-hidden rounded-xl border border-white/[0.14] bg-[#161922] text-[#F0F3F7] shadow-2xl animate-in zoom-in-95 duration-150"
            >
              <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-3.5">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold">{copy.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#c3cad3]">{copy.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={tx.close}
                  title={tx.close}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-[#9aa3af] hover:bg-white/[0.08] hover:text-white"
                >
                  <X size={15} />
                </button>
              </header>
              <video src={demo.src} autoPlay loop muted playsInline className="block aspect-video w-full bg-black" />
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
