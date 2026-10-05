import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Flame,
  FolderOpen,
  Gamepad2,
  GripVertical,
  Heart,
  Image as ImageIcon,
  Info,
  Languages,
  Layers,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Terminal,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import type {
  ActionTrigger,
  ActionTriggerType,
  CommandSequence,
  CounterAction,
  ModerationAction,
  SequenceStep,
  SequenceStepType,
  SequenceWaitUnit,
} from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import { normalizeTriggers, useSequenceStore } from '../../store/sequenceStore';
import { useCounterStore } from '../../store/counterStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useToolStore } from '../../store/toolStore';
import { DEFAULT_DUEL_MESSAGES } from '../../lib/duelGameManager';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { DurationPicker } from '../ui/DurationPicker';

export const EDGE_NEURAL_VOICES = [
  { id: 'en-AU-WilliamMultilingualNeural', name: 'Microsoft William (Multilingual - Arabic & English Neural)', nameAr: 'صوت ويليام (طبيعي - يدعم العربية والإنجليزية)' },
  { id: 'ar-SA-HamedNeural', name: 'Microsoft Hamed (Arabic - Saudi Arabia Neural)', nameAr: 'حامد (طبيعي - السعودية)' },
  { id: 'ar-SA-ZariyahNeural', name: 'Microsoft Zariyah (Arabic - Saudi Arabia Neural)', nameAr: 'زارية (طبيعي - السعودية)' },
  { id: 'ar-EG-SalmaNeural', name: 'Microsoft Salma (Arabic - Egypt Neural)', nameAr: 'سلمى (طبيعي - مصر)' },
  { id: 'ar-EG-ShakirNeural', name: 'Microsoft Shakir (Arabic - Egypt Neural)', nameAr: 'شاكر (طبيعي - مصر)' },
  { id: 'en-US-AndrewMultilingualNeural', name: 'Microsoft Andrew (Multilingual Neural)', nameAr: 'أندرو (طبيعي - متعدد اللغات)' },
  { id: 'en-US-EmmaMultilingualNeural', name: 'Microsoft Emma (Multilingual Neural)', nameAr: 'إيما (طبيعي - متعدد اللغات)' },
  { id: 'en-US-AvaMultilingualNeural', name: 'Microsoft Ava (Multilingual Expressive)', nameAr: 'آفا (طبيعي - متعدد اللغات)' },
  { id: 'en-US-JennyNeural', name: 'Microsoft Jenny (English US)', nameAr: 'جيني (طبيعي - إنجليزي أمريكي)' },
  { id: 'en-US-GuyNeural', name: 'Microsoft Guy (English US)', nameAr: 'جاي (طبيعي - إنجليزي أمريكي)' },
  { id: 'en-GB-SoniaNeural', name: 'Microsoft Sonia (English UK)', nameAr: 'سونيا (طبيعي - إنجليزي بريطاني)' },
  { id: 'en-GB-RyanNeural', name: 'Microsoft Ryan (English UK)', nameAr: 'رايان (طبيعي - بريطاني)' },
];

interface SequenceStudioViewProps {
  sequence: CommandSequence;
  onBack: () => void;
  lang: 'en' | 'ar';
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'triggers_table' | 'trigger_row' | 'actions_list' | 'action_row';
  targetId?: string;
  targetIndex?: number;
}

// ---------------------------------------------------------------------------
// Trigger Edit Modal
// ---------------------------------------------------------------------------
interface EditTriggerModalProps {
  trigger: ActionTrigger;
  availableRewards: Array<{ id: string; title: string; cost: number }>;
  lang: 'en' | 'ar';
  onSave: (patch: Partial<ActionTrigger>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EditTriggerModal({ trigger, availableRewards, lang, onSave, onDelete, onClose }: EditTriggerModalProps) {
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [minViewers, setMinViewers] = useState(trigger.minViewers ?? 1);
  const [minStreak, setMinStreak] = useState(trigger.minStreak ?? 1);
  const [chatCommand, setChatCommand] = useState(trigger.chatCommand ?? '!command');
  const [matchMode, setMatchMode] = useState(trigger.matchMode ?? 'startsWith');
  const [rewardTitle, setRewardTitle] = useState(trigger.rewardTitle ?? 'Custom Reward');
  const [rewardId, setRewardId] = useState(trigger.rewardId ?? '');

  const fetchAvailableRewards = useSequenceStore((s) => s.fetchAvailableRewards);
  const isLoadingRewards = useSequenceStore((s) => s.isLoadingRewards);

  useEffect(() => {
    if (trigger.type === 'twitch_channel_points') {
      void fetchAvailableRewards();
    }
  }, [trigger.type, fetchAvailableRewards]);

  const handleApply = () => {
    if (trigger.type === 'twitch_follow') {
      onSave({ enabled });
    } else if (trigger.type === 'twitch_raid') {
      onSave({ enabled, minViewers: Math.max(1, Number(minViewers) || 1) });
    } else if (trigger.type === 'twitch_watch_streak') {
      onSave({ enabled, minStreak: Math.max(1, Number(minStreak) || 1) });
    } else if (trigger.type === 'twitch_chat') {
      onSave({ enabled, chatCommand: chatCommand.trim() || '!command', matchMode });
    } else {
      onSave({ enabled, rewardTitle: rewardTitle.trim() || 'Custom Reward', rewardId });
    }
    onClose();
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[10px] border border-white/[0.14] bg-[#161922] text-[#F0F3F7] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-[#12141c] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className={`flex size-7 items-center justify-center rounded-md border ${
              trigger.type === 'twitch_follow'
                ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                : trigger.type === 'twitch_raid'
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : trigger.type === 'twitch_watch_streak'
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : trigger.type === 'twitch_chat'
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}>
              {trigger.type === 'twitch_follow' ? (
                <Heart size={15} />
              ) : trigger.type === 'twitch_raid' ? (
                <Flame size={15} />
              ) : trigger.type === 'twitch_watch_streak' ? (
                <Zap size={15} />
              ) : trigger.type === 'twitch_chat' ? (
                <Terminal size={15} />
              ) : (
                <Coins size={15} />
              )}
            </div>
            <div>
              <h3 className="font-sans text-[14px] font-bold text-white tracking-tight">
                {t(lang, 'sequence.editTrigger')}
              </h3>
              <p className="font-mono text-[11px] text-muted">
                {trigger.type === 'twitch_follow'
                  ? `${t(lang, 'sequence.sourceTwitchChannel')} > ${t(lang, 'sequence.typeChannelFollow')}`
                  : trigger.type === 'twitch_raid'
                  ? `${t(lang, 'sequence.sourceTwitchChannel')} > ${t(lang, 'sequence.typeChannelRaid')}`
                  : trigger.type === 'twitch_watch_streak'
                  ? `${t(lang, 'sequence.sourceTwitchChannel')} > ${t(lang, 'sequence.typeWatchStreak')}`
                  : trigger.type === 'twitch_chat'
                  ? `${t(lang, 'sequence.sourceCoreCommands')} > ${t(lang, 'sequence.typeCommandTriggered')}`
                  : `${t(lang, 'sequence.sourceTwitchPoints')} > ${t(lang, 'sequence.typeRewardRedemption')}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-[#11131a] p-3">
            <span className="font-sans text-[12.5px] font-medium">{t(lang, 'sequence.colEnabled')}</span>
            <div className="flex items-center gap-2">
              <Switch checked={enabled} onChange={setEnabled} label={t(lang, 'sequence.colEnabled')} />
              <span className={`font-mono text-[11px] font-semibold ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {enabled ? t(lang, 'sequence.yes') : t(lang, 'sequence.no')}
              </span>
            </div>
          </div>

          {trigger.type === 'twitch_follow' && (
            <div className="flex flex-col gap-2 rounded-md border border-pink-500/25 bg-pink-500/10 p-3.5 text-[12px] text-pink-300">
              <p className="font-semibold text-pink-200">
                {t(lang, 'sequence.triggerFollow')}
              </p>
              <p className="text-zinc-300 text-[11.5px] leading-relaxed">
                {t(lang, 'sequence.triggerFollowDesc')}
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-pink-400 font-mono text-[11px]">{'{username}'}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-pink-400 font-mono text-[11px]">{'{mention}'}</span>
              </div>
            </div>
          )}

          {trigger.type === 'twitch_raid' && (
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'sequence.minViewers')}
              </label>
              <Input
                type="number"
                min={1}
                max={100000}
                value={minViewers}
                onChange={(e) => setMinViewers(Math.max(1, Number(e.target.value)))}
                className="h-9 font-mono text-[13px]"
              />
              <p className="text-[11px] text-muted">{t(lang, 'sequence.minViewersHint')}</p>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-zinc-400">
                <span className="text-muted">Available tokens:</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-orange-400">{'{raider}'}</span>
                <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-orange-400">{'{viewers}'}</span>
              </div>
            </div>
          )}

          {trigger.type === 'twitch_watch_streak' && (
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'sequence.minStreak')}
              </label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={minStreak}
                onChange={(e) => setMinStreak(Math.max(1, Number(e.target.value)))}
                className="h-9 font-mono text-[13px]"
              />
              <p className="text-[11px] text-muted">{t(lang, 'sequence.minStreakHint')}</p>
              <div className="flex flex-col gap-2 rounded-md border border-purple-500/25 bg-purple-500/10 p-3 text-[11.5px] text-purple-300">
                <p className="text-zinc-300 leading-relaxed">
                  {t(lang, 'sequence.triggerWatchStreakDesc')}
                </p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-purple-300 font-mono text-[11px]">{'{username}'}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-purple-300 font-mono text-[11px]">{'{streak}'}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 border border-white/10 text-purple-300 font-mono text-[11px]">{'{input}'}</span>
                </div>
              </div>
            </div>
          )}

