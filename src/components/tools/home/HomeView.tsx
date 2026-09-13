import { useEffect, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Gamepad2,
  Key,
  MessageCircle,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Tally5,
  Trophy,
  Tv,
} from 'lucide-react';
import { useConnectionStore } from '../../../store/connectionStore';
import { useCounterStore } from '../../../store/counterStore';
import { useKeybindStore } from '../../../store/keybindStore';
import { useAutoReplyStore } from '../../../store/autoReplyStore';
import { useToolStore } from '../../../store/toolStore';
import { rpc } from '../../../rpc';
import { Channels } from '../../../rpc/contracts';
import { Button } from '../../ui/Button';
import { Switch } from '../../ui/Switch';
import { Input } from '../../ui/Input';
import { cn } from '../../../lib/cn';

type ModuleType = 'counter' | 'title' | 'keybinds' | 'reply' | 'overlay';

interface ProfilePreset {
  id: string;
  name: string;
  icon: typeof Gamepad2;
  description: string;
  slots: ModuleType[];
}

const PROFILES: ProfilePreset[] = [
  {
    id: 'ranked',
    name: 'Ranked Grind',
    icon: Gamepad2,
    description: 'Deaths counter + stream title sync + in-game hotkeys',
    slots: ['counter', 'title', 'keybinds', 'reply'],
  },
  {
    id: 'chatting',
    name: 'Just Chatting',
    icon: MessageCircle,
    description: 'Chat auto-replies + title preset + chat overlay',
    slots: ['title', 'reply', 'overlay', 'keybinds'],
  },
  {
    id: 'speedrun',
    name: 'Speedrun / Challenge',
    icon: Trophy,
    description: 'Challenge counter + title sync + reset shortcut',
    slots: ['counter', 'title', 'keybinds', 'overlay'],
  },
];

const MODULE_OPTIONS: { type: ModuleType; label: string; icon: typeof Tally5 }[] = [
  { type: 'counter', label: 'Counter (with Title Sync)', icon: Tally5 },
  { type: 'title', label: 'Auto Title Changer', icon: Tv },
  { type: 'keybinds', label: 'Global Keybinds', icon: Key },
  { type: 'reply', label: 'Chat Auto-Reply / AI', icon: Bot },
  { type: 'overlay', label: 'Chat Overlay Stage', icon: Sparkles },
];

const formatChord = (chord: { key: string; modifier?: string }) =>
  [chord.modifier?.toUpperCase(), chord.key?.toUpperCase()].filter(Boolean).join(' + ') || 'None';

