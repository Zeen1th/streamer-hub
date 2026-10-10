import { useState } from 'react';
import { Copy, ExternalLink, Sparkles } from 'lucide-react';
import { useToolStore } from '../../../../store/toolStore';
import { Button } from '../../../ui/Button';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const OVERLAY_URL = 'http://127.0.0.1:49178/overlay';

export function OverlayWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const setTab = useToolStore((s) => s.setTab);
  const [copied, setCopied] = useState(false);

  return (
    <WidgetCard
      id="overlay"
      title={h('w.overlay')}
      icon={<Sparkles size={15} className="text-[#5FD0A8]" />}
      {...chrome}
      actions={<span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-emerald-300">127.0.0.1:49178</span>}
    >
      <div className="space-y-3">
        <div className="rounded-[8px] border border-white/[0.08] bg-[#1a2228] p-3 text-[11.5px] leading-relaxed text-[#9aa3af]">{h('overlay.blurb')}</div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[11px]"
            onClick={() => {
              void navigator.clipboard?.writeText(OVERLAY_URL);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
          >
            <Copy size={12} /> {copied ? h('overlay.copied') : h('overlay.copy')}
          </Button>
          <Button size="sm" className="flex-1 text-[11px]" onClick={() => setTab('overlay')}>
            <ExternalLink size={12} /> {h('overlay.open')}
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}
