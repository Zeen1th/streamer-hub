import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { useStatsStore } from '../../../../store/statsStore';
import { activitySeries, recentRate } from '../../../../lib/stats';
import { useNow } from '../../../../lib/useNow';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const MINUTES = 30;
const W = 300;
const H = 90;

/** Smooth line through the points (Catmull-Rom converted to cubic beziers). */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function ActivityWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const now = useNow(10_000);
  const minutes = useStatsStore((s) => s.minutes);
  const rev = useStatsStore((s) => s.rev);
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(
    () => activitySeries(minutes, Date.now(), MINUTES),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minutes, rev, now],
  );
  const peak = Math.max(...series, 0);
  const top = Math.max(peak, 4) * 1.15;
  const total = series.reduce((a, b) => a + b, 0);
  const rate = recentRate(series, 5);

  const points: [number, number][] = series.map((v, i) => [(i / (MINUTES - 1)) * W, H - 4 - (v / top) * (H - 12)]);
  const line = smoothPath(points);
  const area = line ? `${line} L ${W},${H} L 0,${H} Z` : '';
  // Resting readout is the 5-minute average (a half-finished current minute reads as a misleading dip)
  const shownValue = hover === null ? Math.round(rate) : series[hover];
  const shownAgo = hover === null ? 0 : series.length - 1 - hover;

  return (
    <WidgetCard
      id="activity"
      title={h('w.activity')}
      icon={<Activity size={15} className="text-sky-300" />}
      {...chrome}
      actions={
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-200">
          {h('pulse.perMin', { n: rate.toFixed(1).replace(/\.0$/, '') })}
        </span>
      }
    >
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-[12px] text-[#9aa3af]">{h('activity.empty')}</div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-[22px] font-bold leading-none text-white">
              {shownValue}
              <span className="ms-1 text-[11px] font-medium text-[#9aa3af]">/min</span>
            </span>
            <span className="font-mono text-[10.5px] text-[#9aa3af]">
              {hover === null ? h('activity.avg') : shownAgo === 0 ? h('activity.now') : h('activity.minutesAgo', { n: shownAgo })} · {h('activity.peak', { n: peak })}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="h-[104px] w-full overflow-visible"
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
              setHover(Math.min(MINUTES - 1, Math.max(0, Math.round(ratio * (MINUTES - 1)))));
            }}
            role="img"
            aria-label={h('w.activity')}
          >
            <defs>
              <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#activity-fill)" />
            <path d={line} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {hover !== null && (
              <>
                <line x1={points[hover][0]} x2={points[hover][0]} y1="0" y2={H} stroke="rgba(255,255,255,0.28)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <circle cx={points[hover][0]} cy={points[hover][1]} r="3.5" fill="#38bdf8" stroke="#0b1015" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </svg>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-[#9aa3af]">
            <span>{MINUTES}m</span>
            <span>{h('activity.now')}</span>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