export function HomeView() {
  const setTab = useToolStore((s) => s.setTab);
  const setSection = useToolStore((s) => s.setSection);

  const twitchConnected = useConnectionStore((s) => s.twitchConnected);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const broadcasterDisplayName = useConnectionStore((s) => s.broadcasterDisplayName);

  // Counters
  const counters = useCounterStore((s) => s.counters);
  const incrementManual = useCounterStore((s) => s.incrementManual);
  const decrementManual = useCounterStore((s) => s.decrementManual);
  const resetManual = useCounterStore((s) => s.resetManual);
  const applyTitle = useCounterStore((s) => s.applyTitle);
  const detachTitle = useCounterStore((s) => s.detachTitle);
  const setLiveStreamTitle = useCounterStore((s) => s.setLiveStreamTitle);
  const addCounter = useCounterStore((s) => s.addCounter);

  // Keybinds
  const bindings = useKeybindStore((s) => s.bindings);
  const saveBindings = useKeybindStore((s) => s.save);

  // Auto Replies
  const rules = useAutoReplyStore((s) => s.rules);
  const updateRule = useAutoReplyStore((s) => s.update);

  // Stream Profiles
  const [activeProfile, setActiveProfile] = useState<string>(() => {
    try {
      return localStorage.getItem('streamer-hub-active-profile') || 'ranked';
    } catch {
      return 'ranked';
    }
  });

  // Up to 4 Slots
  const [slots, setSlots] = useState<ModuleType[]>(() => {
    try {
      const saved = localStorage.getItem('streamer-hub-home-slots');
      if (saved) return JSON.parse(saved) as ModuleType[];
    } catch {
      // Fallback
    }
    return ['counter', 'title', 'keybinds', 'reply'];
  });

  const updateSlot = (index: number, newType: ModuleType) => {
    const updated = [...slots];
    updated[index] = newType;
    setSlots(updated);
    try {
      localStorage.setItem('streamer-hub-home-slots', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleSelectProfile = (preset: ProfilePreset) => {
    setActiveProfile(preset.id);
    setSlots(preset.slots);
    try {
      localStorage.setItem('streamer-hub-active-profile', preset.id);
      localStorage.setItem('streamer-hub-home-slots', JSON.stringify(preset.slots));
    } catch {
      // ignore
    }
  };

  // Live Twitch Title state
  const [liveTitle, setLiveTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleUpdating, setTitleUpdating] = useState(false);
  const [titleSuccessMsg, setTitleSuccessMsg] = useState<string | null>(null);

  const fetchLiveTitle = () => {
    if (!twitchConnected) return;
    rpc.invoke(Channels.TwitchGetTitle, undefined)
      .then((res) => {
        if (res.ok && res.title) {
          setLiveTitle(res.title);
          setTitleDraft(res.title);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchLiveTitle();
  }, [twitchConnected]);

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setLiveTitle(custom.detail);
        setTitleDraft(custom.detail);
      }
    };
    window.addEventListener('twitch-title-changed', handler);
    return () => window.removeEventListener('twitch-title-changed', handler);
  }, []);

  const handleApplyTitle = async (newTitle: string) => {
    if (!newTitle.trim() || titleUpdating) return;
    setTitleUpdating(true);
    const ok = await setLiveStreamTitle(newTitle.trim());
    setTitleUpdating(false);
    if (ok) {
      setLiveTitle(newTitle.trim());
      setTitleSuccessMsg('Stream title updated!');
      setTimeout(() => setTitleSuccessMsg(null), 3000);
    }
  };

  // Selected counter per slot index
  const [selectedCounterId, setSelectedCounterId] = useState<string>(() => counters[0]?.id || '');
  const activeCounter = counters.find((c) => c.id === selectedCounterId) || counters[0];

  // Selected auto-reply
  const [selectedReplyId, setSelectedReplyId] = useState<string>(() => rules[0]?.id || '');
  const activeRule = rules.find((r) => r.id === selectedReplyId) || rules[0];

  // Global Keybinds master toggle
  const allKeybindsEnabled = bindings.length > 0 && bindings.every((b) => b.enabled);
  const handleToggleAllKeybinds = (enable: boolean) => {
    const updated = bindings.map((b) => ({ ...b, enabled: enable }));
    void saveBindings(updated);
  };

  const streamerName = broadcasterDisplayName || (twitchChannel ? twitchChannel.replace(/^#+/, '') : 'streamer');

  return (
    <section className="app-scroll min-h-0 flex-1 overflow-y-auto bg-[#23282e] p-[16px_18px_28px] text-[#f0f3f7]" data-screen-label="Home">
      {/* Top Stream Profiles Switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[9px] border border-white/[0.08] bg-[#1a2228] p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#9aa3af]">
            Stream Profile:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {PROFILES.map((preset) => {
              const Icon = preset.icon;
              const isSelected = activeProfile === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectProfile(preset)}
                  className={cn(
                    'inline-flex h-[28px] items-center gap-1.5 rounded-[5px] border px-2.5 text-[12px] font-medium transition-all',
                    isSelected
                      ? 'border-[#6366F1] bg-[#6366F1] text-white font-bold shadow-xs'
                      : 'border-white/[0.08] bg-white/[0.03] text-[#9aa3af] hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white',
                  )}
                  title={preset.description}
                >
                  <Icon size={14} />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-[#9aa3af]">
          <span>Logged in as</span>
          <strong className="text-white">@{streamerName}</strong>
          <span
            className={cn(
              'inline-block size-2 rounded-full shrink-0',
              twitchConnected
                ? 'bg-[#22C55E] shadow-[0_0_0_3px_rgba(34,197,94,0.16)]'
                : 'bg-[#F5B324] shadow-[0_0_0_3px_rgba(245,179,36,0.16)]',
            )}
          />
        </div>
      </div>

      {/* 4 Large Modular Spaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slots.slice(0, 4).map((slotType, index) => {
          return (
            <div
              key={index}
              className="flex min-h-[240px] flex-col justify-between rounded-[9px] border border-white/[0.08] bg-[#2e3438] p-5 shadow-xs transition-all hover:border-white/[0.15]"
            >
              {/* Space Header: Icon + Type + Slot Type Switcher */}
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  {slotType === 'counter' && <Tally5 size={18} className="text-[#a5b4fc]" />}
                  {slotType === 'title' && <Tv size={18} className="text-[#22A7E0]" />}
                  {slotType === 'keybinds' && <Key size={18} className="text-[#F5B324]" />}
                  {slotType === 'reply' && <Bot size={18} className="text-[#c4b5fd]" />}
                  {slotType === 'overlay' && <Sparkles size={18} className="text-[#5FD0A8]" />}
                  <span className="font-sans text-[13px] font-bold text-white">
                    {MODULE_OPTIONS.find((m) => m.type === slotType)?.label}
                  </span>
                </div>

                {/* Switcher Dropdown */}
                <select
                  value={slotType}
                  onChange={(e) => updateSlot(index, e.target.value as ModuleType)}
                  className="h-[26px] rounded-[4px] border border-white/[0.08] bg-[#1a2228] px-2 text-[11px] font-medium text-[#9aa3af] focus:text-white outline-none cursor-pointer hover:border-white/[0.16]"
                  title="Switch module in this space"
                >
                  {MODULE_OPTIONS.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Space Content */}
              <div className="flex-1 flex flex-col justify-between">
                {/* 1. COUNTER MODULE */}
                {slotType === 'counter' && (
                  <>
                    {activeCounter ? (
                      <div className="space-y-4">
                        {/* Name & live count */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {counters.length > 1 ? (
                              <select
                                value={activeCounter.id}
                                onChange={(e) => setSelectedCounterId(e.target.value)}
                                className="h-[28px] rounded-[4px] border border-white/[0.08] bg-[#1a2228] px-2 font-sans text-[12px] font-bold text-white outline-none"
                              >
                                {counters.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-sans text-[14px] font-bold text-white">
                                {activeCounter.name}
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-[#9aa3af]">
                              (!{activeCounter.commands.increase.commandName})
                            </span>
                          </div>

                          {/* Quick Adjust Buttons */}
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-[30px] w-[32px] p-0"
                              disabled={activeCounter.count <= 0}
                              onClick={() => decrementManual(activeCounter.id)}
                              title="Decrement (-1)"
                            >
                              <Minus size={13} />
                            </Button>
                            <Button
                              size="sm"
                              className="h-[30px] w-[32px] p-0"
                              onClick={() => incrementManual(activeCounter.id)}
                              title="Increment (+1)"
                            >
                              <Plus size={13} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-[30px] w-[32px] p-0"
                              onClick={() => resetManual(activeCounter.id)}
                              title="Reset counter"
                            >
                              <RotateCcw size={12} />
                            </Button>
                          </div>
                        </div>

                        {/* Large count readout */}
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-[42px] font-extrabold tracking-tight text-[#a5b4fc] leading-none">
                            {String(activeCounter.count).padStart(3, '0')}
                          </span>
                          <span className="text-[11.5px] text-[#9aa3af]">
                            {activeCounter.obs.enabled
                              ? `Syncing to ${activeCounter.obs.filePath || 'OBS file'}`
                              : 'OBS output off'}
                          </span>
                        </div>

                        {/* Title Sync Feature Toggle Button */}
                        <div className="flex items-center justify-between rounded-[6px] border border-white/[0.08] bg-[#1a2228] p-2.5">
                          <div className="min-w-0 flex-1 pe-3">
                            <div className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                              <span>Auto Stream Title Sync</span>
                              {activeCounter.titleEnabled && (
                                <span className="rounded-[3px] bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-mono text-emerald-300">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate font-mono text-[10.5px] text-[#9aa3af]">
                              {activeCounter.titleTemplate}
                            </div>
                          </div>

                          <Switch
                            checked={Boolean(activeCounter.titleEnabled)}
                            onChange={(checked) => {
                              if (checked) {
                                void applyTitle(activeCounter.id);
                              } else {
                                void detachTitle(activeCounter.id);
                              }
                            }}
                            label="Toggle counter stream title sync"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-[12px] text-[#9aa3af] mb-3">No counters configured yet.</p>
                        <Button size="sm" onClick={() => addCounter()}>
                          <Plus size={13} /> Add Counter
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {/* 2. AUTO TITLE CHANGER MODULE */}
                {slotType === 'title' && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-[#9aa3af]">Live Twitch Broadcast Title:</span>
                      <button
                        type="button"
                        onClick={fetchLiveTitle}
                        className="flex items-center gap-1 text-[11px] text-[#9aa3af] hover:text-white"
                        title="Refresh live stream title"
                      >
                        <RefreshCw size={12} /> Refresh
                      </button>
                    </div>

                    <div className="rounded-[6px] border border-white/[0.08] bg-[#1a2228] p-2.5 font-mono text-[12px] font-bold text-white break-words">
                      {liveTitle || 'No title set or offline'}
                    </div>

                    {/* Quick Title Editor & Apply Toggle */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={titleDraft}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          placeholder="Enter new stream title…"
                          className="h-[32px] text-[12px]"
                        />
                        <Button
                          size="sm"
                          disabled={titleUpdating || !titleDraft.trim() || titleDraft === liveTitle}
                          onClick={() => void handleApplyTitle(titleDraft)}
                          className="h-[32px] px-3 shrink-0"
                        >
                          <Check size={13} /> Update
                        </Button>
                      </div>

                      {titleSuccessMsg && (
                        <div className="font-mono text-[11px] text-emerald-400">{titleSuccessMsg}</div>
                      )}

                      {/* Quick Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {['Ranked Grind 🔴', 'Chill Games & Chat ☕', 'Subathon Day 1 🚀'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTitleDraft(preset)}
                            className="rounded-[4px] border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10.5px] text-[#9aa3af] hover:border-white/[0.15] hover:text-white transition-colors"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. GLOBAL KEYBINDS MODULE */}
                {slotType === 'keybinds' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-white">
                        Global In-Game Hotkeys:
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[#9aa3af]">
                          {allKeybindsEnabled ? 'All Enabled' : 'Paused'}
                        </span>
                        <Switch
                          checked={allKeybindsEnabled}
                          onChange={handleToggleAllKeybinds}
                          label="Master keybinds switch"
                        />
                      </div>
                    </div>

                    {/* List of Keybinds */}
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                      {bindings.length === 0 ? (
                        <div className="py-4 text-center text-[11.5px] text-[#9aa3af]">
                          No global keybinds registered.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setSection('keybinds');
                              setTab('settings');
                            }}
                            className="text-[#a5b4fc] underline"
                          >
                            Add in Settings
                          </button>
                        </div>
                      ) : (
                        bindings.slice(0, 4).map((binding) => (
                          <div
                            key={binding.id}
                            className="flex items-center justify-between rounded-[5px] border border-white/[0.06] bg-[#1a2228] px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border border-white/[0.1] bg-black/30 text-[#f0f3fa]">
                                {formatChord(binding.chord)}
                              </span>
                              <span className="truncate text-[11.5px] text-[#9aa3af]">
                                {binding.targetType} · {binding.action}
                              </span>
                            </div>

                            <Switch
                              checked={binding.enabled}
                              onChange={(checked) => {
                                const updated = bindings.map((b) =>
                                  b.id === binding.id ? { ...b, enabled: checked } : b,
                                );
                                void saveBindings(updated);
                              }}
                              label={`Toggle ${formatChord(binding.chord)}`}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 4. CHAT AUTO-REPLY / AI MODULE */}
                {slotType === 'reply' && (
                  <div className="space-y-3">
                    {activeRule ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {rules.length > 1 ? (
                              <select
                                value={activeRule.id}
                                onChange={(e) => setSelectedReplyId(e.target.value)}
                                className="h-[28px] rounded-[4px] border border-white/[0.08] bg-[#1a2228] px-2 font-sans text-[12px] font-bold text-white outline-none"
                              >
                                {rules.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.triggers[0] || 'Command'} ({r.responseMode === 'ai' ? 'AI' : 'Reply'})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-sans text-[13px] font-bold text-white">
                                {activeRule.triggers[0] || 'Chat Command'}
                              </span>
                            )}
                            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9.5px] font-bold text-purple-300">
                              {activeRule.responseMode === 'ai' ? 'AI REPLY' : 'PREPARED'}
                            </span>
                          </div>

                          {/* Toggle Switch */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-[#9aa3af]">
                              {activeRule.enabled ? 'Active' : 'Disabled'}
                            </span>
                            <Switch
                              checked={activeRule.enabled}
                              onChange={(enabled) => updateRule(activeRule.id, { enabled })}
                              label="Toggle auto reply rule"
                            />
                          </div>
                        </div>

                        <div className="rounded-[6px] border border-white/[0.08] bg-[#1a2228] p-2.5 font-sans text-[12px] text-[#cbd3dc] line-clamp-2">
                          {activeRule.responseMode === 'ai'
                            ? activeRule.aiInstructions || 'Responds intelligently to chatter messages'
                            : activeRule.response || '—'}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#9aa3af]">
                          <span>Cooldown: {activeRule.cooldownSeconds}s</span>
                          <span>Rank: {activeRule.minimumRank || 'everyone'}</span>
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center text-[12px] text-[#9aa3af]">
                        No auto-replies configured yet.{' '}
                        <button
                          type="button"
                          onClick={() => setTab('commands')}
                          className="text-[#a5b4fc] underline"
                        >
                          Create in Commands
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. CHAT OVERLAY MODULE */}
                {slotType === 'overlay' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-bold text-white">OBS Browser Source Stage</span>
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-300">
                        127.0.0.1:49178
                      </span>
                    </div>

                    <div className="rounded-[6px] border border-white/[0.08] bg-[#1a2228] p-3 text-[11.5px] text-[#9aa3af]">
                      Stream overlay renders chat with zero cloud delay. Paste into OBS at 1920 × 1080.
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-[11px]"
                        onClick={() => {
                          navigator.clipboard?.writeText('http://127.0.0.1:49178/overlay');
                        }}
                      >
                        <Copy size={12} /> Copy OBS URL
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-[11px]"
                        onClick={() => setTab('overlay')}
                      >
                        <ExternalLink size={12} /> Open Designer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