          {trigger.type === 'twitch_chat' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.triggerChatCommand')}
                </label>
                <Input
                  value={chatCommand}
                  onChange={(e) => setChatCommand(e.target.value)}
                  placeholder="!command"
                  className="h-9 font-mono text-[13px]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.matchMode')}
                </label>
                <SegmentedControl<'startsWith' | 'exact' | 'contains'>
                  value={matchMode}
                  onChange={setMatchMode}
                  options={[
                    { value: 'startsWith', label: t(lang, 'sequence.matchStartsWith') },
                    { value: 'exact', label: t(lang, 'sequence.matchExact') },
                    { value: 'contains', label: t(lang, 'sequence.matchContains') },
                  ]}
                />
              </div>
            </div>
          )}

          {trigger.type === 'twitch_channel_points' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.rewardTitle')}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void fetchAvailableRewards()}
                    disabled={isLoadingRewards}
                    className="h-6 gap-1 px-2 text-[11px] text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                    title={t(lang, 'sequence.refreshRewardsHint')}
                  >
                    <RefreshCw size={11} className={isLoadingRewards ? 'animate-spin' : ''} />
                    <span>{t(lang, 'sequence.refreshRewards')}</span>
                  </Button>
                </div>
                {availableRewards.length > 0 ? (
                  <select
                    value={rewardId || rewardTitle}
                    onChange={(e) => {
                      const selected = availableRewards.find((r) => r.id === e.target.value || r.title === e.target.value);
                      if (selected) {
                        setRewardId(selected.id);
                        setRewardTitle(selected.title);
                      } else {
                        setRewardTitle(e.target.value);
                      }
                    }}
                    className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="">{t(lang, 'sequence.rewardSelectPlaceholder')}</option>
                    {availableRewards.map((reward) => (
                      <option key={reward.id} value={reward.id}>
                        {reward.title} ({reward.cost} pts)
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder="Hydrate"
                    className="h-9 text-[13px]"
                  />
                )}
                <p className="text-[10.5px] text-muted">
                  {t(lang, 'sequence.refreshRewardsHint')}
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/[0.08] bg-[#12141c] px-5 py-3">
          {onDelete ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 font-semibold cursor-pointer"
            >
              <Trash2 size={13} className="me-1.5" />
              <span>{t(lang, 'sequence.deleteTrigger')}</span>
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t(lang, 'autoReplies.cancel')}
            </Button>
            <Button size="sm" onClick={handleApply} className="bg-accent text-white hover:bg-accent-hover font-semibold">
              <Check size={13} className="me-1.5" />
              <span>{t(lang, 'autoReplies.done')}</span>
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Action Edit Modal
// ---------------------------------------------------------------------------
interface EditSubActionModalProps {
  step: SequenceStep;
  index: number;
  counters: Array<{ id: string; name: string }>;
  lang: 'en' | 'ar';
  onSave: (patch: Partial<SequenceStep>) => void;
  onClose: () => void;
}

function EditSubActionModal({ step, index, counters, lang, onSave, onClose }: EditSubActionModalProps) {
  // Comment state
  const [commentText, setCommentText] = useState(step.commentText ?? '** This is a comment! **');

  // Chat state
  const [chatMessage, setChatMessage] = useState(step.chatMessage ?? '');

  // Wait state
  const [waitDuration, setWaitDuration] = useState(step.waitDuration ?? 2);
  const [waitUnit, setWaitUnit] = useState<SequenceWaitUnit>(step.waitUnit ?? 'seconds');

  // Counter state
  const [counterId, setCounterId] = useState(step.counterId ?? counters[0]?.id ?? '');
  const [counterAction, setCounterAction] = useState<CounterAction>(step.counterAction ?? 'increase');

  // Command state
  const [commandTrigger, setCommandTrigger] = useState(step.commandTrigger ?? '!sound');

  // Moderation state
  const [moderationAction, setModerationAction] = useState<ModerationAction>(step.moderationAction ?? 'shoutout');
  const [targetUser, setTargetUser] = useState(
    step.targetUser ?? (step.moderationAction === 'shoutout' ? '{raider}' : '{input}')
  );
  const [durationSeconds, setDurationSeconds] = useState(step.durationSeconds ?? 60);
  const [reason, setReason] = useState(step.reason ?? '');

  // Sound state
  const [soundPath, setSoundPath] = useState(step.soundPath ?? '');
  const [soundVolume, setSoundVolume] = useState(step.soundVolume ?? 1.0);
  const [isPlayingSound, setIsPlayingSound] = useState(false);

  // TTS state
  const [ttsText, setTtsText] = useState(step.ttsText ?? 'Welcome to the stream {username}!');
  const [ttsVoice, setTtsVoice] = useState(step.ttsVoice ?? '');
  const [ttsRate, setTtsRate] = useState(step.ttsRate ?? 1.0);
  const [ttsPitch, setTtsPitch] = useState(step.ttsPitch ?? 1.0);
  const [ttsVolume, setTtsVolume] = useState(step.ttsVolume ?? 1.0);
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);

  // OBS Text state
  const [filePath, setFilePath] = useState(step.filePath ?? 'C:\\stream\\latest_follower.txt');
  const [fileContent, setFileContent] = useState(step.fileContent ?? 'Latest Follower: {username}');

  // Poll state
  const [pollAction, setPollAction] = useState<'start' | 'end' | 'reset'>(step.pollAction ?? 'start');
  const [pollQuestion, setPollQuestion] = useState(step.pollQuestion ?? 'What game should we play next?');
  const [pollOptionsText, setPollOptionsText] = useState((step.pollOptions ?? ['Option A', 'Option B']).join(', '));
  const [pollDurationSeconds, setPollDurationSeconds] = useState(step.pollDurationSeconds ?? 60);

  // Mic Mute state
  const [micMuteDurationSeconds, setMicMuteDurationSeconds] = useState(step.micMuteDurationSeconds ?? 5);
  const [micMuteSourceName, setMicMuteSourceName] = useState(step.micMuteSourceName ?? '');
  const [isTestMuting, setIsTestMuting] = useState(false);

  // OBS Audio Sources from Store
  const availableObsAudioSources = useSequenceStore((s) => s.availableObsAudioSources);
  const obsConnected = useSequenceStore((s) => s.obsConnected);
  const fetchObsAudioSources = useSequenceStore((s) => s.fetchObsAudioSources);
  const isLoadingObsSources = useSequenceStore((s) => s.isLoadingObsSources);
  const connectObs = useSequenceStore((s) => s.connectObs);
  const autoDetectObs = useSequenceStore((s) => s.autoDetectObs);
  const [isConnectingObs, setIsConnectingObs] = useState(false);

  // OBS Image state
  const [imagePath, setImagePath] = useState(step.imagePath ?? '');
  const [imageDurationSeconds, setImageDurationSeconds] = useState(step.imageDurationSeconds ?? 5);
  const [imagePosition, setImagePosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'fullscreen'
  >(step.imagePosition ?? 'center');
  const [imageAnimation, setImageAnimation] = useState<
    'bounce' | 'fade' | 'zoom' | 'slide-up' | 'slide-down' | 'none'
  >(step.imageAnimation ?? 'bounce');
  const [imageScale, setImageScale] = useState(step.imageScale ?? 1.0);
  const [isPreviewingImage, setIsPreviewingImage] = useState(false);
  const [copiedImageUrl, setCopiedImageUrl] = useState(false);

  // Mini-Game Duel state
  const [duelMode, setDuelMode] = useState<'random' | 'ai_trivia'>(step.duelMode ?? 'ai_trivia');
  const [duelOpponent, setDuelOpponent] = useState(step.duelOpponent ?? '{input}');
  const [duelTimeoutDuration, setDuelTimeoutDuration] = useState(step.duelTimeoutDuration ?? 60);
  const [duelTimerSeconds, setDuelTimerSeconds] = useState(step.duelTimerSeconds ?? 30);
  const [duelLanguage, setDuelLanguage] = useState<'auto' | 'en' | 'ar'>(step.duelLanguage ?? 'auto');
  const [duelCategory, setDuelCategory] = useState<string>(step.duelCategory ?? 'general');
  const [duelChallengerWinChance, setDuelChallengerWinChance] = useState<number>(step.duelChallengerWinChance ?? 50);
  const [duelAllowBroadcaster, setDuelAllowBroadcaster] = useState<boolean>(step.duelAllowBroadcaster ?? true);
  const [duelBroadcasterMuteSource, setDuelBroadcasterMuteSource] = useState<string>(step.duelBroadcasterMuteSource ?? '');
  const defaultDuelInstructions = lang === 'ar'
    ? 'اجعل السؤال بسيطاً ومتنوعاً عن ألعاب مشهورة (مثل ألعاب السولز، زيلدا، مونستر هنتر، ماريو، جود أوف وار، ويتشر، كود، ماينكرافت، إلخ). نوّع الأسئلة ولا تكرر نفس اللعبة في كل مرة. يجب أن تكون الإجابة واضحة ومعروفة ومن كلمة إلى 3 كلمات.'
    : 'Keep questions simple, diverse, and focused on popular games (such as Souls games, Zelda, Monster Hunter, Mario, God of War, Witcher, CoD, Minecraft, etc.). Vary games every round and never repeat the same game consecutively. The answer must be clear, well-known, and 1 to 3 words.';
  const [duelInstructions, setDuelInstructions] = useState<string>(step.duelInstructions ?? defaultDuelInstructions);
  const [duelMessageStart, setDuelMessageStart] = useState<string>(step.duelMessageStart ?? '');
  const [duelMessageWin, setDuelMessageWin] = useState<string>(step.duelMessageWin ?? '');
  const [duelMessageTimeout, setDuelMessageTimeout] = useState<string>(step.duelMessageTimeout ?? '');
  const [showAdvancedDuelMessages, setShowAdvancedDuelMessages] = useState<boolean>(
    Boolean(step.duelMessageStart || step.duelMessageWin || step.duelMessageTimeout)
  );

  const handleBrowseSound = async () => {
    try {
      const res = await rpc.invoke(Channels.DialogOpenFile, {
        filter: 'Audio files (*.mp3;*.wav;*.ogg;*.wma)|*.mp3;*.wav;*.ogg;*.wma|All files (*.*)|*.*',
        title: 'Select Sound Effect File',
      });
      if (res?.path) setSoundPath(res.path);
    } catch { }
  };

  const handleTestSound = async () => {
    if (!soundPath.trim()) return;
    setIsPlayingSound(true);
    try {
      await rpc.invoke(Channels.AudioPlaySound, { soundPath: soundPath.trim(), volume: soundVolume });
    } finally {
      setTimeout(() => setIsPlayingSound(false), 1200);
    }
  };

  const handleTestTts = async () => {
    const raw = ttsText
      .replace(/\{username\}/gi, 'Viewer')
      .replace(/\{user\}/gi, 'Viewer')
      .replace(/\{input\}/gi, 'hello')
      .trim();
    if (!raw) return;

    setIsSpeakingTts(true);

    try {
      const res = await rpc.invoke(Channels.AudioSpeakTts, {
        text: raw,
        voiceName: ttsVoice || undefined,
        rate: ttsRate,
        pitch: ttsPitch,
        volume: ttsVolume,
      });

      if (res && res.ok) {
        // If not played directly by host desktop audio player, play via WebView2 HTML5 Audio
        if (!res.playedOnHost && res.audioBase64) {
          const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
          audio.volume = Math.max(0, Math.min(ttsVolume ?? 1.0, 1.0));
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = () => resolve();
            audio.play().catch(() => resolve());
          });
        }
      }
    } catch (err) {
      console.error('[TTS] Test speech error:', err);
    } finally {
      setIsSpeakingTts(false);
    }
  };

  const handleBrowseTextFile = async () => {
    try {
      const res = await rpc.invoke(Channels.DialogSaveFile, { defaultName: 'stream-text.txt' });
      if (res?.path) setFilePath(res.path);
    } catch { }
  };

  const handleBrowseImage = async () => {
    try {
      const res = await rpc.invoke(Channels.DialogOpenFile, {
        filter: 'Image files (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp)|*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp|All files (*.*)|*.*',
        title: 'Select Image or GIF for OBS',
      });
      if (res?.path) setImagePath(res.path);
    } catch { }
  };

  const handleCopyImageOverlayUrl = async () => {
    try {
      await navigator.clipboard.writeText('http://127.0.0.1:49178/image-overlay.html');
      setCopiedImageUrl(true);
      setTimeout(() => setCopiedImageUrl(false), 2000);
    } catch { }
  };

  const handleTestImage = async () => {
    if (!imagePath.trim()) return;
    setIsPreviewingImage(true);
    try {
      await rpc.invoke(Channels.ChatOverlayShowImage, {
        imageUrl: imagePath.trim(),
        imagePath: imagePath.trim(),
        durationSeconds: imageDurationSeconds,
        position: imagePosition,
        animation: imageAnimation,
        scale: imageScale,
        imageScale,
      });
    } finally {
      setTimeout(() => setIsPreviewingImage(false), 2000);
    }
  };

  const handleTestMicMute = async () => {
    setIsTestMuting(true);
    try {
      await rpc.invoke(Channels.ObsMuteSource, {
        sourceName: micMuteSourceName.trim() || undefined,
        durationSeconds: 3,
      });
    } finally {
      setTimeout(() => setIsTestMuting(false), 3000);
    }
  };

  const handleQuickConnectObs = async () => {
    setIsConnectingObs(true);
    try {
      const detected = await autoDetectObs();
      const res = await connectObs({
        host: detected.host || '127.0.0.1',
        port: detected.port || 4455,
        password: detected.password || '',
      });
      if (res.ok) {
        await fetchObsAudioSources();
      }
    } finally {
      setIsConnectingObs(false);
    }
  };

  const handleOpenObsSettings = () => {
    useToolStore.getState().setActiveTool('settings');
    useToolStore.getState().setSection('obs');
    onClose();
  };

  const handleApply = () => {
    switch (step.type) {
      case 'comment':
        onSave({ commentText: commentText.trim() });
        break;
      case 'chat':
        onSave({ chatMessage: chatMessage.trim() });
        break;
      case 'wait':
        onSave({ waitDuration: Math.max(0.1, Number(waitDuration) || 1), waitUnit });
        break;
      case 'counter':
        onSave({ counterId, counterAction });
        break;
      case 'command':
        onSave({ commandTrigger: commandTrigger.trim() });
        break;
      case 'moderation':
        onSave({
          moderationAction,
          targetUser: targetUser.trim(),
          durationSeconds: Math.max(1, Number(durationSeconds) || 60),
          reason: reason.trim(),
        });
        break;
      case 'sound':
        onSave({ soundPath: soundPath.trim(), soundVolume });
        break;
      case 'tts':
        onSave({
          ttsText: ttsText.trim(),
          ttsVoice: ttsVoice || undefined,
          ttsRate,
          ttsPitch,
          ttsVolume,
        });
        break;
      case 'obs_text':
        onSave({ filePath: filePath.trim(), fileContent });
        break;
      case 'obs_image':
        onSave({
          imagePath: imagePath.trim(),
          imageDurationSeconds: Math.max(1, Number(imageDurationSeconds) || 5),
          imagePosition,
          imageAnimation,
          imageScale,
        });
        break;
      case 'duel':
        onSave({
          duelMode,
          duelOpponent: duelOpponent.trim(),
          duelTimeoutDuration: Math.max(5, Number(duelTimeoutDuration) || 60),
          duelTimerSeconds: Math.max(5, Number(duelTimerSeconds) || 30),
          duelLanguage,
          duelCategory: duelCategory.trim(),
          duelInstructions: duelInstructions.trim(),
          duelMessageStart: duelMessageStart.trim() || undefined,
          duelMessageWin: duelMessageWin.trim() || undefined,
          duelMessageTimeout: duelMessageTimeout.trim() || undefined,
          duelChallengerWinChance: Math.max(1, Math.min(99, Number(duelChallengerWinChance) || 50)),
          duelAllowBroadcaster,
          duelBroadcasterMuteSource: duelBroadcasterMuteSource.trim() || undefined,
        });
        break;
      case 'poll':
        onSave({
          pollAction,
          pollQuestion: pollQuestion.trim(),
          pollOptions: pollOptionsText.split(',').map((o) => o.trim()).filter(Boolean),
          pollDurationSeconds,
        });
        break;
      case 'mic_mute':
        onSave({
          micMuteDurationSeconds: Math.max(1, Number(micMuteDurationSeconds) || 5),
          micMuteSourceName: micMuteSourceName.trim() || undefined,
        });
        break;
    }
    onClose();
  };

  const insertToken = (token: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    setter((prev) => (prev ? `${prev} ${token}` : token));
  };

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <section
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-[580px] flex-col overflow-hidden rounded-[10px] border border-white/[0.14] bg-[#161922] text-[#F0F3F7] shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <header className="flex items-center justify-between border-b border-white/[0.08] bg-[#12141c] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30">
              <Edit3 size={15} />
            </div>
            <div>
              <h3 className="font-sans text-[14px] font-bold text-white tracking-tight">
                {t(lang, 'sequence.editSubAction')} #{index + 1}
              </h3>
              <p className="font-mono text-[11px] text-muted">
                {step.type === 'comment'
                  ? (lang === 'ar' ? 'تعليق / ملاحظة' : 'Comment / Note')
                  : step.type === 'chat'
                  ? (lang === 'ar' ? 'تويتش > إرسال رسالة' : 'Twitch > Send Message')
                  : step.type === 'moderation'
                  ? (lang === 'ar' ? `تويتش > الإشراف (${moderationAction})` : `Twitch > Moderation (${moderationAction})`)
                  : step.type === 'sound'
                  ? (lang === 'ar' ? 'الصوت > تشغيل مؤثر صوتي' : 'Audio > Play Sound Effect')
                  : step.type === 'tts'
                  ? (lang === 'ar' ? 'الكلام > قراءة النص صوتياً' : 'Speech > Text-To-Speech')
                  : step.type === 'obs_text'
                  ? (lang === 'ar' ? 'OBS > إخراج ملف نصي' : 'OBS > Text File Output')
                  : step.type === 'obs_image'
                  ? (lang === 'ar' ? 'OBS > عرض صورة أو GIF' : 'OBS > Display Picture or GIF')
                  : step.type === 'duel'
                  ? (lang === 'ar' ? 'التفاعل > تحدي التايم آوت (المبارزة)' : 'Interactivity > Timeout Duel')
                  : step.type === 'poll'
                  ? (lang === 'ar' ? 'التفاعل > استطلاع وتصويت مباشر' : 'Interactivity > Live Poll')
                  : step.type === 'mic_mute'
                  ? (lang === 'ar' ? 'الصوت > كتم مايك الستريمر' : 'Audio > Mute Streamer Mic')
                  : step.type === 'wait'
                  ? (lang === 'ar' ? 'النظام > انتظار وتأخير' : 'Core > Delay / Wait')
                  : step.type === 'counter'
                  ? (lang === 'ar' ? 'العدّادات > تعديل عدّاد' : 'Counters > Modify Counter')
                  : (lang === 'ar' ? 'النظام > تشغيل أمر فرعي' : 'Core > Run Sub-Command')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded text-muted hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </header>

        <div className="flex flex-col gap-4 p-5 max-h-[75vh] overflow-y-auto">
          {/* COMMENT */}
          {step.type === 'comment' && (
            <div className="flex flex-col gap-3">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'sequence.addComment')}
              </label>
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t(lang, 'sequence.commentPlaceholder')}
                className="h-9 font-mono text-[13px] text-emerald-400 border-emerald-500/30 bg-emerald-500/5 focus:border-emerald-500"
              />
              <div className="rounded-md border border-emerald-500/30 bg-[#0d1712] p-3 font-mono text-[12px] text-emerald-400">
                💬 // ** {commentText || t(lang, 'sequence.commentPlaceholder')} **
              </div>
            </div>
          )}

          {/* CHAT */}
          {step.type === 'chat' && (
            <div className="flex flex-col gap-3">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'sequence.stepChat')}
              </label>
              <textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={t(lang, 'sequence.chatPlaceholder')}
                rows={3}
                className="w-full rounded-md border border-white/15 bg-[#11131a] p-3 font-mono text-[12.5px] text-foreground focus:border-accent focus:outline-none resize-y"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10.5px] text-muted">Tokens:</span>
                {['{raider}', '{viewers}', '{username}', '{mention}', '{target}', '{input}'].map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => insertToken(tok, setChatMessage)}
                    className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors"
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MODERATION */}
          {step.type === 'moderation' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.modAction')}
                </label>
                <select
                  value={moderationAction}
                  onChange={(e) => setModerationAction(e.target.value as ModerationAction)}
                  className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="shoutout">{t(lang, 'sequence.actionShoutout')}</option>
                  <option value="smart_timeout">{t(lang, 'sequence.actionSmartTimeout')}</option>
                  <option value="timeout">{t(lang, 'sequence.actionTimeout')}</option>
                  <option value="ban">{t(lang, 'sequence.actionBan')}</option>
                  <option value="unban">{t(lang, 'sequence.actionUnban')}</option>
                  <option value="mod">{t(lang, 'sequence.actionMod')}</option>
                  <option value="unmod">{t(lang, 'sequence.actionUnmod')}</option>
                  <option value="vip">{t(lang, 'sequence.actionVip')}</option>
                  <option value="unvip">{t(lang, 'sequence.actionUnvip')}</option>
                  <option value="clear_chat">{t(lang, 'sequence.actionClearChat')}</option>
                </select>
              </div>

              {moderationAction !== 'clear_chat' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.targetUser')}
                  </label>
                  <Input
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    placeholder="{raider} or @username"
                    className="h-9 font-mono text-[12.5px]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="font-mono text-[10.5px] text-muted">Tokens:</span>
                    {['{raider}', '{target}', '{input}', '{username}'].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => setTargetUser(tok)}
                        className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(moderationAction === 'smart_timeout' || moderationAction === 'timeout') && (
                <div className="flex flex-col gap-2">
                  <DurationPicker
                    value={durationSeconds}
                    onChange={setDurationSeconds}
                    min={5}
                    max={1800}
                    step={5}
                    presets={[10, 30, 60, 120, 300, 600]}
                    label={t(lang, 'sequence.modDuration')}
                    accentColor="rose"
                  />
                  {moderationAction === 'smart_timeout' && (
                    <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                      <Zap size={14} className="mt-0.5 shrink-0 text-amber-400" />
                      <span>{t(lang, 'sequence.smartModNotice', { s: String(durationSeconds) })}</span>
                    </div>
                  )}
                </div>
              )}

              {moderationAction !== 'clear_chat' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.modReason')}
                  </label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t(lang, 'sequence.modReasonPlaceholder')}
                    className="h-9 text-[12.5px]"
                  />
                </div>
              )}
            </div>
          )}

          {/* WAIT */}
          {step.type === 'wait' && (
            <div className="flex flex-col gap-3">
              <DurationPicker
                value={waitDuration}
                onChange={setWaitDuration}
                min={waitUnit === 'minutes' ? 0.5 : 0.1}
                max={waitUnit === 'minutes' ? 60 : 300}
                step={waitUnit === 'minutes' ? 0.5 : 0.5}
                presets={waitUnit === 'minutes' ? [0.5, 1, 2, 5, 10] : [1, 3, 5, 10, 30, 60]}
                unit={waitUnit === 'minutes' ? 'm' : 's'}
                label={t(lang, 'sequence.duration')}
                accentColor="sky"
              />
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {lang === 'ar' ? 'وحدة الوقت' : 'Time Unit'}
                </label>
                <SegmentedControl<SequenceWaitUnit>
                  value={waitUnit}
                  onChange={setWaitUnit}
                  options={[
                    { value: 'seconds', label: t(lang, 'sequence.seconds') },
                    { value: 'minutes', label: t(lang, 'sequence.minutes') },
                  ]}
                />
              </div>
            </div>
          )}

          {/* COUNTER */}
          {step.type === 'counter' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.counterSelect')}
                </label>
                {counters.length > 0 ? (
                  <select
                    value={counterId}
                    onChange={(e) => setCounterId(e.target.value)}
                    className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                  >
                    {counters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                    No counters created yet. Create a counter first in the Counters tab.
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.counterAction')}
                </label>
                <SegmentedControl<CounterAction>
                  value={counterAction}
                  onChange={setCounterAction}
                  options={[
                    { value: 'increase', label: t(lang, 'sequence.increase') },
                    { value: 'decrease', label: t(lang, 'sequence.decrease') },
                    { value: 'reset', label: t(lang, 'sequence.reset') },
                  ]}
                />
              </div>
            </div>
          )}

          {/* COMMAND */}
          {step.type === 'command' && (
            <div className="flex flex-col gap-2">
              <label className="font-sans text-[12px] font-medium text-zinc-300">
                {t(lang, 'sequence.stepCommand')}
              </label>
              <Input
                value={commandTrigger}
                onChange={(e) => setCommandTrigger(e.target.value)}
                placeholder="!sound"
                className="h-9 font-mono text-[13px]"
              />
              <p className="text-[11px] text-muted">{t(lang, 'sequence.commandPlaceholder')}</p>
            </div>
          )}

          {/* SOUND EFFECT */}
          {step.type === 'sound' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.soundFile')}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={soundPath}
                    onChange={(e) => setSoundPath(e.target.value)}
                    placeholder="C:\Sounds\alert.mp3"
                    className="h-9 font-mono text-[12.5px] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBrowseSound()}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <FolderOpen size={13} />
                    <span>{t(lang, 'sequence.browse')}</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.volume')}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">{Math.round(soundVolume * 100)}%</span>
                </div>
                <Slider
                  value={Math.round(soundVolume * 100)}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => setSoundVolume(v / 100)}
                  ariaLabel={t(lang, 'sequence.volume')}
                />
              </div>

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleTestSound()}
                  disabled={isPlayingSound || !soundPath.trim()}
                  className="gap-1.5 text-indigo-400 hover:text-indigo-300 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20"
                >
                  <Volume2 size={13} className={isPlayingSound ? 'animate-bounce' : ''} />
                  <span>{isPlayingSound ? t(lang, 'sequence.playing') : t(lang, 'sequence.previewSound')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* TEXT TO SPEECH */}
          {step.type === 'tts' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.ttsMessage')}
                </label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Welcome to the stream {username}!"
                  rows={3}
                  className="w-full rounded-md border border-white/15 bg-[#11131a] p-3 font-mono text-[12.5px] text-foreground focus:border-accent focus:outline-none resize-y"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                  {['{username}', '{mention}', '{input}', '{raider}', '{viewers}'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertToken(tok, setTtsText)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.ttsVoice')}
                </label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">{t(lang, 'sequence.autoVoice')}</option>
                  <optgroup label={lang === 'ar' ? 'أصوات مايكروسوفت الطبيعية (Microsoft Online Voices)' : 'Microsoft Online Voices (Neural)'}>
                    {EDGE_NEURAL_VOICES.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {lang === 'ar' ? `${ev.nameAr} (${ev.id.split('-')[0]})` : ev.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 rounded-md border border-white/[0.08] bg-[#11131a] p-2.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-zinc-300 font-medium">{t(lang, 'sequence.ttsSpeed')}</span>
                    <span className="font-mono text-zinc-400">{ttsRate.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={Math.round(ttsRate * 10)}
                    min={5}
                    max={20}
                    step={1}
                    onChange={(v) => setTtsRate(v / 10)}
                    ariaLabel={t(lang, 'sequence.ttsSpeed')}
                  />
                </div>

                <div className="flex flex-col gap-1 rounded-md border border-white/[0.08] bg-[#11131a] p-2.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-zinc-300 font-medium">{t(lang, 'sequence.ttsPitch')}</span>
                    <span className="font-mono text-zinc-400">{ttsPitch.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={Math.round(ttsPitch * 10)}
                    min={5}
                    max={15}
                    step={1}
                    onChange={(v) => setTtsPitch(v / 10)}
                    ariaLabel={t(lang, 'sequence.ttsPitch')}
                  />
                </div>

                <div className="flex flex-col gap-1 rounded-md border border-white/[0.08] bg-[#11131a] p-2.5">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-zinc-300 font-medium">{t(lang, 'sequence.volume')}</span>
                    <span className="font-mono text-zinc-400">{Math.round(ttsVolume * 100)}%</span>
                  </div>
                  <Slider
                    value={Math.round(ttsVolume * 100)}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) => setTtsVolume(v / 100)}
                    ariaLabel={t(lang, 'sequence.volume')}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleTestTts}
                  disabled={isSpeakingTts || !ttsText.trim()}
                  className="gap-1.5 text-teal-400 hover:text-teal-300 border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20"
                >
                  <Mic size={13} className={isSpeakingTts ? 'animate-pulse' : ''} />
                  <span>{isSpeakingTts ? t(lang, 'sequence.speaking') : t(lang, 'sequence.previewTts')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* OBS TEXT OUTPUT */}
          {step.type === 'obs_text' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.obsFilePath')}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="C:\stream\latest_follower.txt"
                    className="h-9 font-mono text-[12.5px] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBrowseTextFile()}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <FolderOpen size={13} />
                    <span>{t(lang, 'sequence.browse')}</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.obsFileContent')}
                </label>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  placeholder="Latest Follower: {username}"
                  rows={3}
                  className="w-full rounded-md border border-white/15 bg-[#11131a] p-3 font-mono text-[12.5px] text-foreground focus:border-accent focus:outline-none resize-y"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                  {['{username}', '{mention}', '{input}', '{raider}', '{viewers}'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertToken(tok, setFileContent)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LIVE POLL */}
          {step.type === 'poll' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.pollAction')}
                </label>
                <SegmentedControl<'start' | 'end' | 'reset'>
                  value={pollAction}
                  onChange={setPollAction}
                  options={[
                    { value: 'start', label: `▶ ${t(lang, 'sequence.pollStart')}` },
                    { value: 'end', label: `⏹ ${t(lang, 'sequence.pollEnd')}` },
                    { value: 'reset', label: `↺ ${t(lang, 'sequence.pollReset')}` },
                  ]}
                />
              </div>

              {pollAction === 'start' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[12px] font-medium text-zinc-300">
                      {t(lang, 'sequence.pollQuestion')}
                    </label>
                    <Input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="What game next?"
                      className="h-9 text-[12.5px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-sans text-[12px] font-medium text-zinc-300">
                      {t(lang, 'sequence.pollOptions')}
                    </label>
                    <Input
                      value={pollOptionsText}
                      onChange={(e) => setPollOptionsText(e.target.value)}
                      placeholder="Option 1, Option 2, Option 3"
                      className="h-9 text-[12.5px]"
                    />
                  </div>

                  <DurationPicker
                    value={pollDurationSeconds}
                    onChange={setPollDurationSeconds}
                    min={10}
                    max={600}
                    step={5}
                    presets={[15, 30, 60, 120, 300]}
                    label={t(lang, 'sequence.pollDuration')}
                    accentColor="sky"
                  />
                </>
              )}
            </div>
          )}

          {/* MIC MUTE / OBS AUDIO SOURCE MUTE */}
          {step.type === 'mic_mute' && (
            <div className="flex flex-col gap-3.5">
              <DurationPicker
                value={micMuteDurationSeconds}
                onChange={setMicMuteDurationSeconds}
                min={1}
                max={300}
                step={1}
                presets={[5, 10, 15, 30, 60]}
                label={t(lang, 'sequence.micMuteDuration')}
                accentColor="rose"
              />

              {/* OBS Audio Source Dropdown & Refresh */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.obsAudioSource')}
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void fetchObsAudioSources()}
                    disabled={isLoadingObsSources}
                    className="h-6 gap-1 px-2 text-[11px] text-zinc-300 hover:text-white hover:bg-white/10"
                    title={t(lang, 'sequence.refreshSources')}
                  >
                    <RefreshCw size={11} className={isLoadingObsSources ? 'animate-spin' : ''} />
                    <span>{t(lang, 'sequence.refreshSources')}</span>
                  </Button>
                </div>

                <select
                  value={micMuteSourceName}
                  onChange={(e) => setMicMuteSourceName(e.target.value)}
                  className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">{t(lang, 'sequence.obsDefaultMic')}</option>
                  {availableObsAudioSources.map((source) => (
                    <option key={source.name} value={source.name}>
                      {source.name} ({source.kind}) {source.muted ? '🔇' : '🔊'}
                    </option>
                  ))}
                </select>
                <p className="text-[10.5px] text-muted">
                  {t(lang, 'sequence.obsAudioSourceHint')}
                </p>
              </div>

              {!obsConnected ? (
                <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] text-amber-200">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>{t(lang, 'sequence.obsDisconnectedNotice')}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleQuickConnectObs()}
                      disabled={isConnectingObs}
                      className="h-6.5 gap-1.5 px-2.5 text-[11px] font-medium bg-amber-500 hover:bg-amber-400 text-black border-none"
                    >
                      {isConnectingObs ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <Zap size={11} />
                      )}
                      <span>{t(lang, 'sequence.autoDetectAndConnect')}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleOpenObsSettings}
                      className="h-6.5 gap-1 px-2 text-[11px] text-amber-300 hover:text-white hover:bg-amber-500/20"
                    >
                      <Sliders size={11} />
                      <span>{t(lang, 'sequence.openObsSettings')}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-300">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{t(lang, 'sequence.obsConnectedStatus', { n: availableObsAudioSources.length })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenObsSettings}
                    className="text-[10.5px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    {t(lang, 'sequence.openObsSettings')}
                  </button>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-[11.5px] text-rose-300">
                <MicOff size={15} className="mt-0.5 shrink-0 text-rose-400" />
                <span>{t(lang, 'sequence.micMuteNotice')}</span>
              </div>

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleTestMicMute()}
                  disabled={isTestMuting}
                  className="gap-1.5 text-rose-400 hover:text-rose-300 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20"
                >
                  <VolumeX size={13} className={isTestMuting ? 'animate-pulse' : ''} />
                  <span>{isTestMuting ? t(lang, 'sequence.muting') : t(lang, 'sequence.testMicMute')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* OBS IMAGE */}
          {step.type === 'obs_image' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.imageSource')}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={imagePath}
                    onChange={(e) => setImagePath(e.target.value)}
                    placeholder="C:\stream\meme.gif or https://.../image.png"
                    className="h-9 font-mono text-[12.5px] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleBrowseImage()}
                    className="h-9 shrink-0 gap-1.5"
                  >
                    <FolderOpen size={13} />
                    <span>{t(lang, 'sequence.browse')}</span>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                  {['{username}', '{input}', '{target}'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => insertToken(tok, setImagePath)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Box */}
              {imagePath.trim() && (
                <div className="flex items-center gap-3 rounded-md border border-white/[0.08] bg-[#11131a] p-2.5">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded bg-black/40 border border-white/10 overflow-hidden">
                    <img
                      src={
                        imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')
                          ? imagePath
                          : `http://127.0.0.1:49178/media?path=${encodeURIComponent(imagePath)}`
                      }
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-[11.5px]">
                    <div className="font-medium text-white truncate">{imagePath.split(/[/\\]/).pop()}</div>
                    <div className="text-[10.5px] text-muted truncate">{imagePath}</div>
                  </div>
                </div>
              )}

              {/* Position and Animation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.imagePosition')}
                  </label>
                  <select
                    value={imagePosition}
                    onChange={(e) => setImagePosition(e.target.value as any)}
                    className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="center">{lang === 'ar' ? 'المنتصف' : 'Center'}</option>
                    <option value="top-center">{lang === 'ar' ? 'أعلى الوسط' : 'Top Center'}</option>
                    <option value="bottom-center">{lang === 'ar' ? 'أسفل الوسط' : 'Bottom Center'}</option>
                    <option value="top-left">{lang === 'ar' ? 'أعلى اليسار' : 'Top Left'}</option>
                    <option value="top-right">{lang === 'ar' ? 'أعلى اليمين' : 'Top Right'}</option>
                    <option value="bottom-left">{lang === 'ar' ? 'أسفل اليسار' : 'Bottom Left'}</option>
                    <option value="bottom-right">{lang === 'ar' ? 'أسفل اليمين' : 'Bottom Right'}</option>
                    <option value="fullscreen">{lang === 'ar' ? 'ملء الشاشة' : 'Fullscreen'}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-sans text-[12px] font-medium text-zinc-300">
                    {t(lang, 'sequence.imageAnimation')}
                  </label>
                  <select
                    value={imageAnimation}
                    onChange={(e) => setImageAnimation(e.target.value as any)}
                    className="h-9 rounded-md border border-white/15 bg-[#11131a] px-3 font-sans text-[12.5px] text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="bounce">{lang === 'ar' ? 'قفز / ارتداد (Bounce)' : 'Bounce'}</option>
                    <option value="zoom">{lang === 'ar' ? 'تكبير (Zoom In)' : 'Zoom In'}</option>
                    <option value="fade">{lang === 'ar' ? 'تلاشي تدريجي (Fade In)' : 'Fade In'}</option>
                    <option value="slide-up">{lang === 'ar' ? 'انزلاق من الأسفل (Slide Up)' : 'Slide Up'}</option>
                    <option value="slide-down">{lang === 'ar' ? 'انزلاق من الأعلى (Slide Down)' : 'Slide Down'}</option>
                    <option value="none">{lang === 'ar' ? 'بدون تأثير (None)' : 'None'}</option>
                  </select>
                </div>
              </div>

              {/* Sliders: Duration and Scale */}
              <div className="grid grid-cols-2 gap-3">
                <DurationPicker
                  value={imageDurationSeconds}
                  onChange={setImageDurationSeconds}
                  min={1}
                  max={60}
                  step={1}
                  presets={[3, 5, 8, 10, 15]}
                  label={t(lang, 'sequence.imageDuration')}
                  accentColor="purple"
                />

                <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] font-medium text-zinc-300">
                      {t(lang, 'sequence.imageScale')}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400">{imageScale.toFixed(1)}x</span>
                  </div>
                  <Slider
                    value={Math.round(imageScale * 10)}
                    min={2}
                    max={30}
                    step={1}
                    onChange={(v) => setImageScale(v / 10)}
                    ariaLabel={t(lang, 'sequence.imageScale')}
                  />
                </div>
              </div>

              {/* OBS Image Browser Source URL Banner */}
              <div className="flex flex-col gap-2 rounded-md border border-purple-500/30 bg-purple-500/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-purple-200">
                    <Radio size={14} className="text-purple-400" />
                    <span>{t(lang, 'sequence.obsImageBrowserSource')}</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                    1920 × 1080 px
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/90 leading-relaxed">
                  {t(lang, 'sequence.obsImageBrowserSourceHint')}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value="http://127.0.0.1:49178/image-overlay.html"
                    className="h-8 flex-1 rounded border border-purple-500/30 bg-black/40 px-2.5 font-mono text-[11.5px] text-purple-100 select-all focus:border-purple-400 focus:outline-none"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleCopyImageOverlayUrl()}
                    className="h-8 gap-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white font-medium text-[11px] shrink-0 border-none cursor-pointer"
                  >
                    {copiedImageUrl ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                    <span>{copiedImageUrl ? t(lang, 'votes.copied') : t(lang, 'chat.copyUrl')}</span>
                  </Button>
                  <a
                    href="http://127.0.0.1:49178/image-overlay.html"
                    target="_blank"
                    rel="noreferrer"
                    className="grid size-8 place-items-center rounded border border-purple-500/30 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 hover:text-white transition-colors shrink-0"
                    title={t(lang, 'chat.openBrowser')}
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              {/* Test Button */}
              <div className="flex items-center justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleTestImage()}
                  disabled={isPreviewingImage || !imagePath.trim()}
                  className="gap-1.5 text-pink-400 hover:text-pink-300 border-pink-500/30 bg-pink-500/10 hover:bg-pink-500/20"
                >
                  <ImageIcon size={13} className={isPreviewingImage ? 'animate-bounce' : ''} />
                  <span>{isPreviewingImage ? t(lang, 'sequence.previewingImage') : t(lang, 'sequence.testImage')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* MINI-GAME DUEL */}
          {step.type === 'duel' && (
            <div className="flex flex-col gap-3.5">
              {/* Mode Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.duelMode')}
                </label>
                <SegmentedControl<'random' | 'ai_trivia'>
                  value={duelMode}
                  onChange={setDuelMode}
                  options={[
                    { value: 'random', label: t(lang, 'sequence.duelModeRandom') },
                    { value: 'ai_trivia', label: t(lang, 'sequence.duelModeAiTrivia') },
                  ]}
                />
              </div>

              {/* Win Probability Slider (Random Mode) */}
              {duelMode === 'random' && (
                <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] font-medium text-zinc-300">
                      {t(lang, 'sequence.duelWinChance')}
                    </span>
                    <span className="font-mono text-[11px] text-amber-400 font-semibold">
                      {t(lang, 'sequence.duelChallengerOdds', {
                        n: duelChallengerWinChance,
                        opp: 100 - duelChallengerWinChance,
                      })}
                    </span>
                  </div>
                  <Slider
                    value={duelChallengerWinChance}
                    min={1}
                    max={99}
                    step={1}
                    onChange={(v) => setDuelChallengerWinChance(v)}
                    ariaLabel={t(lang, 'sequence.duelWinChance')}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10.5px] text-muted">
                      {t(lang, 'sequence.duelWinChanceHint')}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {[25, 50, 75].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDuelChallengerWinChance(pct)}
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors cursor-pointer ${
                            duelChallengerWinChance === pct
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-white/5 text-muted hover:text-white border border-white/10'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Target Opponent */}
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.duelOpponent')}
                </label>
                <Input
                  value={duelOpponent}
                  onChange={(e) => setDuelOpponent(e.target.value)}
                  placeholder="{input}"
                  className="h-9 font-mono text-[12.5px]"
                />
                <p className="text-[11px] text-muted">
                  {t(lang, 'sequence.duelOpponentHint')}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                  {['{input}', '{target}', '{raider}'].map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setDuelOpponent(tok)}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-accent-text hover:border-accent hover:bg-accent/10 transition-colors cursor-pointer"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              </div>

              {/* Broadcaster Duel & Streamer Mute Option */}
              <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
                <div className="flex items-center justify-between">
                  <div className="pe-3">
                    <span className="font-sans text-[12.5px] font-medium text-zinc-200">
                      {t(lang, 'sequence.duelAllowBroadcaster')}
                    </span>
                    <p className="text-[10.5px] text-muted mt-0.5">
                      {t(lang, 'sequence.duelAllowBroadcasterHint')}
                    </p>
                  </div>
                  <Switch
                    checked={duelAllowBroadcaster}
                    onChange={setDuelAllowBroadcaster}
                    label={t(lang, 'sequence.duelAllowBroadcaster')}
                  />
                </div>

                {duelAllowBroadcaster && (
                  <div className="mt-2 flex flex-col gap-2.5 border-t border-white/[0.06] pt-2.5">
                    {!obsConnected ? (
                      <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                        <div className="flex items-start gap-2">
                          <Info size={13} className="mt-0.5 shrink-0 text-amber-400" />
                          <span>{t(lang, 'sequence.obsDisconnectedNotice')}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleQuickConnectObs()}
                            disabled={isConnectingObs}
                            className="h-6 gap-1.5 px-2 text-[10.5px] font-medium bg-amber-500 hover:bg-amber-400 text-black border-none"
                          >
                            {isConnectingObs ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : (
                              <Zap size={10} />
                            )}
                            <span>{t(lang, 'sequence.autoDetectAndConnect')}</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={handleOpenObsSettings}
                            className="h-6 gap-1 px-1.5 text-[10.5px] text-amber-300 hover:text-white hover:bg-amber-500/20"
                          >
                            <Sliders size={10} />
                            <span>{t(lang, 'sequence.openObsSettings')}</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] text-emerald-300">
                        <div className="flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{t(lang, 'sequence.obsConnectedStatus', { n: availableObsAudioSources.length })}</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleOpenObsSettings}
                          className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                        >
                          {t(lang, 'sequence.openObsSettings')}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className="font-sans text-[11.5px] font-medium text-zinc-300">
                        {t(lang, 'sequence.duelBroadcasterMuteSource')}
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void fetchObsAudioSources()}
                        disabled={isLoadingObsSources}
                        className="h-5 gap-1 px-1.5 text-[10.5px] text-zinc-300 hover:text-white"
                        title={t(lang, 'sequence.refreshSources')}
                      >
                        <RefreshCw size={10} className={isLoadingObsSources ? 'animate-spin' : ''} />
                        <span>{t(lang, 'sequence.refreshSources')}</span>
                      </Button>
                    </div>

                    <select
                      value={duelBroadcasterMuteSource}
                      onChange={(e) => setDuelBroadcasterMuteSource(e.target.value)}
                      className="h-8.5 rounded-md border border-white/15 bg-[#0e1017] px-2.5 font-sans text-[12px] text-foreground focus:border-accent focus:outline-none"
                    >
                      <option value="">{t(lang, 'sequence.obsDefaultMic')}</option>
                      {availableObsAudioSources.map((source) => (
                        <option key={source.name} value={source.name}>
                          {source.name} ({source.kind}) {source.muted ? '🔇' : '🔊'}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted">
                      {t(lang, 'sequence.duelBroadcasterMuteSourceHint')}
                    </p>
                  </div>
                )}
              </div>

              {/* Timeout Duration */}
              <DurationPicker
                value={duelTimeoutDuration}
                onChange={setDuelTimeoutDuration}
                min={5}
                max={600}
                step={5}
                presets={[15, 30, 60, 120, 300]}
                label={t(lang, 'sequence.duelTimeoutDuration')}
                accentColor="amber"
              />

              {/* AI Trivia Specific Settings */}
              {duelMode === 'ai_trivia' && (
                <div className="flex flex-col gap-3 rounded-md border border-white/[0.08] bg-[#12151e] p-3.5 animate-in fade-in duration-100">
                  {/* Language Selector */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Languages size={13} className="text-sky-400" />
                      <label className="font-sans text-[12px] font-medium text-zinc-300">
                        {t(lang, 'sequence.duelLanguage')}
                      </label>
                    </div>
                    <SegmentedControl<'auto' | 'en' | 'ar'>
                      value={duelLanguage}
                      onChange={setDuelLanguage}
                      options={[
                        { value: 'auto', label: t(lang, 'sequence.duelLanguageAuto') },
                        { value: 'en', label: t(lang, 'sequence.duelLanguageEn') },
                        { value: 'ar', label: t(lang, 'sequence.duelLanguageAr') },
                      ]}
                    />
                  </div>

                  {/* Trivia Question Countdown Timer */}
                  <DurationPicker
                    value={duelTimerSeconds}
                    onChange={setDuelTimerSeconds}
                    min={5}
                    max={90}
                    step={5}
                    presets={[10, 15, 20, 30, 45, 60]}
                    label={t(lang, 'sequence.duelTimerSeconds')}
                    accentColor="sky"
                  />

                  {/* Preset Ideas / Categories Chips */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Gamepad2 size={13} className="text-amber-400" />
                        <label className="font-sans text-[12px] font-medium text-zinc-300">
                          {t(lang, 'sequence.duelCategory')}
                        </label>
                      </div>
                      <span className="font-mono text-[10.5px] text-muted">
                        {duelCategory || 'general'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'general', label: t(lang, 'sequence.duelCategoryGeneral'), emoji: '🎮' },
                        { id: 'souls', label: t(lang, 'sequence.duelCategorySouls'), emoji: '⚔️' },
                        { id: 'monster_hunter', label: t(lang, 'sequence.duelCategoryMonsterHunter'), emoji: '🐉' },
                        { id: 'zelda', label: t(lang, 'sequence.duelCategoryZelda'), emoji: '🗡️' },
                        { id: 'esports', label: t(lang, 'sequence.duelCategoryEsports'), emoji: '🎯' },
                        { id: 'rpg', label: t(lang, 'sequence.duelCategoryRpg'), emoji: '🧙‍♂️' },
                      ].map((cat) => {
                        const isSelected = duelCategory.toLowerCase() === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setDuelCategory(cat.id)}
                            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer border ${
                              isSelected
                                ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Topic Input */}
                    <Input
                      value={duelCategory}
                      onChange={(e) => setDuelCategory(e.target.value)}
                      placeholder={t(lang, 'sequence.duelCategoryCustom')}
                      className="h-8 text-[12px] font-mono mt-0.5"
                    />
                  </div>

                  {/* Custom AI Instructions */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-purple-400" />
                        <label className="font-sans text-[12px] font-medium text-zinc-300">
                          {t(lang, 'sequence.duelInstructions')}
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDuelInstructions(defaultDuelInstructions)}
                        className="flex items-center gap-1 text-[10.5px] text-muted hover:text-accent transition-colors cursor-pointer"
                        title={t(lang, 'sequence.duelResetInstructions')}
                      >
                        <RotateCcw size={11} />
                        <span>{t(lang, 'sequence.duelResetInstructions')}</span>
                      </button>
                    </div>
                    <textarea
                      value={duelInstructions}
                      onChange={(e) => setDuelInstructions(e.target.value)}
                      placeholder={defaultDuelInstructions}
                      rows={3}
                      className="w-full rounded-md border border-white/15 bg-[#0e1017] p-2.5 font-sans text-[12px] text-foreground focus:border-accent focus:outline-none resize-y"
                    />
                    <p className="text-[10.5px] text-muted">
                      {t(lang, 'sequence.duelInstructionsHint')}
                    </p>
                  </div>
                </div>
              )}

              {/* Customizable Message Templates Accordion */}
              <div className="flex flex-col rounded-md border border-white/[0.08] bg-[#12151e] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDuelMessages(!showAdvancedDuelMessages)}
                  className="flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.04] transition-colors cursor-pointer text-start"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-teal-400 shrink-0" />
                    <div>
                      <div className="text-[12px] font-medium text-zinc-200">
                        {t(lang, 'sequence.duelCustomMessages')}
                      </div>
                      <div className="text-[10.5px] text-muted">
                        {t(lang, 'sequence.duelCustomMessagesHint')}
                      </div>
                    </div>
                  </div>
                  {showAdvancedDuelMessages ? (
                    <ChevronUp size={14} className="text-muted shrink-0" />
                  ) : (
                    <ChevronDown size={14} className="text-muted shrink-0" />
                  )}
                </button>

                {showAdvancedDuelMessages && (
                  <div className="flex flex-col gap-3 p-3.5 border-t border-white/[0.06] bg-[#0f1118] animate-in fade-in duration-100">
                    {/* Available tokens chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pb-1">
                      <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.tokensAvailable')}:</span>
                      {(duelMode === 'ai_trivia'
                        ? ['{challenger}', '{opponent}', '{winner}', '{loser}', '{question}', '{answer}', '{timer}', '{duration}']
                        : ['{challenger}', '{opponent}', '{winner}', '{loser}', '{duration}']
                      ).map((tok) => (
                        <button
                          key={tok}
                          type="button"
                          onClick={() => {
                            insertToken(tok, setDuelMessageStart);
                          }}
                          className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] text-teal-300 hover:border-teal-400 hover:bg-teal-500/10 transition-colors cursor-pointer"
                        >
                          {tok}
                        </button>
                      ))}
                    </div>

                    {/* Start Announcement */}
                    <div className="flex flex-col gap-1">
                      <label className="font-sans text-[11.5px] font-medium text-zinc-300">
                        {t(lang, 'sequence.duelMsgStart')}
                      </label>
                      <Input
                        value={duelMessageStart}
                        onChange={(e) => setDuelMessageStart(e.target.value)}
                        placeholder={
                          duelMode === 'ai_trivia'
                            ? DEFAULT_DUEL_MESSAGES.triviaStart
                            : DEFAULT_DUEL_MESSAGES.randomStart
                        }
                        className="h-8.5 font-mono text-[11.5px]"
                      />
                    </div>

                    {/* Win Announcement */}
                    <div className="flex flex-col gap-1">
                      <label className="font-sans text-[11.5px] font-medium text-zinc-300">
                        {t(lang, 'sequence.duelMsgWin')}
                      </label>
                      <Input
                        value={duelMessageWin}
                        onChange={(e) => setDuelMessageWin(e.target.value)}
                        placeholder={
                          duelMode === 'ai_trivia'
                            ? DEFAULT_DUEL_MESSAGES.triviaWin
                            : DEFAULT_DUEL_MESSAGES.randomWin
                        }
                        className="h-8.5 font-mono text-[11.5px]"
                      />
                    </div>

                    {/* Timeout Announcement (AI Trivia only) */}
                    {duelMode === 'ai_trivia' && (
                      <div className="flex flex-col gap-1">
                        <label className="font-sans text-[11.5px] font-medium text-zinc-300">
                          {t(lang, 'sequence.duelMsgTimeout')}
                        </label>
                        <Input
                          value={duelMessageTimeout}
                          onChange={(e) => setDuelMessageTimeout(e.target.value)}
                          placeholder={DEFAULT_DUEL_MESSAGES.triviaTimeout}
                          className="h-8.5 font-mono text-[11.5px]"
                        />
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDuelMessageStart('');
                          setDuelMessageWin('');
                          setDuelMessageTimeout('');
                        }}
                        className="flex items-center gap-1 text-[11px] text-muted hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={11} />
                        <span>{t(lang, 'sequence.duelResetMessages')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Explanation Banner */}
              <div className="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[11.5px] text-amber-200">
                <Swords size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="space-y-1">
                  <div className="font-semibold text-white">
                    {duelMode === 'random' ? t(lang, 'sequence.duelModeRandom') : t(lang, 'sequence.duelModeAiTrivia')}
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">
                    {t(lang, 'sequence.duelExplanation')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-white/[0.08] bg-[#12141c] px-5 py-3">
          <Button size="sm" onClick={handleApply} className="bg-accent text-white hover:bg-accent-hover font-semibold">
            <Check size={13} className="me-1.5" />
            <span>{t(lang, 'autoReplies.done')}</span>
          </Button>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Studio View
// ---------------------------------------------------------------------------
export function SequenceStudioView({ sequence, onBack, lang }: SequenceStudioViewProps) {
  const update = useSequenceStore((s) => s.update);
  const addTrigger = useSequenceStore((s) => s.addTrigger);
  const updateTrigger = useSequenceStore((s) => s.updateTrigger);
  const removeTrigger = useSequenceStore((s) => s.removeTrigger);
  const addStep = useSequenceStore((s) => s.addStep);
  const updateStep = useSequenceStore((s) => s.updateStep);
  const removeStep = useSequenceStore((s) => s.removeStep);
  const moveStep = useSequenceStore((s) => s.moveStep);
  const reorderSteps = useSequenceStore((s) => s.reorderSteps);
  const runSequence = useSequenceStore((s) => s.runSequence);
  const availableRewards = useSequenceStore((s) => s.availableRewards);
  const fetchAvailableRewards = useSequenceStore((s) => s.fetchAvailableRewards);
  const isLoadingRewards = useSequenceStore((s) => s.isLoadingRewards);
  const activeRunningSequenceId = useSequenceStore((s) => s.activeRunningSequenceId);
  const activeRunningStepIndex = useSequenceStore((s) => s.activeRunningStepIndex);

  const counters = useCounterStore((s) => s.counters);
  const botAccountEnabled = useConnectionStore((s) => s.botAccountEnabled);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const preferredChatSender = useSettingsStore((s) => s.preferredChatSender);
  const setPreferredChatSender = useSettingsStore((s) => s.setPreferredChatSender);

  // Drag and Drop step reordering
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);

  // Search & Autocomplete
  const [searchTriggerQuery, setSearchTriggerQuery] = useState('');
  const [showTriggerSearchDropdown, setShowTriggerSearchDropdown] = useState(false);
  const [searchSubActionQuery, setSearchSubActionQuery] = useState('');
  const [showSubActionSearchDropdown, setShowSubActionSearchDropdown] = useState(false);

  // Modals
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // Menus
  const [showAddTriggerMenu, setShowAddTriggerMenu] = useState(false);
  const [showAddActionMenu, setShowAddActionMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [showSimDrawer, setShowSimDrawer] = useState(false);

  // Test / Simulation
  const [simMode, setSimMode] = useState<'raid' | 'follow' | 'watch_streak' | 'chat' | 'points'>('raid');
  const [simRaider, setSimRaider] = useState('EpicRaider');
  const [simFollower, setSimFollower] = useState('NewFollower');
  const [simStreakUser, setSimStreakUser] = useState('LoyalViewer');
  const [simStreak, setSimStreak] = useState(3);
  const [simViewers, setSimViewers] = useState(25);
  const [testUser, setTestUser] = useState('StreamViewer');
  const [testTarget, setTestTarget] = useState('');
  const [testStatus, setTestStatus] = useState<{
    status: 'success' | 'error' | 'running';
    message: string;
  } | null>(null);

  const triggerSearchRef = useRef<HTMLDivElement>(null);
  const subActionSearchRef = useRef<HTMLDivElement>(null);

  const isExecuting = activeRunningSequenceId === sequence.id;

  const triggers: ActionTrigger[] =
    Array.isArray(sequence.triggers)
      ? sequence.triggers
      : normalizeTriggers(sequence);

  useEffect(() => {
    void fetchAvailableRewards();
  }, [fetchAvailableRewards]);

  // Global escape & click-outside handling
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setContextMenu(null);
      if (triggerSearchRef.current && !triggerSearchRef.current.contains(e.target as Node)) {
        setShowTriggerSearchDropdown(false);
      }
      if (subActionSearchRef.current && !subActionSearchRef.current.contains(e.target as Node)) {
        setShowSubActionSearchDropdown(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) setContextMenu(null);
        else if (showTriggerSearchDropdown) setShowTriggerSearchDropdown(false);
        else if (showSubActionSearchDropdown) setShowSubActionSearchDropdown(false);
        else if (showAddTriggerMenu) setShowAddTriggerMenu(false);
        else if (showAddActionMenu) setShowAddActionMenu(false);
        else if (showPresetsMenu) setShowPresetsMenu(false);
        else if (editingTriggerId) setEditingTriggerId(null);
        else if (editingStepId) setEditingStepId(null);
        else onBack();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    contextMenu,
    showTriggerSearchDropdown,
    showSubActionSearchDropdown,
    showAddTriggerMenu,
    showAddActionMenu,
    showPresetsMenu,
    editingTriggerId,
    editingStepId,
    onBack,
  ]);

  const handleRunTest = async () => {
    if (isExecuting) return;

    let username = testUser.trim() || 'StreamViewer';
    let formattedInput = '';
    let raider = '';
    let viewers = 0;
    let streak = 0;
    let source: 'raid' | 'follow' | 'watch_streak' | 'chat' | 'channel_points' | 'test' = 'test';

    if (simMode === 'follow') {
      const follower = simFollower.trim().replace(/^@+/, '') || 'NewFollower';
      username = follower;
      source = 'follow';
    } else if (simMode === 'watch_streak') {
      const streakUser = simStreakUser.trim().replace(/^@+/, '') || 'LoyalViewer';
      username = streakUser;
      streak = Math.max(1, Number(simStreak) || 1);
      formattedInput = `Stream #${streak}!`;
      source = 'watch_streak';
    } else if (simMode === 'raid') {
      raider = simRaider.trim().replace(/^@+/, '') || 'EpicRaider';
      username = raider;
      viewers = Math.max(1, Number(simViewers) || 1);
      formattedInput = `@${raider}`;
      source = 'raid';
    } else if (simMode === 'chat') {
      const rawTarget = testTarget.trim();
      formattedInput = rawTarget ? (rawTarget.startsWith('@') ? rawTarget : `@${rawTarget}`) : '';
      source = 'chat';
    } else {
      formattedInput = testTarget.trim();
      source = 'channel_points';
    }

    setTestStatus({
      status: 'running',
      message: t(lang, 'sequence.running'),
    });

    const res = await runSequence(sequence.id, {
      username,
      userInput: formattedInput,
      source,
      raider,
      viewers,
      streak,
    });

    if (res) {
      setTestStatus({
        status: 'success',
        message:
          simMode === 'follow'
            ? lang === 'ar'
              ? `✓ تمت محاكاة متابعة @${simFollower.trim() || 'NewFollower'} بنجاح!`
              : `✓ Simulated follow from @${simFollower.trim() || 'NewFollower'} executed successfully!`
            : simMode === 'watch_streak'
            ? lang === 'ar'
              ? `✓ تمت محاكاة ستريك @${simStreakUser.trim() || 'LoyalViewer'} (${streak} بثوث متتالية) بنجاح!`
              : `✓ Simulated watch streak from @${simStreakUser.trim() || 'LoyalViewer'} (${streak} streams) executed successfully!`
            : simMode === 'raid'
            ? lang === 'ar'
              ? `✓ تمت محاكاة ريد @${raider} مع ${viewers} مشاهد بنجاح!`
              : `✓ Simulated raid from @${raider} with ${viewers} viewers executed successfully!`
            : formattedInput
            ? lang === 'ar'
              ? `✓ تم تنفيذ المتسلسلة بنجاح على ${formattedInput}`
              : `✓ Sequence executed successfully on ${formattedInput}!`
            : lang === 'ar'
            ? '✓ تم تنفيذ جميع الخطوات بنجاح'
            : '✓ Sequence executed successfully!',
      });
    } else {
      setTestStatus({
        status: 'error',
        message: lang === 'ar' ? 'فشل تنفيذ المتسلسلة' : 'Sequence execution failed',
      });
    }
  };

  const handleAppendRaidPreset = () => {
    update(sequence.id, {
      steps: [
        ...sequence.steps,
        {
          id: crypto.randomUUID(),
          type: 'moderation',
          moderationAction: 'shoutout',
          targetUser: '{raider}',
        },
        {
          id: crypto.randomUUID(),
          type: 'wait',
          waitDuration: 1,
          waitUnit: 'seconds',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '🎉 Welcome raiders from @{raider}! Thank you for the raid with {viewers} viewers! Check them out at twitch.tv/{raider} 💜',
        },
      ],
    });
  };

  const handleAppendSmartTimeoutPreset = () => {
    update(sequence.id, {
      steps: [
        ...sequence.steps,
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '🚨 Smart Mod Timeout initiated on @{target} by @{username}!',
        },
        {
          id: crypto.randomUUID(),
          type: 'moderation',
          moderationAction: 'smart_timeout',
          targetUser: '{input}',
          durationSeconds: 60,
          reason: 'Timeout triggered by {username}',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '✅ @{target} has been timed out! (Will be safely re-modded if they are a mod).',
        },
      ],
    });
  };

  const handleAppendTimeoutDuelPreset = () => {
    update(sequence.id, {
      steps: [
        ...sequence.steps,
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '⚔️ @{username} has challenged @{input} to a Timeout Duel!',
        },
        {
          id: crypto.randomUUID(),
          type: 'duel',
          duelMode: 'ai_trivia',
          duelOpponent: '{input}',
          duelTimeoutDuration: 60,
          duelTimerSeconds: 30,
        },
      ],
    });
  };

  const openContextMenu = (
    e: React.MouseEvent,
    type: ContextMenuState['type'],
    targetId?: string,
    targetIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      targetId,
      targetIndex,
    });
  };

  // Helper descriptions
  const getSubActionSummary = (st: SequenceStep) => {
    switch (st.type) {
      case 'comment':
        return `// ${st.commentText || (lang === 'ar' ? 'هذا تعليق!' : 'This is a comment!')}`;
      case 'chat':
        return `${lang === 'ar' ? 'تويتش: إرسال رسالة' : 'Twitch: Send Message'} "${st.chatMessage || ''}"`;
      case 'moderation': {
        const action = st.moderationAction || 'smart_timeout';
        const target = st.targetUser || (action === 'shoutout' ? '{raider}' : '{input}');
        if (action === 'shoutout') return `${lang === 'ar' ? 'تويتش: شوت أوت' : 'Twitch: Shoutout'} ${target}`;
        if (action === 'smart_timeout') return `${lang === 'ar' ? 'تويتش: إسكات ذكي' : 'Twitch: Smart Timeout'} "${target}" (${st.durationSeconds ?? 60}s)`;
        if (action === 'timeout') return `${lang === 'ar' ? 'تويتش: إسكات' : 'Twitch: Timeout'} "${target}" (${st.durationSeconds ?? 60}s)`;
        if (action === 'ban') return `${lang === 'ar' ? 'تويتش: حظر' : 'Twitch: Ban'} "${target}"`;
        if (action === 'clear_chat') return lang === 'ar' ? 'تويتش: مسح الشات' : 'Twitch: Clear Chat';
        return `${lang === 'ar' ? 'تويتش: إجراء إشراف' : 'Twitch: Moderation'} (${action}) -> "${target}"`;
      }
      case 'sound': {
        const fileName = st.soundPath ? st.soundPath.split(/[/\\]/).pop() : (lang === 'ar' ? 'مؤثر صوتي' : 'Sound Effect');
        return `${lang === 'ar' ? 'الصوت: تشغيل' : 'Audio: Play'} "${fileName}" (${Math.round((st.soundVolume ?? 1) * 100)}%)`;
      }
      case 'tts':
        return `TTS: "${st.ttsText || (lang === 'ar' ? 'مرحباً' : 'Hello')}"`;
      case 'obs_text': {
        const fileName = st.filePath ? st.filePath.split(/[/\\]/).pop() : 'file.txt';
        return `${lang === 'ar' ? 'نص OBS: كتابة إلى' : 'OBS Text: ->'} "${fileName}"`;
      }
      case 'obs_image': {
        const fileName = st.imagePath ? st.imagePath.split(/[/\\]/).pop() : 'image.png';
        return `${lang === 'ar' ? 'صورة OBS: عرض' : 'OBS Image: Show'} "${fileName}" (${st.imageDurationSeconds ?? 5}s, ${st.imagePosition ?? 'center'})`;
      }
      case 'duel': {
        const modeLabel = st.duelMode === 'random'
          ? (lang === 'ar' ? 'قرعة 50/50' : 'Random 50/50')
          : (lang === 'ar' ? 'سؤال ألعاب بالذكاء الاصطناعي' : 'AI Gaming Trivia');
        return `${lang === 'ar' ? 'تحدي تايم آوت: ضد' : 'Timeout Duel: vs'} ${st.duelOpponent || '{input}'} (${modeLabel}, ${st.duelTimeoutDuration ?? 60}s)`;
      }
      case 'poll':
        return st.pollAction === 'start'
          ? `${lang === 'ar' ? 'استطلاع: بدء' : 'Poll: Start'} "${st.pollQuestion || ''}"`
          : st.pollAction === 'end'
          ? (lang === 'ar' ? 'استطلاع: إنهاء الاستطلاع النشط' : 'Poll: End Active Poll')
          : (lang === 'ar' ? 'استطلاع: تصفير الاستطلاع' : 'Poll: Reset Poll');
      case 'mic_mute':
        return `${lang === 'ar' ? 'الصوت: كتم مايك الستريمر' : 'Audio: Mute Streamer Mic'} (${st.micMuteDurationSeconds ?? 5}s)`;
      case 'wait':
        return `${lang === 'ar' ? 'النظام: انتظار' : 'Core: Wait'} ${st.waitDuration ?? 2}${st.waitUnit === 'minutes' ? (lang === 'ar' ? 'د' : 'm') : (lang === 'ar' ? 'ث' : 's')}`;
      case 'counter': {
        const matched = counters.find((c) => c.id === st.counterId);
        const name = matched ? matched.name : (lang === 'ar' ? 'عدّاد' : 'Counter');
        return `${lang === 'ar' ? 'العدّادات: تعديل' : 'Counters: Modify'} ${name} (${st.counterAction ?? 'increase'})`;
      }
      case 'command':
        return `${lang === 'ar' ? 'النظام: تشغيل أمر' : 'Core: Run Command'} "${st.commandTrigger || '!sound'}"`;
    }
  };

  // Trigger search items
  const TRIGGER_SEARCH_ITEMS = [
    {
      type: 'twitch_follow' as ActionTriggerType,
      source: lang === 'ar' ? 'تويتش > القناة' : 'Twitch > Channel',
      title: lang === 'ar' ? 'متابعة القناة' : 'Channel Follow',
      desc: lang === 'ar' ? 'يتم التفعيل عندما يتابع مشاهد جديد قناتك' : 'Triggers when a new viewer follows your channel',
      icon: Heart,
      color: 'text-pink-400',
    },
    {
      type: 'twitch_raid' as ActionTriggerType,
      source: lang === 'ar' ? 'تويتش > القناة' : 'Twitch > Channel',
      title: lang === 'ar' ? 'ريد القناة (Raid)' : 'Channel Raid',
      desc: lang === 'ar' ? 'يتم التفعيل عندما يقوم ستريمر آخر بعمل Raid لقناتك' : 'Triggers when another streamer raids your channel',
      icon: Flame,
      color: 'text-orange-400',
    },
    {
      type: 'twitch_chat' as ActionTriggerType,
      source: lang === 'ar' ? 'النظام > الأوامر' : 'Core > Commands',
      title: lang === 'ar' ? 'أمر في الشات' : 'Command Triggered',
      desc: lang === 'ar' ? 'يتم التفعيل عندما يكتب المشاهد أمراً في الشات' : 'Triggers when viewer enters a chat command',
      icon: Terminal,
      color: 'text-sky-400',
    },
    {
      type: 'twitch_channel_points' as ActionTriggerType,
      source: lang === 'ar' ? 'تويتش > نقاط القناة' : 'Twitch > Channel Points',
      title: lang === 'ar' ? 'استبدال مكافأة نقاط القناة' : 'Reward Redemption',
      desc: lang === 'ar' ? 'يتم التفعيل عند استبدال مكافأة مخصصة بنقاط القناة' : 'Triggers when a channel points custom reward is redeemed',
      icon: Coins,
      color: 'text-amber-400',
    },
    {
      type: 'twitch_watch_streak' as ActionTriggerType,
      source: lang === 'ar' ? 'تويتش > القناة' : 'Twitch > Channel',
      title: lang === 'ar' ? 'سلسلة المشاهدة (Watch Streak)' : 'Watch Streak Milestone',
      desc: lang === 'ar' ? 'يتم التفعيل عندما يشارك المشاهد إنجاز استمرار مشاهدة البث المتتالي' : 'Triggers when a viewer shares their consecutive stream watch streak milestone',
      icon: Zap,
      color: 'text-purple-400',
    },
  ];

  const filteredTriggerItems = TRIGGER_SEARCH_ITEMS.filter(
    (item) =>
      item.source.toLowerCase().includes(searchTriggerQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTriggerQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchTriggerQuery.toLowerCase())
  );

  // Sub-action search items
  const SUB_ACTION_SEARCH_ITEMS = [
    {
      id: 'comment',
      type: 'comment' as SequenceStepType,
      title: lang === 'ar' ? '💬 إضافة تعليق / ملاحظة' : '💬 Add Comment / Note',
      desc: lang === 'ar' ? 'خطوة تعليق خضراء لتنظيم وفصل الإجراءات' : 'Visual green comment step for organizing actions',
      icon: MessageSquare,
      color: 'text-emerald-400',
    },
    {
      id: 'sound',
      type: 'sound' as SequenceStepType,
      title: lang === 'ar' ? 'الصوت: تشغيل مؤثر صوتي (SFX)' : 'Audio: Play Sound Effect (SFX)',
      desc: lang === 'ar' ? 'تشغيل ملف صوتي (.mp3, .wav) مع التحكم بمستوى الصوت' : 'Play a local sound file (.mp3, .wav) with volume control',
      icon: Volume2,
      color: 'text-indigo-400',
    },
    {
      id: 'tts',
      type: 'tts' as SequenceStepType,
      title: lang === 'ar' ? 'الكلام: قراءة النص صوتياً (TTS)' : 'Speech: Text-To-Speech (TTS)',
      desc: lang === 'ar' ? 'نطق أي نص تلقائياً مع دعم متغيرات الشات' : 'Synthesize spoken text with dynamic stream tokens',
      icon: Mic,
      color: 'text-teal-400',
    },
    {
      id: 'obs_text',
      type: 'obs_text' as SequenceStepType,
      title: lang === 'ar' ? 'OBS: كتابة إلى ملف نصي' : 'OBS: Write to Text File',
      desc: lang === 'ar' ? 'تحديث ملف نصي محلي ليظهر في مصادر نصوص OBS' : 'Update local text file for OBS text source overlays',
      icon: FileText,
      color: 'text-amber-400',
    },
    {
      id: 'obs_image',
      type: 'obs_image' as SequenceStepType,
      title: lang === 'ar' ? 'OBS: عرض صورة أو GIF على الشاشة' : 'OBS: Display Picture / GIF on Screen',
      desc: lang === 'ar' ? 'عرض صور ميمز أو GIFs أو تنبيهات على بث OBS عبر الأوفرلاي' : 'Show memes, GIFs, or alert pictures on OBS screen via overlay',
      icon: ImageIcon,
      color: 'text-pink-400',
    },
    {
      id: 'duel',
      type: 'duel' as SequenceStepType,
      title: lang === 'ar' ? 'التفاعل: تحدي التايم آوت (المبارزة)' : 'Interactivity: Timeout Duel (Showdown)',
      desc: lang === 'ar' ? 'مبارزة بين مشاهدين: قرعة 50/50 أو سؤال ألعاب بالذكاء الاصطناعي والخاسر يُعاقب بالتايم آوت' : 'Mini-game showdown: 50/50 roulette or AI gaming trivia; loser gets timed out',
      icon: Swords,
      color: 'text-amber-400',
    },
    {
      id: 'poll',
      type: 'poll' as SequenceStepType,
      title: lang === 'ar' ? 'التفاعل: استطلاع وتصويت مباشر' : 'Interactivity: Live Poll',
      desc: lang === 'ar' ? 'بدء، إنهاء، أو تصفير استطلاع وتصويت مباشر على الشاشة' : 'Start, end, or reset a live stream vote/poll',
      icon: BarChart3,
      color: 'text-violet-400',
    },
    {
      id: 'mic_mute',
      type: 'mic_mute' as SequenceStepType,
      title: lang === 'ar' ? 'الصوت: كتم مايك الستريمر لمدة مؤقتة' : 'Audio: Mute Streamer Mic for Duration',
      desc: lang === 'ar' ? 'كتم ميكروفون الويندوز الافتراضي مع إعادة تشغيل تلقائية آمنة' : 'Temporarily mute default microphone with fail-safe auto-unmute',
      icon: MicOff,
      color: 'text-rose-400',
    },
    {
      id: 'chat',
      type: 'chat' as SequenceStepType,
      title: lang === 'ar' ? 'تويتش: إرسال رسالة في الشات' : 'Twitch: Send Chat Message',
      desc: lang === 'ar' ? 'إرسال رسالة مخصصة أو تنبيه في شات تويتش' : 'Post a custom message or alert to Twitch chat',
      icon: MessageSquare,
      color: 'text-sky-400',
    },
    {
      id: 'shoutout',
      type: 'moderation' as SequenceStepType,
      title: lang === 'ar' ? 'تويتش: شوت أوت لقناة الـ Raider' : 'Twitch: Shoutout Raider / Channel',
      desc: lang === 'ar' ? 'إرسال شوت أوت رسمي (/shoutout)' : 'Send an official Twitch shoutout (/shoutout)',
      icon: Megaphone,
      color: 'text-orange-400',
      options: { moderationAction: 'shoutout' as ModerationAction, targetUser: '{raider}' },
    },
    {
      id: 'smart_timeout',
      type: 'moderation' as SequenceStepType,
      title: lang === 'ar' ? 'تويتش: إسكات ذكي (مع دعم المشرفين)' : 'Twitch: Smart Timeout (Mods & Lead Mods)',
      desc: lang === 'ar' ? 'سحب رتبة المشرف مؤقتاً، إسكاته، ثم إعادتها تلقائياً' : 'Temporarily unmods, times out, and automatically re-mods (supports Mods & Lead Mods)',
      icon: Zap,
      color: 'text-amber-400',
      options: { moderationAction: 'smart_timeout' as ModerationAction, targetUser: '{input}', durationSeconds: 60 },
    },
    {
      id: 'timeout',
      type: 'moderation' as SequenceStepType,
      title: lang === 'ar' ? 'تويتش: إسكات عادي (Timeout)' : 'Twitch: Regular Timeout',
      desc: lang === 'ar' ? 'إسكات المشاهد المحدد لعدد ثوانٍ معين' : 'Timeout a target chatter for specified seconds',
      icon: Shield,
      color: 'text-rose-400',
      options: { moderationAction: 'timeout' as ModerationAction, targetUser: '{input}', durationSeconds: 60 },
    },
    {
      id: 'clear_chat',
      type: 'moderation' as SequenceStepType,
      title: lang === 'ar' ? 'تويتش: مسح الشات بالكامل' : 'Twitch: Clear Chat',
      desc: lang === 'ar' ? 'مسح كل الرسائل في شات تويتش' : 'Clear the entire Twitch chat room',
      icon: Shield,
      color: 'text-rose-400',
      options: { moderationAction: 'clear_chat' as ModerationAction },
    },
    {
      id: 'wait',
      type: 'wait' as SequenceStepType,
      title: lang === 'ar' ? 'النظام: انتظار / تأخير زمني' : 'Core: Delay / Wait',
      desc: lang === 'ar' ? 'إيقاف التنفيذ مؤقتاً لعدد ثوانٍ أو دقائق' : 'Pause execution for specified seconds or minutes',
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      id: 'counter',
      type: 'counter' as SequenceStepType,
      title: lang === 'ar' ? 'العدّادات: تعديل قيمة عدّاد' : 'Counters: Modify Counter',
      desc: lang === 'ar' ? 'زيادة، إنقاص، أو تصفير قيمة عدّاد' : 'Increment, decrement, or reset a stream counter',
      icon: Calculator,
      color: 'text-emerald-400',
    },
    {
      id: 'command',
      type: 'command' as SequenceStepType,
      title: lang === 'ar' ? 'النظام: تشغيل أمر فرعي' : 'Core: Run Sub-Command',
      desc: lang === 'ar' ? 'تشغيل أمر أو تسلسل آخر' : 'Trigger another command or sequence',
      icon: Terminal,
      color: 'text-violet-400',
    },
  ];

  const filteredSubActionItems = SUB_ACTION_SEARCH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(searchSubActionQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchSubActionQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0d0f14] font-sans text-foreground">
      {/* Top Header Toolbar */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[#202430] bg-[#12151e]/95 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={onBack} title={t(lang, 'sequence.back')}>
            <ArrowLeft size={13} className="me-1" />
            <span>{t(lang, 'sequence.back')}</span>
          </Button>

          <div className="h-4 w-px bg-rule" />

          <div className="flex items-center gap-2">
            <Layers size={16} className="text-accent" />
            <Input
              value={sequence.name}
              onChange={(e) => update(sequence.id, { name: e.target.value })}
              className="h-7 w-60 font-semibold text-[13px] bg-[#171b26] border-white/10"
              placeholder={t(lang, 'sequence.namePlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Presets dropdown */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPresetsMenu(!showPresetsMenu)}
              className="border-white/10 bg-[#171b26] text-zinc-300 hover:text-white"
            >
              <Sparkles size={12} className="me-1.5 text-amber-400" />
              <span>{t(lang, 'sequence.presets')}</span>
              <ChevronDown size={11} className="ms-1 opacity-70" />
            </Button>

            {showPresetsMenu && (
              <div className="absolute end-0 top-full z-30 mt-1 w-64 rounded-md border border-[#2c3244] bg-[#161a26] p-1.5 shadow-2xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-start text-[12px] hover:bg-white/[0.06] transition-colors"
                  onClick={() => {
                    handleAppendRaidPreset();
                    setShowPresetsMenu(false);
                  }}
                >
                  <Flame size={14} className="text-orange-400 shrink-0" />
                  <div>
                    <div className="font-medium text-white">{t(lang, 'sequence.presetRaidWelcome')}</div>
                    <div className="text-[10px] text-muted">{t(lang, 'sequence.presetRaidWelcomeDesc')}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-start text-[12px] hover:bg-white/[0.06] transition-colors"
                  onClick={() => {
                    handleAppendSmartTimeoutPreset();
                    setShowPresetsMenu(false);
                  }}
                >
                  <Zap size={14} className="text-amber-400 shrink-0" />
                  <div>
                    <div className="font-medium text-white">{t(lang, 'sequence.presetSmartTimeout')}</div>
                    <div className="text-[10px] text-muted">{t(lang, 'sequence.presetSmartTimeoutDesc')}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-start text-[12px] hover:bg-white/[0.06] transition-colors"
                  onClick={() => {
                    handleAppendTimeoutDuelPreset();
                    setShowPresetsMenu(false);
                  }}
                >
                  <Swords size={14} className="text-amber-400 shrink-0" />
                  <div>
                    <div className="font-medium text-white">{t(lang, 'sequence.presetTimeoutDuel')}</div>
                    <div className="text-[10px] text-muted">{t(lang, 'sequence.presetTimeoutDuelDesc')}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Simulator Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSimDrawer(!showSimDrawer)}
            className={`border-white/10 bg-[#171b26] ${showSimDrawer ? 'text-emerald-400 border-emerald-500/40' : 'text-zinc-300'}`}
          >
            <Sliders size={12} className="me-1.5" />
            <span>{t(lang, 'sequence.simulator')}</span>
          </Button>

          {/* Enabled Switch */}
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#171b26] border border-white/10">
            <Switch
              checked={sequence.enabled}
              onChange={(checked) => update(sequence.id, { enabled: checked })}
              label={t(lang, 'sequence.enabled')}
            />
            <span className={`font-mono text-[11px] font-semibold ${sequence.enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {sequence.enabled ? t(lang, 'sequence.yes') : t(lang, 'sequence.no')}
            </span>
          </div>

          <div className="h-4 w-px bg-rule" />

          {/* Run test button */}
          <Button
            size="sm"
            onClick={() => void handleRunTest()}
            disabled={isExecuting || !sequence.enabled}
            className="border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
          >
            {isExecuting ? (
              <>
                <RefreshCw size={12} className="animate-spin me-1.5" />
                <span>{t(lang, 'sequence.running')}</span>
              </>
            ) : (
              <>
                <Play size={12} className="fill-current me-1.5" />
                <span>{t(lang, 'sequence.runTest')}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Simulator Card (Collapsible) */}
      {showSimDrawer && (
        <section className="border-b border-[#202430] bg-[#12151e] p-4 animate-in slide-in-from-top-2 duration-150">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2">
                <Play size={14} className="text-emerald-400" />
                <h3 className="font-semibold text-[13px] text-white">{t(lang, 'sequence.testBarTitle')}</h3>
              </div>

              {/* Sender Account Switch & Debug Bot Button */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted">
                  {t(lang, 'sequence.sender')}:
                </span>
                {botAccountEnabled && botConnected ? (
                  <SegmentedControl<'bot' | 'broadcaster'>
                    value={preferredChatSender}
                    onChange={(val) => setPreferredChatSender(val)}
                    options={[
                      {
                        value: 'bot',
                        label: `@${botLogin || 'Bot'} (Bot)`,
                      },
                      {
                        value: 'broadcaster',
                        label: `@${twitchChannel || 'Host'} (Host)`,
                      },
                    ]}
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-zinc-300">
                      @{twitchChannel || 'Broadcaster'} (Host)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rpc.invoke(Channels.TwitchBotSimulate).catch(() => undefined)}
                      className="h-6 gap-1 px-2 text-[10.5px] border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                      title="Enable example bot to test account switching"
                    >
                      <Sparkles size={11} className="text-amber-400" />
                      <span>{t(lang, 'sequence.debugBot')}</span>
                    </Button>
                  </div>
                )}
              </div>

              <SegmentedControl<'raid' | 'follow' | 'watch_streak' | 'chat' | 'points'>
                value={simMode}
                onChange={setSimMode}
                options={[
                  { value: 'raid', label: `🔥 ${t(lang, 'sequence.simRaid')}` },
                  { value: 'follow', label: `💖 ${t(lang, 'sequence.triggerFollow')}` },
                  { value: 'watch_streak', label: `⚡ ${t(lang, 'sequence.simWatchStreak')}` },
                  { value: 'chat', label: `💬 ${t(lang, 'sequence.simChat')}` },
                  { value: 'points', label: `🪙 ${t(lang, 'sequence.simPoints')}` },
                ]}
              />
            </div>

            <div className="mt-3">
              {simMode === 'follow' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-9 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.triggerFollow')}</label>
                    <div className="relative">
                      <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">@</span>
                      <Input
                        value={simFollower}
                        onChange={(e) => setSimFollower(e.target.value)}
                        placeholder="NewFollower"
                        className="h-8 ps-6 font-mono text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      onClick={() => void handleRunTest()}
                      disabled={isExecuting || !sequence.enabled}
                      className="w-full h-8 border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                    >
                      <Play size={12} className="fill-current me-1.5" />
                      <span>{t(lang, 'sequence.runTest')}</span>
                    </Button>
                  </div>
                </div>
              ) : simMode === 'watch_streak' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simWatchStreak')}</label>
                    <div className="relative">
                      <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">@</span>
                      <Input
                        value={simStreakUser}
                        onChange={(e) => setSimStreakUser(e.target.value)}
                        placeholder="LoyalViewer"
                        className="h-8 ps-6 font-mono text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simStreakCount')}</label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      value={simStreak}
                      onChange={(e) => setSimStreak(Math.max(1, Number(e.target.value)))}
                      className="h-8 font-mono text-[12px] text-center"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      onClick={() => void handleRunTest()}
                      disabled={isExecuting || !sequence.enabled}
                      className="w-full h-8 border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                    >
                      <Play size={12} className="fill-current me-1.5" />
                      <span>{t(lang, 'sequence.runTest')}</span>
                    </Button>
                  </div>
                </div>
              ) : simMode === 'raid' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-6 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simRaider')}</label>
                    <div className="relative">
                      <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">@</span>
                      <Input
                        value={simRaider}
                        onChange={(e) => setSimRaider(e.target.value)}
                        placeholder="EpicRaider"
                        className="h-8 ps-6 font-mono text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simViewers')}</label>
                    <Input
                      type="number"
                      min={1}
                      max={100000}
                      value={simViewers}
                      onChange={(e) => setSimViewers(Math.max(1, Number(e.target.value)))}
                      className="h-8 font-mono text-[12px] text-center"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      onClick={() => void handleRunTest()}
                      disabled={isExecuting || !sequence.enabled}
                      className="w-full h-8 border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                    >
                      <Play size={12} className="fill-current me-1.5" />
                      <span>{t(lang, 'sequence.runTest')}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 items-end">
                  <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simulatedChatter')}</label>
                    <Input
                      value={testUser}
                      onChange={(e) => setTestUser(e.target.value)}
                      placeholder="StreamViewer"
                      className="h-8 font-sans text-[12px]"
                    />
                  </div>

                  <div className="sm:col-span-5 flex flex-col gap-1">
                    <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simulatedTarget')}</label>
                    <div className="relative">
                      <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">@</span>
                      <Input
                        value={testTarget}
                        onChange={(e) => setTestTarget(e.target.value)}
                        placeholder={t(lang, 'sequence.testTargetPlaceholder')}
                        className="h-8 ps-6 font-mono text-[12px]"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <Button
                      size="sm"
                      onClick={() => void handleRunTest()}
                      disabled={isExecuting || !sequence.enabled}
                      className="w-full h-8 border border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                    >
                      <Play size={12} className="fill-current me-1.5" />
                      <span>{t(lang, 'sequence.runTest')}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {testStatus && (
              <div
                className={`mt-3 flex items-center justify-between rounded-md border p-2 text-[12px] font-mono ${
                  testStatus.status === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : testStatus.status === 'error'
                    ? 'border-red-500/30 bg-red-500/10 text-red-400'
                    : 'border-accent/30 bg-accent/10 text-accent-text'
                }`}
              >
                <span>{testStatus.message}</span>
                <button
                  type="button"
                  onClick={() => setTestStatus(null)}
                  className="text-[11px] text-muted hover:text-white px-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Studio Body: Streamer.bot 2-Panel Layout */}
      <div className="flex-1 p-5">
        <div className="mx-auto grid h-full max-w-7xl grid-cols-1 lg:grid-cols-2 gap-5">
          {/* PANEL 1: TRIGGERS */}
          <section
            className="flex flex-col rounded-lg border border-[#242838] bg-[#131620] shadow-md overflow-hidden"
            onContextMenu={(e) => openContextMenu(e, 'triggers_table')}
          >
            {/* Triggers Header */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#242838] bg-[#161a26] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px] text-white tracking-tight">
                  {t(lang, 'sequence.triggersTitle')}
                </span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.2 font-mono text-[10.5px] font-bold text-amber-400 border border-amber-500/30">
                  {triggers.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Search to add trigger input */}
                <div ref={triggerSearchRef} className="relative w-48 sm:w-56">
                  <Search size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchTriggerQuery}
                    onChange={(e) => {
                      setSearchTriggerQuery(e.target.value);
                      setShowTriggerSearchDropdown(true);
                    }}
                    onFocus={() => setShowTriggerSearchDropdown(true)}
                    placeholder={t(lang, 'sequence.searchAddTrigger')}
                    className="h-7.5 w-full rounded border border-white/10 bg-[#0e1017] ps-8 pe-2.5 font-sans text-[11.5px] text-foreground placeholder:text-muted focus:border-amber-500/60 focus:outline-none"
                  />

                  {/* Dropdown palette */}
                  {showTriggerSearchDropdown && (
                    <div className="absolute start-0 top-full z-40 mt-1 w-72 rounded-md border border-[#2e3448] bg-[#161a26] p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        Select Trigger to Add
                      </div>
                      {filteredTriggerItems.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted">No triggers match search</div>
                      ) : (
                        filteredTriggerItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.type}
                              type="button"
                              className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] transition-colors"
                              onClick={() => {
                                const newTrig = addTrigger(sequence.id, item.type);
                                setShowTriggerSearchDropdown(false);
                                setSearchTriggerQuery('');
                                setEditingTriggerId(newTrig.id);
                              }}
                            >
                              <Icon size={14} className={`${item.color} shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white truncate">{item.title}</div>
                                <div className="font-mono text-[9.5px] text-muted truncate">{item.source}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Info button */}
                <button
                  type="button"
                  title={t(lang, 'sequence.infoTooltip')}
                  className="flex size-7.5 items-center justify-center rounded border border-white/10 bg-[#0e1017] text-muted hover:text-white transition-colors"
                >
                  <Info size={13} />
                </button>

                {/* Refresh Rewards button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void fetchAvailableRewards()}
                  disabled={isLoadingRewards}
                  className="h-7.5 border border-white/10 bg-[#0e1017] text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 text-[11.5px] font-medium"
                  title={t(lang, 'sequence.refreshRewardsHint')}
                >
                  <RefreshCw size={12} className={`me-1 ${isLoadingRewards ? 'animate-spin' : ''}`} />
                  <span>{t(lang, 'sequence.refreshRewards')}</span>
                </Button>

                {/* + Add Trigger button */}
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setShowAddTriggerMenu(!showAddTriggerMenu)}
                    className="h-7.5 border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11.5px] font-medium"
                  >
                    <Plus size={12} className="me-1" />
                    <span>{t(lang, 'sequence.add')}</span>
                    <ChevronDown size={11} className="ms-1 opacity-70" />
                  </Button>

                  {showAddTriggerMenu && (
                    <div className="absolute end-0 top-full z-30 mt-1 w-60 rounded-md border border-[#2e3448] bg-[#161a26] p-1.5 shadow-xl">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-white/[0.08] text-pink-400 transition-colors"
                        onClick={() => {
                          const nt = addTrigger(sequence.id, 'twitch_follow');
                          setShowAddTriggerMenu(false);
                          setEditingTriggerId(nt.id);
                        }}
                      >
                        <Heart size={14} />
                        <div>
                          <div className="font-medium text-white">{t(lang, 'sequence.triggerFollow')}</div>
                          <div className="font-mono text-[10px] text-muted">{t(lang, 'sequence.sourceTwitchChannel')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-white/[0.08] text-orange-400 transition-colors"
                        onClick={() => {
                          const nt = addTrigger(sequence.id, 'twitch_raid', { minViewers: 1 });
                          setShowAddTriggerMenu(false);
                          setEditingTriggerId(nt.id);
                        }}
                      >
                        <Flame size={14} />
                        <div>
                          <div className="font-medium text-white">{t(lang, 'sequence.triggerRaid')}</div>
                          <div className="font-mono text-[10px] text-muted">{t(lang, 'sequence.sourceTwitchChannel')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-white/[0.08] text-yellow-400 transition-colors"
                        onClick={() => {
                          const nt = addTrigger(sequence.id, 'twitch_watch_streak', { minStreak: 2 });
                          setShowAddTriggerMenu(false);
                          setEditingTriggerId(nt.id);
                        }}
                      >
                        <Zap size={14} />
                        <div>
                          <div className="font-medium text-white">{t(lang, 'sequence.triggerWatchStreak')}</div>
                          <div className="font-mono text-[10px] text-muted">{t(lang, 'sequence.sourceTwitchChannel')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-white/[0.08] text-sky-400 transition-colors"
                        onClick={() => {
                          const nt = addTrigger(sequence.id, 'twitch_chat', { chatCommand: '!command', matchMode: 'startsWith' });
                          setShowAddTriggerMenu(false);
                          setEditingTriggerId(nt.id);
                        }}
                      >
                        <Terminal size={14} />
                        <div>
                          <div className="font-medium text-white">{t(lang, 'sequence.triggerChatCommand')}</div>
                          <div className="font-mono text-[10px] text-muted">{t(lang, 'sequence.sourceCoreCommands')}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-white/[0.08] text-amber-400 transition-colors"
                        onClick={() => {
                          const nt = addTrigger(sequence.id, 'twitch_channel_points');
                          setShowAddTriggerMenu(false);
                          setEditingTriggerId(nt.id);
                        }}
                      >
                        <Coins size={14} />
                        <div>
                          <div className="font-medium text-white">{t(lang, 'sequence.triggerChannelPoints')}</div>
                          <div className="font-mono text-[10px] text-muted">{t(lang, 'sequence.sourceTwitchPoints')}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Triggers Table */}
            <div className="flex-1 overflow-x-auto min-h-[360px]">
              <table className="w-full text-start border-collapse font-sans text-[12px]">
                <thead>
                  <tr className="border-b border-[#242838] bg-[#0f1118] text-[#8e97a8] font-mono text-[10.5px] uppercase tracking-wider select-none">
                    <th className="py-2 px-3 text-start font-semibold">{t(lang, 'sequence.colSource')}</th>
                    <th className="py-2 px-3 text-start font-semibold">{t(lang, 'sequence.colType')}</th>
                    <th className="py-2 px-3 text-start font-semibold w-24">{t(lang, 'sequence.colEnabled')}</th>
                    <th className="py-2 px-3 text-start font-semibold">{t(lang, 'sequence.colCriteria')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b1f2b]">
                  {triggers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted font-sans text-[12px]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Radio size={22} className="text-zinc-600 mb-1" />
                          <p className="text-[13px] font-semibold text-zinc-300">
                            {lang === 'ar' ? 'لا توجد مُشغّلات مضافة (Empty Triggers)' : 'No triggers added (Empty Triggers)'}
                          </p>
                          <p className="max-w-md text-[11.5px] text-zinc-500">
                            {lang === 'ar'
                              ? 'يمكنك إبقاء المُشغّلات فارغة لتشغيل الإجراء يدوياً، أو عبر المحاكي، أو استدعاؤه كإجراء فرعي من متسلسلة أخرى. لإضافة مُشغّل، ابحث بالأعلى أو انقر بزر الفأرة الأيمن.'
                              : 'You can keep triggers empty to run this action manually, via simulator, or call it from other sub-actions. Search above or right-click to attach a trigger.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    triggers.map((trig) => {
                      const sourceText =
                        trig.type === 'twitch_follow'
                          ? t(lang, 'sequence.sourceTwitchChannel')
                          : trig.type === 'twitch_raid'
                          ? t(lang, 'sequence.sourceTwitchChannel')
                          : trig.type === 'twitch_watch_streak'
                          ? t(lang, 'sequence.sourceTwitchChannel')
                          : trig.type === 'twitch_chat'
                          ? t(lang, 'sequence.sourceCoreCommands')
                          : t(lang, 'sequence.sourceTwitchPoints');

                      const typeText =
                        trig.type === 'twitch_follow'
                          ? t(lang, 'sequence.typeChannelFollow')
                          : trig.type === 'twitch_raid'
                          ? t(lang, 'sequence.typeChannelRaid')
                          : trig.type === 'twitch_watch_streak'
                          ? t(lang, 'sequence.typeWatchStreak')
                          : trig.type === 'twitch_chat'
                          ? t(lang, 'sequence.typeCommandTriggered')
                          : t(lang, 'sequence.typeRewardRedemption');

                      const criteriaText =
                        trig.type === 'twitch_follow'
                          ? 'Any new follower'
                          : trig.type === 'twitch_raid'
                          ? `Min: ${trig.minViewers ?? 1} viewers`
                          : trig.type === 'twitch_watch_streak'
                          ? `Min: ${trig.minStreak ?? 1} streams`
                          : trig.type === 'twitch_chat'
                          ? `${trig.chatCommand || '!command'} (${trig.matchMode || 'startsWith'})`
                          : trig.rewardTitle || 'Custom Reward';

                      return (
                        <tr
                          key={trig.id}
                          onDoubleClick={() => setEditingTriggerId(trig.id)}
                          onContextMenu={(e) => openContextMenu(e, 'trigger_row', trig.id)}
                          className="hover:bg-[#1b202d] transition-colors cursor-pointer select-none group"
                          title="Double-click to edit, right-click for options"
                        >
                          {/* Source */}
                          <td className="py-2.5 px-3 font-mono text-[11.5px] text-zinc-300">
                            <div className="flex items-center gap-2">
                              {trig.type === 'twitch_follow' ? (
                                <Heart size={13} className="text-pink-400 shrink-0" />
                              ) : trig.type === 'twitch_raid' ? (
                                <Flame size={13} className="text-orange-400 shrink-0" />
                              ) : trig.type === 'twitch_watch_streak' ? (
                                <Zap size={13} className="text-yellow-400 shrink-0" />
                              ) : trig.type === 'twitch_chat' ? (
                                <Terminal size={13} className="text-sky-400 shrink-0" />
                              ) : (
                                <Coins size={13} className="text-amber-400 shrink-0" />
                              )}
                              <span>{sourceText}</span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-3 font-medium text-white">{typeText}</td>

                          {/* Enabled (Clickable toggle) */}
                          <td className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTrigger(sequence.id, trig.id, { enabled: !trig.enabled });
                              }}
                              className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                                trig.enabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                              }`}
                            >
                              {trig.enabled ? t(lang, 'sequence.yes') : t(lang, 'sequence.no')}
                            </button>
                          </td>

                          {/* Criteria */}
                          <td className="py-2.5 px-3 font-mono text-[11.5px] text-zinc-300">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{criteriaText}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingTriggerId(trig.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-white rounded hover:bg-white/10 transition-opacity"
                                  title={t(lang, 'sequence.editTrigger')}
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTrigger(sequence.id, trig.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-rose-400 rounded hover:bg-rose-500/10 transition-opacity"
                                  title={t(lang, 'sequence.deleteTrigger')}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* PANEL 2: SUB-ACTIONS */}
          <section
            className="flex flex-col rounded-lg border border-[#242838] bg-[#131620] shadow-md overflow-hidden"
            onContextMenu={(e) => openContextMenu(e, 'actions_list')}
          >
            {/* Sub-Actions Header */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#242838] bg-[#161a26] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px] text-white tracking-tight">
                  {t(lang, 'sequence.subActionsTitle')}
                </span>
                <span className="rounded-full bg-sky-500/15 px-2 py-0.2 font-mono text-[10.5px] font-bold text-sky-400 border border-sky-500/30">
                  {sequence.steps.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Search to add sub-action input */}
                <div ref={subActionSearchRef} className="relative w-48 sm:w-56">
                  <Search size={13} className="absolute start-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    value={searchSubActionQuery}
                    onChange={(e) => {
                      setSearchSubActionQuery(e.target.value);
                      setShowSubActionSearchDropdown(true);
                    }}
                    onFocus={() => setShowSubActionSearchDropdown(true)}
                    placeholder={t(lang, 'sequence.searchAddSubAction')}
                    className="h-7.5 w-full rounded border border-white/10 bg-[#0e1017] ps-8 pe-2.5 font-sans text-[11.5px] text-foreground placeholder:text-muted focus:border-sky-500/60 focus:outline-none"
                  />

                  {/* Dropdown palette */}
                  {showSubActionSearchDropdown && (
                    <div className="absolute start-0 top-full z-40 mt-1 w-72 max-h-80 overflow-y-auto rounded-md border border-[#2e3448] bg-[#161a26] p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        Select Sub-Action to Add
                      </div>
                      {filteredSubActionItems.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted">No sub-actions match search</div>
                      ) : (
                        filteredSubActionItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] transition-colors"
                              onClick={() => {
                                const newStep = addStep(sequence.id, item.type, item.options);
                                setShowSubActionSearchDropdown(false);
                                setSearchSubActionQuery('');
                                setEditingStepId(newStep.id);
                              }}
                            >
                              <Icon size={14} className={`${item.color} shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white truncate">{item.title}</div>
                                <div className="text-[9.5px] text-muted truncate">{item.desc}</div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Add Comment button */}
                <button
                  type="button"
                  onClick={() => {
                    const st = addStep(sequence.id, 'comment', { commentText: '** This is a comment! **' });
                    setEditingStepId(st.id);
                  }}
                  title={t(lang, 'sequence.addComment')}
                  className="flex h-7.5 items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 font-mono text-[11px] text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageSquare size={12} />
                  <span>{t(lang, 'sequence.comment')}</span>
                </button>

                {/* + Add Sub-Action button */}
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setShowAddActionMenu(!showAddActionMenu)}
                    className="h-7.5 border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-[11.5px] font-medium"
                  >
                    <Plus size={12} className="me-1" />
                    <span>{t(lang, 'sequence.add')}</span>
                    <ChevronDown size={11} className="ms-1 opacity-70" />
                  </Button>

                  {showAddActionMenu && (
                    <div className="absolute end-0 top-full z-30 mt-1 w-64 rounded-md border border-[#2e3448] bg-[#161a26] p-1.5 shadow-xl">
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        {t(lang, 'sequence.categoryTwitch')}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-sky-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'chat', { chatMessage: 'Drinking water! Thanks {username} 🥤' });
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>{t(lang, 'sequence.actionSendChatMessage')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-orange-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'moderation', { moderationAction: 'shoutout', targetUser: '{raider}' });
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Megaphone size={13} />
                        <span>{t(lang, 'sequence.actionSendShoutout')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-rose-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'moderation', { moderationAction: 'smart_timeout', targetUser: '{target}' });
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Shield size={13} />
                        <span>{t(lang, 'sequence.stepModeration')}</span>
                      </button>

                      <div className="my-1 h-px bg-white/[0.08]" />
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        {t(lang, 'sequence.categoryAudioSpeech')}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-indigo-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'sound');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Volume2 size={13} />
                        <span>{t(lang, 'sequence.stepSound')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-teal-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'tts');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Mic size={13} />
                        <span>{t(lang, 'sequence.stepTts')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-rose-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'mic_mute');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <MicOff size={13} />
                        <span>{t(lang, 'sequence.stepMicMute')}</span>
                      </button>

                      <div className="my-1 h-px bg-white/[0.08]" />
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        {t(lang, 'sequence.categoryInteractivity')}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-amber-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'obs_text');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <FileText size={13} />
                        <span>{t(lang, 'sequence.stepObsText')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-pink-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'obs_image');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <ImageIcon size={13} />
                        <span>{t(lang, 'sequence.stepObsImage')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-amber-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'duel', {
                            duelMode: 'ai_trivia',
                            duelOpponent: '{input}',
                            duelTimeoutDuration: 60,
                            duelTimerSeconds: 30,
                          });
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Swords size={13} />
                        <span>{t(lang, 'sequence.stepDuel')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-violet-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'poll');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <BarChart3 size={13} />
                        <span>{t(lang, 'sequence.stepPoll')}</span>
                      </button>

                      <div className="my-1 h-px bg-white/[0.08]" />
                      <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                        {t(lang, 'sequence.categoryCore')}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-amber-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'wait', { waitDuration: 2, waitUnit: 'seconds' });
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Clock size={13} />
                        <span>{t(lang, 'sequence.stepWait')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-emerald-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'counter');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Calculator size={13} />
                        <span>{t(lang, 'sequence.stepCounter')}</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[11.5px] hover:bg-white/[0.08] text-violet-400 transition-colors"
                        onClick={() => {
                          const ns = addStep(sequence.id, 'command');
                          setShowAddActionMenu(false);
                          setEditingStepId(ns.id);
                        }}
                      >
                        <Terminal size={13} />
                        <span>{t(lang, 'sequence.stepCommand')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-Actions List Container (Streamer.bot styled framed list) */}
            <div className="flex-1 p-2.5 overflow-y-auto min-h-[360px]">
              <div className="rounded-md border border-[#202432] bg-[#0c0e14] p-2 font-mono text-[12px] space-y-1">
                {sequence.steps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted">
                    <Sparkles size={20} className="mb-2 text-zinc-600" />
                    <p className="text-[12px]">{t(lang, 'sequence.emptyStack')}</p>
                  </div>
                ) : (
                  sequence.steps.map((st, idx) => {
                    const isStepRunning = isExecuting && activeRunningStepIndex === idx;
                    const isComment = st.type === 'comment';
                    const isDraggingThis = draggedStepIndex === idx;
                    const isDragOverThis = dragOverStepIndex === idx && draggedStepIndex !== null && draggedStepIndex !== idx;

                    return (
                      <div
                        key={st.id}
                        draggable={!isExecuting}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedStepIndex(idx);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverStepIndex !== idx) {
                            setDragOverStepIndex(idx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          if (dragOverStepIndex === idx) {
                            setDragOverStepIndex(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (draggedStepIndex !== null && draggedStepIndex !== idx) {
                            reorderSteps(sequence.id, draggedStepIndex, idx);
                          }
                          setDraggedStepIndex(null);
                          setDragOverStepIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggedStepIndex(null);
                          setDragOverStepIndex(null);
                        }}
                        onDoubleClick={() => setEditingStepId(st.id)}
                        onContextMenu={(e) => openContextMenu(e, 'action_row', st.id, idx)}
                        className={`group relative flex items-center justify-between rounded px-2 py-1.5 border transition-all cursor-pointer select-none ${
                          isStepRunning
                            ? 'border-accent bg-accent/15 ring-2 ring-accent text-white animate-pulse'
                            : isDraggingThis
                            ? 'opacity-35 border-dashed border-sky-400/80 bg-sky-500/10'
                            : isDragOverThis
                            ? 'border-sky-400 bg-sky-500/20 ring-2 ring-sky-400/70 text-white shadow-lg'
                            : isComment
                            ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/30'
                            : 'border-transparent hover:border-[#2b3142] hover:bg-[#161a26] text-zinc-200'
                        }`}
                        title="Drag handle to reorder, double-click to edit, right-click for options"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-sky-400 p-0.5 rounded transition-colors shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical size={13} />
                          </div>

                          <span className="w-4 text-end text-[11px] text-zinc-600 font-mono select-none shrink-0">
                            {idx + 1}
                          </span>

                          {isComment ? (
                            <div className="flex items-center gap-2 truncate font-semibold text-emerald-400">
                              <span>💬</span>
                              <span className="truncate">// ** {st.commentText || 'This is a comment!'} **</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 truncate">
                              {st.type === 'chat' ? (
                                <MessageSquare size={13} className="text-sky-400 shrink-0" />
                              ) : st.type === 'moderation' ? (
                                st.moderationAction === 'shoutout' ? (
                                  <Megaphone size={13} className="text-orange-400 shrink-0" />
                                ) : (
                                  <Shield size={13} className="text-rose-400 shrink-0" />
                                )
                              ) : st.type === 'sound' ? (
                                <Volume2 size={13} className="text-indigo-400 shrink-0" />
                              ) : st.type === 'tts' ? (
                                <Mic size={13} className="text-teal-400 shrink-0" />
                              ) : st.type === 'obs_text' ? (
                                <FileText size={13} className="text-amber-400 shrink-0" />
                              ) : st.type === 'obs_image' ? (
                                <ImageIcon size={13} className="text-pink-400 shrink-0" />
                              ) : st.type === 'duel' ? (
                                <Swords size={13} className="text-amber-400 shrink-0" />
                              ) : st.type === 'poll' ? (
                                <BarChart3 size={13} className="text-violet-400 shrink-0" />
                              ) : st.type === 'mic_mute' ? (
                                <MicOff size={13} className="text-rose-400 shrink-0" />
                              ) : st.type === 'wait' ? (
                                <Clock size={13} className="text-amber-400 shrink-0" />
                              ) : st.type === 'counter' ? (
                                <Calculator size={13} className="text-emerald-400 shrink-0" />
                              ) : (
                                <Terminal size={13} className="text-violet-400 shrink-0" />
                              )}
                              <span className="truncate text-[12px]">{getSubActionSummary(st)}</span>
                            </div>
                          )}
                        </div>

                        {/* Row Quick Action Buttons */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ps-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingStepId(st.id);
                            }}
                            className="p-1 text-muted hover:text-white rounded hover:bg-white/10 transition-colors"
                            title={t(lang, 'sequence.editSubAction')}
                          >
                            <Edit3 size={12} />
                          </button>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveStep(sequence.id, idx, 'up');
                              }}
                              className="p-1 text-muted hover:text-white rounded hover:bg-white/10 transition-colors"
                              title={t(lang, 'sequence.moveUp')}
                            >
                              <ChevronUp size={12} />
                            </button>
                          )}
                          {idx < sequence.steps.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveStep(sequence.id, idx, 'down');
                              }}
                              className="p-1 text-muted hover:text-white rounded hover:bg-white/10 transition-colors"
                              title={t(lang, 'sequence.moveDown')}
                            >
                              <ChevronDown size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(sequence.id, st.id);
                            }}
                            className="p-1 text-muted hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                            title={t(lang, 'sequence.deleteStep')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[210px] rounded-lg border border-[#2c3244] bg-[#161a26] p-1.5 shadow-2xl text-[12px] font-sans animate-in fade-in zoom-in-95 duration-100"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            left: Math.min(contextMenu.x, window.innerWidth - 250),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Triggers section menu */}
          {(contextMenu.type === 'triggers_table' || contextMenu.type === 'trigger_row') && (
            <>
              {contextMenu.type === 'trigger_row' && contextMenu.targetId && (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-white"
                    onClick={() => {
                      const tItem = triggers.find((tr) => tr.id === contextMenu.targetId);
                      if (tItem) updateTrigger(sequence.id, tItem.id, { enabled: !tItem.enabled });
                      setContextMenu(null);
                    }}
                  >
                    <Check size={13} className="text-emerald-400" />
                    <span>{t(lang, 'sequence.toggleTrigger')}</span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-white"
                    onClick={() => {
                      if (contextMenu.targetId) setEditingTriggerId(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Edit3 size={13} className="text-sky-400" />
                    <span>{t(lang, 'sequence.editTrigger')}</span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (contextMenu.targetId) removeTrigger(sequence.id, contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t(lang, 'sequence.deleteTrigger')}</span>
                  </button>
                  <div className="my-1 h-px bg-white/[0.08]" />
                </>
              )}

              <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                {t(lang, 'sequence.contextAddTrigger')}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-pink-400"
                onClick={() => {
                  const nt = addTrigger(sequence.id, 'twitch_follow');
                  setContextMenu(null);
                  setEditingTriggerId(nt.id);
                }}
              >
                <Heart size={14} />
                <span>{t(lang, 'sequence.triggerFollow')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-orange-400"
                onClick={() => {
                  const nt = addTrigger(sequence.id, 'twitch_raid', { minViewers: 1 });
                  setContextMenu(null);
                  setEditingTriggerId(nt.id);
                }}
              >
                <Flame size={14} />
                <span>{t(lang, 'sequence.triggerRaid')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-yellow-400"
                onClick={() => {
                  const nt = addTrigger(sequence.id, 'twitch_watch_streak', { minStreak: 2 });
                  setContextMenu(null);
                  setEditingTriggerId(nt.id);
                }}
              >
                <Zap size={14} />
                <span>{t(lang, 'sequence.triggerWatchStreak')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-sky-400"
                onClick={() => {
                  const nt = addTrigger(sequence.id, 'twitch_chat', { chatCommand: '!command', matchMode: 'startsWith' });
                  setContextMenu(null);
                  setEditingTriggerId(nt.id);
                }}
              >
                <Terminal size={14} />
                <span>{t(lang, 'sequence.triggerChatCommand')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-amber-400"
                onClick={() => {
                  const nt = addTrigger(sequence.id, 'twitch_channel_points');
                  setContextMenu(null);
                  setEditingTriggerId(nt.id);
                }}
              >
                <Coins size={14} />
                <span>{t(lang, 'sequence.triggerChannelPoints')}</span>
              </button>
            </>
          )}

          {/* Sub-Actions section menu */}
          {(contextMenu.type === 'actions_list' || contextMenu.type === 'action_row') && (
            <>
              {contextMenu.type === 'action_row' && contextMenu.targetId && contextMenu.targetIndex !== undefined && (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-white"
                    onClick={() => {
                      if (contextMenu.targetId) setEditingStepId(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Edit3 size={13} className="text-sky-400" />
                    <span>{t(lang, 'sequence.editSubAction')}</span>
                  </button>

                  {contextMenu.targetIndex > 0 && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-white"
                      onClick={() => {
                        moveStep(sequence.id, contextMenu.targetIndex!, 'up');
                        setContextMenu(null);
                      }}
                    >
                      <ChevronUp size={13} />
                      <span>{t(lang, 'sequence.moveUp')}</span>
                    </button>
                  )}
                  {contextMenu.targetIndex < sequence.steps.length - 1 && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-white"
                      onClick={() => {
                        moveStep(sequence.id, contextMenu.targetIndex!, 'down');
                        setContextMenu(null);
                      }}
                    >
                      <ChevronDown size={13} />
                      <span>{t(lang, 'sequence.moveDown')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (contextMenu.targetId) removeStep(sequence.id, contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>{t(lang, 'sequence.deleteStep')}</span>
                  </button>
                  <div className="my-1 h-px bg-white/[0.08]" />
                </>
              )}

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-emerald-400 font-medium"
                onClick={() => {
                  const ns = addStep(sequence.id, 'comment', { commentText: '** This is a comment! **' });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <MessageSquare size={13} />
                <span>{t(lang, 'sequence.addComment')}</span>
              </button>

              <div className="my-1 h-px bg-white/[0.08]" />

              <div className="px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-muted">
                {t(lang, 'sequence.contextAddSubAction')}
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-indigo-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'sound');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Volume2 size={14} />
                <span>{t(lang, 'sequence.stepSound')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-teal-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'tts');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Mic size={14} />
                <span>{t(lang, 'sequence.stepTts')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-rose-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'mic_mute');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <MicOff size={14} />
                <span>{t(lang, 'sequence.stepMicMute')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-amber-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'obs_text');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <FileText size={14} />
                <span>{t(lang, 'sequence.stepObsText')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-pink-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'obs_image');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <ImageIcon size={14} />
                <span>{t(lang, 'sequence.stepObsImage')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-amber-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'duel', {
                    duelMode: 'ai_trivia',
                    duelOpponent: '{input}',
                    duelTimeoutDuration: 60,
                    duelTimerSeconds: 30,
                  });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Swords size={14} />
                <span>{t(lang, 'sequence.stepDuel')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-violet-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'poll');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <BarChart3 size={14} />
                <span>{t(lang, 'sequence.stepPoll')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-orange-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'moderation', { moderationAction: 'shoutout', targetUser: '{raider}' });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Megaphone size={14} />
                <span>{t(lang, 'sequence.actionSendShoutout')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-sky-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'chat', { chatMessage: 'Thanks @{raider} for raiding with {viewers} viewers!' });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <MessageSquare size={14} />
                <span>{t(lang, 'sequence.actionSendChatMessage')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-rose-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'moderation', { moderationAction: 'smart_timeout', targetUser: '{target}' });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Shield size={14} />
                <span>{t(lang, 'sequence.stepModeration')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-amber-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'wait', { waitDuration: 2, waitUnit: 'seconds' });
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Clock size={14} />
                <span>{t(lang, 'sequence.stepWait')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-emerald-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'counter');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Calculator size={14} />
                <span>{t(lang, 'sequence.stepCounter')}</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-start hover:bg-white/[0.08] text-violet-400"
                onClick={() => {
                  const ns = addStep(sequence.id, 'command');
                  setContextMenu(null);
                  setEditingStepId(ns.id);
                }}
              >
                <Terminal size={14} />
                <span>{t(lang, 'sequence.stepCommand')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Edit Trigger Modal */}
      {editingTriggerId && (() => {
        const trig = triggers.find((t) => t.id === editingTriggerId);
        if (!trig) return null;
        return (
          <EditTriggerModal
            trigger={trig}
            availableRewards={availableRewards}
            lang={lang}
            onSave={(patch) => updateTrigger(sequence.id, trig.id, patch)}
            onDelete={() => removeTrigger(sequence.id, trig.id)}
            onClose={() => setEditingTriggerId(null)}
          />
        );
      })()}

      {/* Edit Sub-Action Modal */}
      {editingStepId && (() => {
        const stepIdx = sequence.steps.findIndex((s) => s.id === editingStepId);
        if (stepIdx === -1) return null;
        const step = sequence.steps[stepIdx];
        return (
          <EditSubActionModal
            step={step}
            index={stepIdx}
            counters={counters}
            lang={lang}
            onSave={(patch) => updateStep(sequence.id, step.id, patch)}
            onClose={() => setEditingStepId(null)}
          />
        );
      })()}
    </div>
  );
}
