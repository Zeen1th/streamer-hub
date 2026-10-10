import { useEffect, useState } from 'react';
import { Check, RefreshCw, Tv } from 'lucide-react';
import { rpc } from '../../../../rpc';
import { Channels } from '../../../../rpc/contracts';
import { useConnectionStore } from '../../../../store/connectionStore';
import { useCounterStore } from '../../../../store/counterStore';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { useHomeText } from '../homeText';
import { WidgetCard, type WidgetProps } from '../WidgetCard';

const PRESETS = ['Ranked Grind 🔴', 'Chill Games & Chat ☕', 'Subathon Day 1 🚀'];

export function TitleWidget({ chrome }: WidgetProps) {
  const { h } = useHomeText();
  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const setLiveStreamTitle = useCounterStore((s) => s.setLiveStreamTitle);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchLiveTitle = () => {
    if (!twitchConnected) return;
    rpc
      .invoke(Channels.TwitchGetTitle, undefined)
      .then((res) => {
        if (res.ok && res.title) {
          setLiveTitle(res.title);
          setDraft(res.title);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchLiveTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twitchConnected]);

  useEffect(() => {
    const handler = (e: Event) => {
      const title = (e as CustomEvent<string>).detail;
      if (title) {
        setLiveTitle(title);
        setDraft(title);
      }
    };
    window.addEventListener('twitch-title-changed', handler);
    return () => window.removeEventListener('twitch-title-changed', handler);
  }, []);

  const apply = async () => {
    const next = draft.trim();
    if (!next || updating) return;
    setUpdating(true);
    const ok = await setLiveStreamTitle(next);
    setUpdating(false);
    if (ok) {
      setLiveTitle(next);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <WidgetCard
      id="title"
      title={h('w.title')}
      icon={<Tv size={15} className="text-[#22A7E0]" />}
      {...chrome}
      actions={
        <button type="button" onClick={fetchLiveTitle} className="flex items-center gap-1 text-[11px] text-[#9aa3af] hover:text-white" title={h('title.refresh')}>
          <RefreshCw size={12} /> {h('title.refresh')}
        </button>
      }
    >
      <div className="space-y-3">
        <div className="break-words rounded-[8px] border border-white/[0.08] bg-[#1a2228] p-2.5 text-[12.5px] font-semibold leading-snug text-white" dir="auto">
          {liveTitle || h('title.empty')}
        </div>
        <div className="flex items-center gap-1.5">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void apply()} placeholder={h('title.placeholder')} className="h-[32px] text-[12px]" dir="auto" />
          <Button size="sm" disabled={updating || !draft.trim() || draft === liveTitle} onClick={() => void apply()} className="h-[32px] shrink-0 px-3">
            <Check size={13} /> {h('title.update')}
          </Button>
        </div>
        {success && <div className="font-mono text-[11px] text-emerald-400">{h('title.updated')}</div>}
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((preset) => (
            <button key={preset} type="button" onClick={() => setDraft(preset)} className="rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] text-[#9aa3af] transition-colors hover:border-white/[0.15] hover:text-white">
              {preset}
            </button>
          ))}
        </div>
      </div>
    </WidgetCard>
  );
}
