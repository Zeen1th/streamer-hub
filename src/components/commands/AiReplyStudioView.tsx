import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  Clock,
  Coins,
  Globe,
  MessageSquare,
  Play,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import type { AutoReply, ChatMessage, PermissionLevel } from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import { useAutoReplyStore } from '../../store/autoReplyStore';
import { useConnectionStore } from '../../store/connectionStore';
import { useLogStore } from '../../store/logStore';
import { t } from '../../i18n/translations';
import { evaluateRuleExecution, renderAutoReply } from '../../lib/autoReplyRules';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl, type SegmentedOption } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { TriggerTitleAction } from '../tools/auto-replies/TriggerTitleAction';
import { ChatterOverridesSection } from './ChatterOverridesSection';

interface AiReplyStudioViewProps {
  rule: AutoReply;
  onBack: () => void;
  onSwitchToNormal?: () => void;
  lang: 'en' | 'ar';
}

const RANKS: PermissionLevel[] = ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'];

export interface CustomPersonaPreset {
  id: string;
  name: string;
  agentName: string;
  agentRole: string;
  agentContext: string;
  aiInstructions: string;
}

const CUSTOM_PRESETS_STORAGE_KEY = 'streamer-hub-ai-custom-presets';

function loadCustomPresets(): CustomPersonaPreset[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomPresets(presets: CustomPersonaPreset[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage write error
  }
}

const PERSONA_PRESETS = [
  {
    key: 'arrodes',
    labelKey: 'aiStudio.presetArrodes',
    name: 'Arrodes',
    nameAr: 'أروديس',
    roleEn: 'All-knowing magic silver mirror from LOTM that holds endless secrets and answers questions with mysterious wit',
    roleAr: 'مرآة سحرية فضية عليمة بالأسرار من LOTM تملك بحراً من المعلومات وتجيب بذكاء وغموض',
    contextEn: 'Identity: Arrodes, the mysterious magic silver mirror from Lord of the Mysteries (LOTM). It possesses immense knowledge of the universe, secrets, and stream facts. It is completely devoted to the Supreme Master (the streamer).',
    contextAr: 'الهوية: مرآة أروديس السحرية الفضية من رواية سيد الغموض (LOTM). تملك علماً واسعاً بالأسرار والمعلومات، ومخلصة تماماً لسيدها العظيم (الستريمر).',
    instructionsEn: 'You are Arrodes, the omniscient magic mirror. Answer {username} accurately with insightful knowledge in under 25 words. Maintain a respectful, devoted tone to the streamer and a mysterious mirror vibe.',
    instructionsAr: 'أنت أروديس (المرآة السحرية العليمة من LOTM). قدّم إجابات دقيقة وغنية بالمعلومات لـ {username} في أقل من 25 كلمة بنبرة مرآة غامضة ومخلصة للستريمر.',
  },
];

const MODEL_PRESETS = [
  { label: 'Llama 3.1 8B (Groq · Fast)', value: 'llama-3.1-8b-instant', provider: 'groq' as const },
  { label: 'Allam 7B (Groq · Arabic)', value: 'allam-2-7b', provider: 'groq' as const },
  { label: 'GPT-OSS 20B (Groq · Fast)', value: 'openai/gpt-oss-20b', provider: 'groq' as const },
  { label: 'GPT-OSS 120B (Groq · Powerful)', value: 'openai/gpt-oss-120b', provider: 'groq' as const },
  { label: 'Qwen 3.8 27B (OpenRouter · Free)', value: 'qwen/qwen3.8-27b:free', provider: 'openrouter' as const },
  { label: 'Nex N2.5 Pro (OpenRouter · Free)', value: 'nex-agi/nex-n2.5-pro:free', provider: 'openrouter' as const },
];

export function AiReplyStudioView({
  rule,
  onBack,
  onSwitchToNormal,
  lang,
}: AiReplyStudioViewProps) {
  const update = useAutoReplyStore((s) => s.update);
  const remove = useAutoReplyStore((s) => s.remove);
  const globalSettings = useAutoReplyStore((s) => s.globalSettings);
  const updateGlobalSettings = useAutoReplyStore((s) => s.updateGlobalSettings);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);
  const activeChatSender = useConnectionStore((s) => s.activeChatSender);
  const provider = rule.aiProvider ?? 'groq';

  const [newTriggerInput, setNewTriggerInput] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [testUser, setTestUser] = useState('viewer');
  const [testMessage, setTestMessage] = useState('');
  const [lastTestOutput, setLastTestOutput] = useState<string | null>(null);
  const [twitchRewards, setTwitchRewards] = useState<{ id: string; title: string; cost: number }[]>([]);

  useEffect(() => {
    rpc.invoke(Channels.TwitchChannelPointsGetRewards, undefined)
      .then((res) => {
        if (res?.ok && res.rewards?.length) {
          setTwitchRewards(res.rewards.map((r) => ({ id: r.id, title: r.title, cost: r.cost })));
        }
      })
      .catch(() => undefined);
  }, []);
  const [isTesting, setIsTesting] = useState(false);

  // Custom User Presets
  const [customPresets, setCustomPresets] = useState<CustomPersonaPreset[]>(() => loadCustomPresets());
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetTitleInput, setPresetTitleInput] = useState('');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  const handleConfirmSavePreset = () => {
    const fallbackTitle = rule.agentName?.trim() || (lang === 'ar' ? 'قالب مخصص' : 'Custom Preset');
    const title = presetTitleInput.trim() || fallbackTitle;
    const newPreset: CustomPersonaPreset = {
      id: 'custom-' + Date.now(),
      name: title,
      agentName: rule.agentName ?? '',
      agentRole: rule.agentRole ?? '',
      agentContext: rule.agentContext ?? '',
      aiInstructions: rule.aiInstructions ?? '',
    };
    const next = [newPreset, ...customPresets.filter((p) => p.name !== title)];
    setCustomPresets(next);
    saveCustomPresets(next);
    setIsSavingPreset(false);
    setPresetTitleInput('');
    setPresetFeedback(t(lang, 'aiStudio.presetSaved'));
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  // Escape key to navigate back with instant flush
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useAutoReplyStore.getState().flush(rule.id);
        onBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      useAutoReplyStore.getState().flush(rule.id);
    };
  }, [onBack, rule.id]);

  // Auto-initialize default persona & instructions matching current language if empty
  useEffect(() => {
    if (!rule.aiInstructions?.trim()) {
      if (lang === 'ar') {
        update(rule.id, {
          agentName: rule.agentName?.trim() ? rule.agentName : 'أروديس',
          agentRole: rule.agentRole?.trim() ? rule.agentRole : 'مرآة سحرية فضية عليمة بالأسرار من LOTM تملك بحراً من المعلومات وتجيب بذكاء وغموض',
          agentContext: rule.agentContext?.trim() ? rule.agentContext : 'الهوية: مرآة أروديس السحرية الفضية من رواية سيد الغموض (LOTM). تملك علماً واسعاً بالأسرار والمعلومات، ومخلصة تماماً لسيدها العظيم (الستريمر).',
          aiInstructions: 'أنت أروديس (المرآة السحرية العليمة من LOTM). قدّم إجابات دقيقة وغنية بالمعلومات لـ {username} في أقل من 25 كلمة بنبرة مرآة غامضة ومخلصة للستريمر.',
        });
      } else {
        update(rule.id, {
          agentName: rule.agentName?.trim() ? rule.agentName : 'Arrodes',
          agentRole: rule.agentRole?.trim() ? rule.agentRole : 'All-knowing magic silver mirror from LOTM that holds endless secrets and answers questions with mysterious wit',
          agentContext: rule.agentContext?.trim() ? rule.agentContext : 'Identity: Arrodes, the mysterious magic silver mirror from Lord of the Mysteries (LOTM). It possesses immense knowledge of the universe, secrets, and stream facts. It is completely devoted to the Supreme Master (the streamer).',
          aiInstructions: 'You are Arrodes, the omniscient magic mirror. Answer {username} accurately with insightful knowledge in under 25 words. Maintain a respectful, devoted tone to the streamer and a mysterious mirror vibe.',
        });
      }
    }
  }, [lang, rule.id]);

  const BackIcon = lang === 'ar' ? ChevronLeft : ArrowLeft;

  const handleAddTrigger = () => {
    const clean = newTriggerInput.trim();
    if (!clean) return;
    if (!rule.triggers.includes(clean)) {
      update(rule.id, { triggers: [...rule.triggers, clean] });
    }
    setNewTriggerInput('');
  };

  const handleRemoveTrigger = (index: number) => {
    if (rule.triggers.length <= 1) return;
    update(rule.id, {
      triggers: rule.triggers.filter((_, i) => i !== index),
    });
  };

  const handleInsertToken = (token: string) => {
    const current = rule.aiInstructions || '';
    update(rule.id, {
      aiInstructions: current ? `${current} ${token}` : token,
    });
  };

  const handleTestSimulate = async () => {
    useAutoReplyStore.getState().flush(rule.id);
    setIsTesting(true);
    const cleanSimUser = testUser.trim().replace(/^@+/, '') || 'viewer';
    const mockMsg: ChatMessage = {
      id: 'sim-' + Date.now(),
      username: cleanSimUser,
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: testMessage.trim() || (rule.triggers[0] ? `!${rule.triggers[0]}` : 'hello'),
      timestamp: new Date().toISOString(),
      emotes: [],
    };

    const plan = evaluateRuleExecution(rule, mockMsg);
    if (plan.type === 'ignore') {
      useLogStore.getState().add({
        kind: 'system',
        message: `[Simulated Reply] Silenced/Ignored for @${cleanSimUser} (Chatter Override)`,
      });
      setLastTestOutput(`[Silenced/Ignored for @${cleanSimUser} by Chatter Override]`);
      setIsTesting(false);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 2500);
      return;
    }

    if (plan.type === 'ai') {
      try {
        const res = await rpc.invoke(Channels.AutoRepliesGenerate, {
          ruleId: rule.id,
          send: false,
          message: mockMsg,
          overrideInstructions: plan.isOverride ? plan.instructions : undefined,
          senderRole: rule.senderRole && rule.senderRole !== 'default' ? rule.senderRole : undefined,
        }, 45000);
        if (res.ok && res.message) {
          setLastTestOutput(res.message);
          const via = res.senderLogin ? ` (via @${res.senderLogin})` : '';
          useLogStore.getState().add({
            kind: 'chat',
            message: `[Simulated AI Reply for @${cleanSimUser}${via}] ${res.message}`,
          });
        } else {
          const err = res.error || (res.usedFallback ? 'Used offline fallback' : 'AI generation failed');
          setLastTestOutput(res.message ? `${res.message} (Fallback)` : `[Error: ${err}]`);
          useLogStore.getState().add({
            kind: 'system',
            message: `[AI Test Failed for @${cleanSimUser}] ${err}`,
          });
        }
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const fallback = rule.aiFallback || `[Error: ${errMessage}]`;
        setLastTestOutput(fallback);
        useLogStore.getState().add({
          kind: 'system',
          message: `[AI Test Error for @${cleanSimUser}] ${errMessage}`,
        });
      }
      setIsTesting(false);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 2500);
      return;
    }

    const previewText = renderAutoReply(plan.text, mockMsg);
    const tag = plan.isOverride ? `[Simulated Override for @${cleanSimUser}]` : `[Simulated Reply for @${cleanSimUser}]`;
    setLastTestOutput(previewText);
    useLogStore.getState().add({
      kind: 'chat',
      message: `${tag} ${previewText}`,
    });

    setIsTesting(false);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const rankOptions: SegmentedOption<PermissionLevel>[] = RANKS.map((value) => ({
    value,
    label: t(lang, `ranks.${value}`),
  }));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface font-sans text-foreground">
      {/* Sticky Sub-Header Banner */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-rule bg-surface/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => { useAutoReplyStore.getState().flush(rule.id); onBack(); }} title={t(lang, 'sequence.back')}>
            <BackIcon size={13} />
            <span>{t(lang, 'sequence.back')}</span>
          </Button>

          <div className="h-4 w-px bg-rule" />

          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <Input
              value={rule.triggers[0] ?? ''}
              onChange={(e) => {
                const nextTriggers = [...rule.triggers];
                nextTriggers[0] = e.target.value;
                update(rule.id, { triggers: nextTriggers });
              }}
              className="h-7 w-48 font-semibold text-[13px]"
              placeholder="Trigger command..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              onChange={(checked) => update(rule.id, { enabled: checked })}
              label={t(lang, 'workspace.enable')}
            />
            <span className="font-mono text-[11px] text-muted">
              {rule.enabled ? t(lang, 'workspace.enable') : t(lang, 'workspace.disable')}
            </span>
          </div>

          <div className="h-4 w-px bg-rule" />

          <div className="flex items-center gap-1.5 rounded-md border border-rule bg-surface-2/60 px-2 py-0.5">
            <span className="font-mono text-[10.5px] text-muted">Test as:</span>
            <Input
              value={testUser}
              onChange={(e) => setTestUser(e.target.value)}
              placeholder="@viewer"
              className="h-6 w-24 text-[11px] font-mono px-1.5"
            />
            <Button
              size="sm"
              onClick={handleTestSimulate}
              disabled={isTesting}
              className="h-6 border border-purple-500/40 bg-purple-600/90 text-white hover:bg-purple-600 px-2 text-[11px]"
            >
              <Play size={11} className="fill-current me-1" />
              <span>{testSent ? '✓ Simulated!' : isTesting ? 'Testing…' : t(lang, 'sequence.runTest')}</span>
            </Button>
          </div>

          {onSwitchToNormal && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                update(rule.id, { responseMode: 'static' });
                onSwitchToNormal();
              }}
              className="border-sky-500/40 bg-sky-500/10 text-sky-300 hover:border-sky-500/60 hover:bg-sky-500/20"
              title={t(lang, 'workspace.openReplyStudio')}
            >
              <MessageSquare size={12} className="text-sky-400 me-1" />
              <span>{t(lang, 'workspace.prepared')}</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              remove(rule.id);
              onBack();
            }}
            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
            title={t(lang, 'workspace.delete')}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        {/* Section 1: Trigger & Matching Rules */}
        <section className="rounded-lg border border-rule bg-surface-3 p-4">
          <div className="mb-4 flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h2 className="font-semibold text-[13px] tracking-tight">
                {t(lang, 'workspace.triggerWord')} & {t(lang, 'workspace.matchMode')}
              </h2>
              <p className="text-[11px] text-muted">
                Configure chat words that activate this AI smart reply
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">{t(lang, 'workspace.responseType')}:</span>
              <SegmentedControl<'static' | 'ai'>
                value={rule.responseMode ?? 'ai'}
                onChange={(mode) => {
                  update(rule.id, { responseMode: mode });
                  if (mode === 'static' && onSwitchToNormal) {
                    onSwitchToNormal();
                  }
                }}
                options={[
                  { value: 'static', label: t(lang, 'workspace.prepared') },
                  { value: 'ai', label: `✨ ${t(lang, 'workspace.ai')}` },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Trigger Chips */}
            <div className="flex flex-col gap-2 rounded-md border border-rule/80 bg-surface/60 p-3">
              <span className="font-medium text-[12px] text-foreground">
                {t(lang, 'workspace.triggerWord')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
                {rule.triggers.map((trig, idx) => (
                  <span
                    key={idx}
                    className="flex items-center gap-1 rounded-md border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink shadow-xs"
                  >
                    <span>!{trig}</span>
                    {rule.triggers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTrigger(idx)}
                        className="text-muted hover:text-red-400"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                <Input
                  value={newTriggerInput}
                  onChange={(e) => setNewTriggerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTrigger();
                    }
                  }}
                  placeholder="Add another alias (e.g. discord)..."
                  className="h-7 text-[11px]"
                />
                <Button size="sm" variant="outline" onClick={handleAddTrigger} className="h-7 px-2">
                  <Plus size={11} />
                </Button>
              </div>
            </div>

            {/* Match Mode */}
            <div className="flex flex-col gap-2 rounded-md border border-rule/80 bg-surface/60 p-3">
              <span className="font-medium text-[12px] text-foreground">
                {t(lang, 'workspace.matchMode')}
              </span>
              <SegmentedControl
                value={rule.matchMode}
                options={[
                  { value: 'exact', label: t(lang, 'workspace.exact') },
                  { value: 'startsWith', label: t(lang, 'workspace.starts') },
                  { value: 'contains', label: t(lang, 'workspace.contains') },
                  { value: 'regex', label: t(lang, 'workspace.regex') },
                ]}
                onChange={(matchMode) => update(rule.id, { matchMode })}
              />
              <span className="text-[10.5px] text-muted">
                {rule.matchMode === 'exact'
                  ? 'Message must match the trigger word exactly.'
                  : rule.matchMode === 'startsWith'
                  ? 'Message starts with the trigger word.'
                  : rule.matchMode === 'contains'
                  ? 'Trigger word can appear anywhere inside the message.'
                  : 'Treats trigger word as a regular expression.'}
              </span>
            </div>

            {/* Optional Channel Points Trigger */}
            <div className="md:col-span-2 flex flex-col gap-2 rounded-md border border-purple-500/20 bg-purple-500/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Coins size={13} className="text-purple-400" />
                  <span className="font-medium text-[12px] text-foreground">
                    {lang === 'ar' ? 'ربط بنقاط القناة (Twitch Channel Points)' : 'Twitch Channel Points Trigger'}
                  </span>
                </div>
                {rule.channelPointsRewardId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update(rule.id, { channelPointsRewardId: '', channelPointsRewardTitle: '' })}
                    className="h-5 px-1.5 text-[10px] text-muted hover:text-red-400"
                  >
                    {lang === 'ar' ? 'إلغاء الربط' : 'Clear'}
                  </Button>
                )}
              </div>
              <p className="text-[10.5px] text-muted">
                {lang === 'ar'
                  ? 'يمكن للمشاهدين استبدال هذه المكافأة وكتابة سؤال للذكاء الاصطناعي ليرد عليهم فوراً في الشات.'
                  : 'Viewers can redeem this reward to ask questions and receive instant AI answers in chat.'}
              </p>

              {twitchRewards.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 items-center">
                  {twitchRewards.map((reward) => {
                    const isSelected = rule.channelPointsRewardId === reward.id;
                    return (
                      <button
                        key={reward.id}
                        type="button"
                        onClick={() => update(rule.id, {
                          channelPointsRewardId: isSelected ? '' : reward.id,
                          channelPointsRewardTitle: isSelected ? '' : reward.title,
                        })}
                        className={`rounded border px-2 py-1 text-[11px] font-sans flex items-center gap-1.5 transition-colors ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/25 text-purple-300 font-bold shadow-xs'
                            : 'border-rule bg-surface-2 text-muted hover:border-rule/80 hover:text-foreground'
                        }`}
                      >
                        <Coins size={10} className="text-amber-400" />
                        <span>{reward.title}</span>
                        <span className="font-mono text-[9.5px] opacity-60">({reward.cost} pts)</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={rule.channelPointsRewardId ?? ''}
                    onChange={(e) => update(rule.id, { channelPointsRewardId: e.target.value })}
                    placeholder={lang === 'ar' ? 'معرّف المكافأة (Reward ID)...' : 'Twitch Custom Reward ID...'}
                    className="h-7 text-[11px] font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Agent Persona, Identity & Instructions */}
        <section className="flex flex-col gap-4 rounded-lg border border-rule bg-surface-3 p-4">
          <div className="flex items-start justify-between border-b border-rule pb-3">
            <div>
              <h2 className="font-semibold text-[13px] tracking-tight flex items-center gap-2">
                <Bot size={15} className="text-purple-400" />
                <span>{t(lang, 'aiStudio.agentPersonaTitle')}</span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                  <Check size={10} />
                  <span>{t(lang, 'aiStudio.instructionsSaved')}</span>
                </span>
              </h2>
              <p className="text-[11px] text-muted mt-0.5">
                {t(lang, 'aiStudio.agentPersonaSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const isAr = lang === 'ar';
                  const matched = PERSONA_PRESETS.find(
                    (p) =>
                      p.name.toLowerCase() === (rule.agentName || '').toLowerCase() ||
                      p.nameAr === rule.agentName
                  ) || PERSONA_PRESETS[0];
                  update(rule.id, {
                    agentName: isAr ? (matched.nameAr || matched.name) : matched.name,
                    agentRole: isAr ? matched.roleAr : matched.roleEn,
                    aiInstructions: isAr ? matched.instructionsAr : matched.instructionsEn,
                    agentContext: isAr ? matched.contextAr : matched.contextEn,
                  });
                }}
                className="h-6 px-2 text-[10.5px] border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 me-1"
                title={t(lang, lang === 'ar' ? 'aiStudio.localizeArabic' : 'aiStudio.localizeEnglish')}
              >
                <Sparkles size={10} className="me-1 text-purple-300" />
                <span>{t(lang, lang === 'ar' ? 'aiStudio.localizeArabic' : 'aiStudio.localizeEnglish')}</span>
              </Button>

              <span className="text-[10px] text-muted">Insert:</span>
              {['{username}', '{mention}', '{message}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleInsertToken(token)}
                  className="rounded border border-rule bg-surface px-1.5 py-0.5 font-mono text-[10px] hover:border-accent hover:text-accent transition-colors"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Persona Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-rule/80 bg-surface/50 p-2.5">
            <span className="font-mono text-[10.5px] text-muted me-1 flex items-center gap-1">
              <Sparkles size={11} className="text-accent-text" />
              <span>{t(lang, 'aiStudio.presetTitle')}:</span>
            </span>

            {/* Arrodes Built-in Preset */}
            {PERSONA_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  const nameText = lang === 'ar' ? (preset.nameAr || preset.name) : preset.name;
                  const roleText = lang === 'ar' ? preset.roleAr : preset.roleEn;
                  const instText = lang === 'ar' ? preset.instructionsAr : preset.instructionsEn;
                  const ctxText = lang === 'ar' ? preset.contextAr : preset.contextEn;
                  update(rule.id, {
                    agentName: nameText,
                    agentRole: roleText,
                    aiInstructions: instText,
                    agentContext: ctxText || '',
                  });
                  useAutoReplyStore.getState().flush(rule.id);
                }}
                className="rounded-md border border-rule bg-surface-2/80 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-purple-500/60 hover:bg-purple-500/10 hover:text-purple-300 transition-colors cursor-pointer"
              >
                {t(lang, preset.labelKey)}
              </button>
            ))}

            {/* Custom User Presets */}
            {customPresets.map((cp) => (
              <div
                key={cp.id}
                className="inline-flex items-center rounded-md border border-purple-500/40 bg-purple-500/10 text-purple-200 text-[11px] font-medium transition-colors hover:border-purple-500/70 shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => {
                    update(rule.id, {
                      agentName: cp.agentName,
                      agentRole: cp.agentRole,
                      agentContext: cp.agentContext,
                      aiInstructions: cp.aiInstructions,
                    });
                    useAutoReplyStore.getState().flush(rule.id);
                  }}
                  className="px-2 py-1 hover:text-white cursor-pointer"
                  title={cp.agentRole ? `${cp.name}: ${cp.agentRole}` : cp.name}
                >
                  <span>✨ {cp.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = customPresets.filter((p) => p.id !== cp.id);
                    setCustomPresets(next);
                    saveCustomPresets(next);
                  }}
                  className="pe-1.5 ps-0.5 text-muted hover:text-red-400 transition-colors cursor-pointer"
                  title={t(lang, 'aiStudio.deletePreset')}
                >
                  <X size={11} />
                </button>
              </div>
            ))}

            <div className="h-4 w-px bg-rule/70 mx-0.5" />

            {/* Save Current as Preset Button / Inline Input */}
            {isSavingPreset ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  value={presetTitleInput}
                  onChange={(e) => setPresetTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConfirmSavePreset();
                    } else if (e.key === 'Escape') {
                      setIsSavingPreset(false);
                    }
                  }}
                  placeholder={t(lang, 'aiStudio.presetNamePlaceholder')}
                  className="h-7 w-36 text-[11px]"
                />
                <Button
                  size="sm"
                  onClick={handleConfirmSavePreset}
                  className="h-7 px-2 text-[11px] bg-purple-600 hover:bg-purple-500 text-white"
                >
                  <Check size={11} className="me-1" />
                  <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsSavingPreset(false)}
                  className="h-7 px-1.5 text-[11px] text-muted hover:text-foreground"
                >
                  <X size={11} />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPresetTitleInput(rule.agentName || (lang === 'ar' ? 'قالب مخصص' : 'Custom Preset'));
                  setIsSavingPreset(true);
                }}
                className="h-7 px-2 text-[10.5px] border-dashed border-purple-500/50 bg-purple-500/5 text-purple-300 hover:bg-purple-500/15"
                title={t(lang, 'aiStudio.savePresetTitle')}
              >
                <Plus size={11} className="me-1" />
                <span>{t(lang, 'aiStudio.savePreset')}</span>
              </Button>
            )}

            {presetFeedback && (
              <span className="text-[11px] text-emerald-400 font-medium ms-1">
                {presetFeedback}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left Column: Form inputs */}
            <div className="flex flex-col gap-3.5">
              {/* Agent Name */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[12px] text-foreground flex items-center gap-1.5">
                    <Bot size={13} className="text-purple-400" />
                    <span>{t(lang, 'aiStudio.agentName')}</span>
                  </label>
                  {rule.agentName && (
                    <span className="font-mono text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                      @{rule.agentName}
                    </span>
                  )}
                </div>
                <Input
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  value={rule.agentName ?? ''}
                  onChange={(e) => update(rule.id, { agentName: e.target.value })}
                  onBlur={() => useAutoReplyStore.getState().flush(rule.id)}
                  placeholder={t(lang, 'aiStudio.agentNamePlaceholder')}
                  className="h-8 text-[12px]"
                />
                <span className="text-[10px] text-muted">
                  {t(lang, 'aiStudio.agentNameHint')}
                </span>
              </div>

              {/* Agent Role & Persona */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[12px] text-foreground">
                  {t(lang, 'aiStudio.agentRole')}
                </label>
                <textarea
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  rows={2}
                  value={rule.agentRole ?? ''}
                  onChange={(e) => update(rule.id, { agentRole: e.target.value })}
                  onBlur={() => useAutoReplyStore.getState().flush(rule.id)}
                  placeholder={t(lang, 'aiStudio.agentRolePlaceholder')}
                  className="w-full rounded border border-rule bg-surface p-2 text-[11.5px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans resize-none"
                />
                <span className="text-[10px] text-muted">
                  {t(lang, 'aiStudio.agentRoleHint')}
                </span>
              </div>

              {/* Stream Lore & Context Facts */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[12px] text-foreground flex items-center gap-1.5">
                  <BookOpen size={13} className="text-sky-400" />
                  <span>{t(lang, 'aiStudio.agentContext')}</span>
                </label>
                <textarea
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  rows={3}
                  value={rule.agentContext ?? ''}
                  onChange={(e) => update(rule.id, { agentContext: e.target.value })}
                  onBlur={() => useAutoReplyStore.getState().flush(rule.id)}
                  placeholder={t(lang, 'aiStudio.agentContextPlaceholder')}
                  className="w-full rounded border border-rule bg-surface p-2 text-[11.5px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
                />
                <span className="text-[10px] text-muted">
                  {t(lang, 'aiStudio.agentContextHint')}
                </span>
              </div>

              {/* Rules & Custom Instructions */}
              <div className="flex flex-col gap-1.5">
                <label className="font-medium text-[12px] text-foreground">
                  {t(lang, 'aiStudio.instructionsLabel')}
                </label>
                <textarea
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  rows={4}
                  value={rule.aiInstructions ?? ''}
                  onChange={(e) => update(rule.id, { aiInstructions: e.target.value })}
                  onBlur={() => useAutoReplyStore.getState().flush(rule.id)}
                  placeholder={t(lang, 'aiStudio.instructionsPlaceholder')}
                  className="w-full rounded border border-rule bg-surface p-2.5 text-[11.5px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
                />
              </div>
            </div>

            {/* Right Column: Live Agent Card & Simulation Output */}
            <div className="flex flex-col justify-between rounded-lg border border-purple-500/30 bg-purple-500/5 p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs border border-purple-500/30">
                      {rule.agentName ? rule.agentName[0]?.toUpperCase() : '🤖'}
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] text-purple-200">
                        {rule.agentName || (lang === 'ar' ? 'مساعد الذكاء الاصطناعي' : 'AI Assistant')}
                      </div>
                      <div className="text-[10px] text-muted truncate max-w-[200px]">
                        {rule.agentRole || (lang === 'ar' ? 'مساعد البث' : 'Twitch Stream Co-Host')}
                      </div>
                    </div>
                  </div>
                  {lastTestOutput && (
                    <span className="text-[9.5px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Simulated Output
                    </span>
                  )}
                </div>

                {/* Agent Summary Cards */}
                <div className="flex flex-col gap-1.5 text-[11px] bg-surface/60 rounded-md border border-rule/70 p-2.5 font-sans">
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-purple-300 shrink-0">{lang === 'ar' ? 'الهوية:' : 'Identity:'}</span>
                    <span className="text-foreground/90">{rule.agentRole || (lang === 'ar' ? 'مساعد بث تفاعلي' : 'Engaging Twitch co-host')}</span>
                  </div>
                  {rule.agentContext && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-sky-300 shrink-0">{lang === 'ar' ? 'القصص والمعلومات:' : 'Lore:'}</span>
                      <span className="text-foreground/80 line-clamp-2">{rule.agentContext}</span>
                    </div>
                  )}
                  {rule.aiInstructions && (
                    <div className="flex items-start gap-1.5">
                      <span className="font-semibold text-emerald-300 shrink-0">{lang === 'ar' ? 'التعليمات:' : 'Rules:'}</span>
                      <span className="text-foreground/80 line-clamp-2">{rule.aiInstructions}</span>
                    </div>
                  )}
                </div>

                {/* Simulated Output Box */}
                <div className="my-1 rounded-md border border-rule/60 bg-surface-2/80 p-3 min-h-[60px] flex items-center">
                  {isTesting ? (
                    <span className="text-muted animate-pulse font-mono text-[11px] flex items-center gap-1.5">
                      <Sparkles size={12} className="text-purple-400 animate-spin" />
                      Generating reply as {rule.agentName || 'Agent'} via {provider === 'openrouter' ? 'OpenRouter' : 'Groq'}…
                    </span>
                  ) : lastTestOutput ? (
                    <div className="flex flex-col gap-1 w-full">
                      <span className="font-mono text-[10px] text-muted">Response:</span>
                      <span className="text-[12.5px] font-medium text-foreground">&ldquo;{lastTestOutput}&rdquo;</span>
                    </div>
                  ) : (
                    <span className="italic text-muted text-[11.5px]">
                      {rule.agentName
                        ? `${rule.agentName} is ready! Click "Run Test" in the top bar to simulate how they respond to @${testUser}.`
                        : 'Configure your agent persona on the left and click "Run Test" to see live simulation.'}
                    </span>
                  )}
                </div>

                {/* Interactive Question Input */}
                <div className="flex items-center gap-1.5 mt-1">
                  <Input
                    dir="auto"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleTestSimulate();
                      }
                    }}
                    placeholder={lang === 'ar' ? 'اكتب سؤالاً للتجربة (مثال: كم درجة الحرارة في حائل؟)' : 'Type a question to test (e.g. Weather in Hail?)...'}
                    className="h-7 text-[11px] font-sans"
                  />
                  <Button
                    size="sm"
                    onClick={handleTestSimulate}
                    disabled={isTesting}
                    className="h-7 border border-purple-500/40 bg-purple-600 hover:bg-purple-500 text-white px-2.5 text-[11px] shrink-0"
                  >
                    <Play size={10} className="fill-current me-1" />
                    <span>{isTesting ? '…' : (lang === 'ar' ? 'اسأل' : 'Ask')}</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-purple-500/20 pt-2.5 font-mono text-[10px] text-muted">
                <span>Engine: {provider === 'openrouter' ? 'OpenRouter' : 'Groq'}</span>
                <span>{rule.aiModel ?? (provider === 'openrouter' ? 'qwen/qwen3.8-27b:free' : 'openai/gpt-oss-20b')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: AI Engine, Model & API Settings */}
        <section className="flex flex-col gap-3 rounded-lg border border-rule bg-surface-3 p-4">
          <div className="border-b border-rule pb-2">
            <h3 className="font-semibold text-[13px] tracking-tight">
              {t(lang, 'aiStudio.modelSettings')}
            </h3>
            <p className="text-[11px] text-muted">
              Configure provider, model selection, token budget, and offline fallback
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Provider & Model */}
            <div className="flex flex-col gap-2.5 rounded-md border border-rule/80 bg-surface/60 p-3">
              <span className="font-medium text-[12px] text-foreground">
                {t(lang, 'workspace.provider')}
              </span>
              <SegmentedControl
                name="aiProvider"
                value={provider}
                options={[
                  { value: 'groq', label: 'Groq (Default)' },
                  { value: 'openrouter', label: 'OpenRouter' },
                ]}
                onChange={(aiProvider) =>
                  update(rule.id, {
                    aiProvider,
                    aiModel:
                      aiProvider === 'groq'
                        ? 'llama-3.1-8b-instant'
                        : 'qwen/qwen3.8-27b:free',
                  })
                }
              />

              <span className="font-medium text-[12px] text-foreground mt-1">
                {t(lang, 'workspace.model')}
              </span>
              <Input
                dir="ltr"
                className="font-mono text-[11px] h-7"
                value={rule.aiModel ?? (provider === 'openrouter' ? 'qwen/qwen3.8-27b:free' : 'llama-3.1-8b-instant')}
                onChange={(e) => update(rule.id, { aiModel: e.target.value })}
              />
              <div className="flex flex-wrap gap-1">
                {MODEL_PRESETS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] transition-colors ${
                      rule.aiModel === m.value
                        ? 'border-purple-500/50 bg-purple-500/15 text-[#c4b5fd]'
                        : 'border-rule bg-surface-2 text-muted hover:border-accent hover:text-ink'
                    }`}
                    onClick={() => update(rule.id, { aiModel: m.value, aiProvider: m.provider })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Token limits & Offline Fallback */}
            <div className="flex flex-col gap-3 rounded-md border border-rule/80 bg-surface/60 p-3">
              <div>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="font-medium text-foreground">
                    {t(lang, 'autoReplies.aiMaxTokens')}
                  </span>
                  <span className="font-mono text-muted text-[11px]">
                    {rule.aiMaxTokens ?? 120} tokens
                  </span>
                </div>
                <Slider
                  min={40}
                  max={240}
                  step={10}
                  value={rule.aiMaxTokens ?? 120}
                  onChange={(aiMaxTokens) => update(rule.id, { aiMaxTokens })}
                  ariaLabel={t(lang, 'autoReplies.aiMaxTokens')}
                />
                <div className="flex justify-between font-mono text-[9.5px] text-muted mt-1">
                  <span>40 tokens (Short)</span>
                  <span>240 tokens (Long)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-hair space-y-1">
                <span className="font-medium text-[12px] text-foreground">
                  {t(lang, 'workspace.fallback')}
                </span>
                <Input
                  dir="auto"
                  className="h-7 text-[11px]"
                  placeholder="Message to send if AI service is unavailable..."
                  value={rule.aiFallback ?? ''}
                  onChange={(e) => update(rule.id, { aiFallback: e.target.value })}
                />
              </div>

              <div className="pt-2 border-t border-hair flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-[12px] text-foreground">
                    <Globe size={13} className="text-sky-400" />
                    <span>{t(lang, 'autoReplies.aiWebSearch')}</span>
                  </div>
                  <p className="text-[10px] text-muted">
                    {t(lang, 'autoReplies.aiWebSearchHint')}
                  </p>
                </div>
                <Switch
                  checked={rule.aiWebSearch ?? true}
                  onChange={(aiWebSearch) => update(rule.id, { aiWebSearch })}
                  label={t(lang, 'autoReplies.aiWebSearch')}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Specific Chatter Overrides (Priority 1) */}
        <ChatterOverridesSection rule={rule} update={update} lang={lang} />

        {/* Section 5: Permission & Cooldowns */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Card 1: AI Global Limits (Master Protection across all AI commands) */}
          <div className="flex flex-col justify-between rounded-lg border border-purple-500/40 bg-purple-500/5 p-4 shadow-sm">
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-purple-500/20 pb-2.5">
                <div>
                  <h3 className="font-semibold text-[13px] tracking-tight flex items-center gap-1.5 text-purple-200">
                    <Sparkles size={14} className="text-purple-400" />
                    <span>{t(lang, 'aiStudio.globalLimitsTitle')}</span>
                  </h3>
                  <p className="text-[10.5px] text-muted mt-0.5">
                    {t(lang, 'aiStudio.globalLimitsHint')}
                  </p>
                </div>
                <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 font-mono text-[9.5px] font-bold text-purple-300 shrink-0">
                  {t(lang, 'aiStudio.globalLimitsBadge')}
                </span>
              </div>

              {/* Global AI Cooldown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Clock size={12} className="text-purple-400" />
                    <span>{t(lang, 'aiStudio.globalAiCooldownShort')}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={3600}
                      value={globalSettings.globalAiCooldownSeconds || 0}
                      onChange={(e) =>
                        updateGlobalSettings({
                          globalAiCooldownSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-6 w-16 text-center font-mono text-[11px]"
                    />
                    <span className="font-mono text-muted text-[11px]">s</span>
                  </div>
                </div>

                <Slider
                  value={globalSettings.globalAiCooldownSeconds || 0}
                  min={0}
                  max={180}
                  step={5}
                  onChange={(v) => updateGlobalSettings({ globalAiCooldownSeconds: v })}
                  ariaLabel={t(lang, 'aiStudio.globalAiCooldownShort')}
                />

                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-muted me-1">{t(lang, 'aiStudio.quickPresets')}</span>
                  {[0, 5, 10, 15, 30, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateGlobalSettings({ globalAiCooldownSeconds: sec })}
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors border ${
                        (globalSettings.globalAiCooldownSeconds || 0) === sec
                          ? 'border-purple-500/60 bg-purple-500/25 text-purple-200 font-bold'
                          : 'border-rule bg-surface-2 text-muted hover:border-accent hover:text-foreground'
                      }`}
                    >
                      {sec === 0 ? '0s (Off)' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Global AI User Cooldown */}
              <div className="space-y-2 pt-3 border-t border-purple-500/20">
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-medium text-foreground flex items-center gap-1">
                    <Shield size={12} className="text-purple-400" />
                    <span>{t(lang, 'aiStudio.globalAiUserCooldownShort')}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={3600}
                      value={globalSettings.globalAiUserCooldownSeconds ?? 60}
                      onChange={(e) =>
                        updateGlobalSettings({
                          globalAiUserCooldownSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-6 w-16 text-center font-mono text-[11px]"
                    />
                    <span className="font-mono text-muted text-[11px]">s</span>
                  </div>
                </div>

                <Slider
                  value={globalSettings.globalAiUserCooldownSeconds ?? 60}
                  min={0}
                  max={300}
                  step={5}
                  onChange={(v) => updateGlobalSettings({ globalAiUserCooldownSeconds: v })}
                  ariaLabel={t(lang, 'aiStudio.globalAiUserCooldownShort')}
                />

                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-muted me-1">{t(lang, 'aiStudio.quickPresets')}</span>
                  {[0, 30, 60, 120, 300].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateGlobalSettings({ globalAiUserCooldownSeconds: sec })}
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors border ${
                        (globalSettings.globalAiUserCooldownSeconds ?? 60) === sec
                          ? 'border-purple-500/60 bg-purple-500/25 text-purple-200 font-bold'
                          : 'border-rule bg-surface-2 text-muted hover:border-accent hover:text-foreground'
                      }`}
                    >
                      {sec === 0 ? '0s (Off)' : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: This Command Settings (Permission Rank & Rule Cooldown) */}
          <div className="flex flex-col justify-between gap-4 rounded-lg border border-rule bg-surface-3 p-4">
            {/* Permission Rank */}
            <div className="space-y-2">
              <div className="border-b border-rule pb-2">
                <h3 className="font-semibold text-[13px]">{t(lang, 'workspace.who')}</h3>
                <p className="text-[11px] text-muted">Minimum rank required to trigger this AI reply</p>
              </div>
              <SegmentedControl
                value={rule.minimumRank ?? 'everyone'}
                options={rankOptions}
                onChange={(minimumRank) => update(rule.id, { minimumRank })}
              />
            </div>

            {/* Specific Command Cooldown */}
            <div className="space-y-3 pt-2 border-t border-rule">
              <div>
                <h3 className="font-semibold text-[13px]">{t(lang, 'aiStudio.ruleCooldownTitle')}</h3>
                <p className="text-[11px] text-muted">{t(lang, 'aiStudio.ruleCooldownHint')}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium">{t(lang, 'workspace.cooldown')}:</span>
                  <div className="flex items-center gap-1">
                    <Input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={3600}
                      value={rule.cooldownSeconds || 0}
                      onChange={(e) =>
                        update(rule.id, {
                          cooldownSeconds: Math.max(0, Math.min(3600, Number(e.target.value) || 0)),
                        })
                      }
                      className="h-6 w-16 text-center font-mono text-[11px]"
                    />
                    <span className="font-mono text-muted text-[11px]">s</span>
                  </div>
                </div>
                <Slider
                  value={rule.cooldownSeconds || 0}
                  min={0}
                  max={300}
                  step={5}
                  onChange={(v) => update(rule.id, { cooldownSeconds: v })}
                  ariaLabel="Cooldown"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-hair">
                <span className="text-[11px] font-medium">{t(lang, 'autoReplies.userCooldown')}:</span>
                <div className="flex items-center gap-1">
                  <Input
                    dir="ltr"
                    type="number"
                    min={0}
                    max={3600}
                    value={rule.userCooldownSeconds ?? 0}
                    onChange={(e) =>
                      update(rule.id, {
                        userCooldownSeconds: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="h-7 w-20 text-center font-mono text-[11px]"
                  />
                  <span className="text-[11px] text-muted">s</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Output Actions & Sinks */}
        <section className="flex flex-col gap-4 rounded-lg border border-rule bg-surface-3 p-4">
          <div className="border-b border-rule pb-2">
            <h3 className="font-semibold text-[13px]">{t(lang, 'workspace.writesTo')}</h3>
            <p className="text-[11px] text-muted">Outputs updated when this AI reply triggers</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 rounded border border-rule bg-surface p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare size={15} className="text-purple-400" />
                  <div>
                    <div className="text-[12px] font-semibold">{t(lang, 'workspace.chatReply')}</div>
                    <div className="text-[11px] text-muted">Post generated AI response directly to Twitch chat</div>
                  </div>
                </div>
                <Switch
                  checked={rule.responseEnabled !== false}
                  onChange={(checked) => update(rule.id, { responseEnabled: checked })}
                  label={t(lang, 'workspace.chatReply')}
                />
              </div>

              {rule.responseEnabled !== false && (
                <div className="pt-3 border-t border-rule/70 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-semibold text-foreground">
                        {t(lang, 'autoReplies.whoResponds')}
                      </span>
                      <span className="text-[10.5px] text-muted">
                        • {t(lang, 'autoReplies.whoRespondsHint')}
                      </span>
                    </div>
                    {rule.senderRole === 'bot' && !botConnected && (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                        <AlertCircle size={11} />
                        {t(lang, 'autoReplies.senderBotOffline')}
                      </span>
                    )}
                  </div>
                  <SegmentedControl
                    name={`ai-sender-role-${rule.id}`}
                    value={rule.senderRole ?? 'default'}
                    options={[
                      {
                        value: 'default',
                        label: t(lang, 'autoReplies.senderDefault', {
                          sender: activeChatSender === 'bot' ? (botLogin || 'Bot') : (twitchChannel || 'Streamer'),
                        }),
                      },
                      {
                        value: 'broadcaster',
                        label: `👑 ${t(lang, 'autoReplies.senderBroadcaster')}${twitchChannel ? ` (@${twitchChannel})` : ''}`,
                      },
                      {
                        value: 'bot',
                        label: `🤖 ${t(lang, 'autoReplies.senderBot')}${botLogin ? ` (@${botLogin})` : ''}`,
                      },
                    ]}
                    onChange={(val) => update(rule.id, { senderRole: val as 'default' | 'bot' | 'broadcaster' })}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded border border-rule bg-surface p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Tv size={15} className="text-amber-500" />
                  <div>
                    <div className="text-[12px] font-semibold">{t(lang, 'workspace.streamTitle')}</div>
                    <div className="text-[11px] text-muted">Dynamically update Twitch stream title on trigger</div>
                  </div>
                </div>
                <Switch
                  checked={rule.titleActionEnabled ?? false}
                  onChange={(checked) => update(rule.id, { titleActionEnabled: checked })}
                  label={t(lang, 'workspace.streamTitle')}
                />
              </div>

              {rule.titleActionEnabled && (
                <div className="border-t border-hair pt-3">
                  <TriggerTitleAction rule={rule} lang={lang} update={update} />
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
