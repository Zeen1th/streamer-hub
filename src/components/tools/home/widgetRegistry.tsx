import type { ComponentType, ReactNode } from 'react';
import { Activity, Bot, Key, ListChecks, Radio, Sparkles, Tally5, Trophy, Tv, Zap, Clock } from 'lucide-react';
import type { WidgetId } from '../../../lib/homeLayout';
import type { WidgetProps } from './WidgetCard';
import type { HomeTextKey } from './homeText';
import { ActivityWidget } from './widgets/ActivityWidget';
import { ChecklistWidget } from './widgets/ChecklistWidget';
import { CounterWidget } from './widgets/CounterWidget';
import { FeedWidget } from './widgets/FeedWidget';
import { KeybindsWidget } from './widgets/KeybindsWidget';
import { LeaderboardWidget } from './widgets/LeaderboardWidget';
import { OverlayWidget } from './widgets/OverlayWidget';
import { PulseWidget } from './widgets/PulseWidget';
import { QuickRunWidget } from './widgets/QuickRunWidget';
import { ReplyWidget } from './widgets/ReplyWidget';
import { TitleWidget } from './widgets/TitleWidget';

interface WidgetEntry {
  component: ComponentType<WidgetProps>;
  icon: ReactNode;
  name: HomeTextKey;
  desc: HomeTextKey;
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetEntry> = {
  pulse: { component: PulseWidget, icon: <Clock size={16} className="text-emerald-300" />, name: 'w.pulse', desc: 'w.pulse.desc' },
  activity: { component: ActivityWidget, icon: <Activity size={16} className="text-sky-300" />, name: 'w.activity', desc: 'w.activity.desc' },
  feed: { component: FeedWidget, icon: <Radio size={16} className="text-rose-300" />, name: 'w.feed', desc: 'w.feed.desc' },
  leaderboard: { component: LeaderboardWidget, icon: <Trophy size={16} className="text-amber-300" />, name: 'w.leaderboard', desc: 'w.leaderboard.desc' },
  counter: { component: CounterWidget, icon: <Tally5 size={16} className="text-[#a5b4fc]" />, name: 'w.counter', desc: 'w.counter.desc' },
  title: { component: TitleWidget, icon: <Tv size={16} className="text-[#22A7E0]" />, name: 'w.title', desc: 'w.title.desc' },
  keybinds: { component: KeybindsWidget, icon: <Key size={16} className="text-[#F5B324]" />, name: 'w.keybinds', desc: 'w.keybinds.desc' },
  reply: { component: ReplyWidget, icon: <Bot size={16} className="text-[#c4b5fd]" />, name: 'w.reply', desc: 'w.reply.desc' },
  overlay: { component: OverlayWidget, icon: <Sparkles size={16} className="text-[#5FD0A8]" />, name: 'w.overlay', desc: 'w.overlay.desc' },
  quickrun: { component: QuickRunWidget, icon: <Zap size={16} className="text-yellow-300" />, name: 'w.quickrun', desc: 'w.quickrun.desc' },
  checklist: { component: ChecklistWidget, icon: <ListChecks size={16} className="text-emerald-300" />, name: 'w.checklist', desc: 'w.checklist.desc' },
};
