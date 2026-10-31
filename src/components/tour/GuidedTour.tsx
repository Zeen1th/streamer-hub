import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { placeTourCard, type Box, type TourPlacement } from '../../lib/tourPlacement';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolStore } from '../../store/toolStore';
import { useTourStore } from '../../store/tourStore';
import { cn } from '../../lib/cn';
import { TOUR_STEPS, TOUR_TEXT } from './tourSteps';

const PAD = 6;

/** The app's UI zoom is CSS zoom on the page: positions we set are multiplied by it, so measurements are divided by it. */
function pageZoom(): number {
  const zoom = parseFloat(getComputedStyle(document.documentElement).zoom || '1');
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function measure(selector: string | undefined, zoom: number): Box | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top / zoom, left: r.left / zoom, width: r.width / zoom, height: r.height / zoom };
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

/** A step-by-step spotlight over the app: dims everything, rings the item being explained, and shows a card next to it. */
export function GuidedTour() {
  const open = useTourStore((s) => s.open);
  const index = useTourStore((s) => s.index);
  const next = useTourStore((s) => s.next);
  const back = useTourStore((s) => s.back);
  const close = useTourStore((s) => s.close);
  const language = useSettingsStore((s) => s.language);
  const lang = language === 'ar' ? 'ar' : 'en';
  const tx = TOUR_TEXT[lang];
  const step = TOUR_STEPS[Math.min(index, TOUR_STEPS.length - 1)];
  const total = TOUR_STEPS.length;
  const isLast = index >= total - 1;

  const cardRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Box | null>(null);
  const [placement, setPlacement] = useState<TourPlacement | null>(null);

  // Open the page the step talks about
  useEffect(() => {
    if (!open) return;
    const tools = useToolStore.getState();
    if (step.section) tools.setSection(step.section);
    if (step.tab) tools.setTab(step.tab);
  }, [open, step]);

  const relayout = useCallback(() => {
    const zoom = pageZoom();
    const box = measure(step.target, zoom);
    setTarget((prev) => (sameBox(prev, box) ? prev : box));
    const card = cardRef.current;
    const size = card ? { width: card.offsetWidth, height: card.offsetHeight } : { width: 340, height: 190 };
    const spot = box ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 } : null;
    const next = placeTourCard(spot, size, { width: window.innerWidth / zoom, height: window.innerHeight / zoom });
    setPlacement((prev) => (prev && prev.top === next.top && prev.left === next.left && prev.side === next.side ? prev : next));
  }, [step]);

  // Pages render after the tab switch, and things move when the window resizes: keep following the target
  useLayoutEffect(() => {
    if (!open) return;
    relayout();
    const timer = window.setInterval(relayout, 250);
    window.addEventListener('resize', relayout);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', relayout);
    };
  }, [open, relayout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        next(total);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, back, close, total]);

  if (!open) return null;

  const copy = step[lang];

  return (
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* Dims the app and blocks clicks on it while the tour is up; with a target, four panels leave a hole around it */}
      {target ? (
        (() => {
          const top = target.top - PAD;
          const left = target.left - PAD;
          const width = target.width + PAD * 2;
          const height = target.height + PAD * 2;
          const shade = 'absolute bg-black/65';
          return (
            <>
              <div className={shade} style={{ top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
              <div className={shade} style={{ top: top + height, left: 0, right: 0, bottom: 0 }} />
              <div className={shade} style={{ top, left: 0, width: Math.max(0, left), height }} />
              <div className={shade} style={{ top, left: left + width, right: 0, height }} />
              <div
                aria-hidden
                className="pointer-events-none absolute rounded-[10px] ring-2 ring-[#818cf8] shadow-[0_0_24px_4px_rgba(129,140,248,0.45)]"
                style={{ top, left, width, height }}
              />
            </>
          );
        })()
      ) : (
        <div className="absolute inset-0 bg-black/65" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="absolute w-[340px] max-w-[calc(100vw-24px)] rounded-xl border border-white/[0.12] bg-[#161b22] p-4 text-[#f0f3f7] shadow-2xl"
        // Shown only once it has a place, so it never flies in from a corner
        style={{ top: placement?.top ?? 0, left: placement?.left ?? 0, visibility: placement ? 'visible' : 'hidden' }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="tour-title" className="text-[15px] font-bold leading-snug">{copy.title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={tx.skip}
            title={tx.skip}
            className="grid size-7 shrink-0 place-items-center rounded-md text-[#9aa3af] hover:bg-white/[0.08] hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#c3cad3]">{copy.body}</p>

        <div className="mt-4 flex items-center gap-1" aria-hidden>
          {TOUR_STEPS.map((s, i) => (
            <span key={s.id} className={cn('h-1.5 rounded-full transition-all', i === index ? 'w-4 bg-[#818cf8]' : i < index ? 'w-1.5 bg-[#818cf8]/50' : 'w-1.5 bg-white/[0.15]')} />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-[#9aa3af]" dir="ltr">
            {tx.of.replace('{n}', String(index + 1)).replace('{total}', String(total))}
          </span>
          <div className="flex items-center gap-1.5">
            {!isLast && (
              <button type="button" onClick={close} className="h-8 rounded-md px-2.5 text-[12px] text-[#9aa3af] hover:bg-white/[0.06] hover:text-white">
                {tx.skip}
              </button>
            )}
            {index > 0 && (
              <button type="button" onClick={back} className="h-8 rounded-md border border-white/[0.12] px-3 text-[12px] font-medium text-white hover:bg-white/[0.06]">
                {tx.back}
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => next(total)}
              className="h-8 rounded-md bg-[#6366f1] px-3.5 text-[12px] font-semibold text-white hover:bg-[#7a7cf6]"
            >
              {isLast ? tx.finish : tx.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
