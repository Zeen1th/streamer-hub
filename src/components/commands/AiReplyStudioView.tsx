import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Cpu,
  Info,
  Plus,
  Send,
  Sparkles,
  Terminal,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  AiUserRestriction,
  AutoReply,
  ChatMessage,
  PermissionLevel,
} from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import {
  checkUserRestriction,
  normalizeUsername,
} from '../../lib/autoReplyRules';
import { useAutoReplyStore } from '../../store/autoReplyStore';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Field } from '../ui/Field';
import { Switch } from '../ui/Switch';

interface AiReplyStudioViewProps {
  rule: AutoReply;
  onBack: () => void;
  lang: 'en' | 'ar';
}

const MODEL_PRESETS = [
  { label: 'Llama 3.1 8B (Groq · Recommended)', value: 'llama-3.1-8b-instant', provider: 'groq' as const },
  { label: 'Llama 3.3 70B (Groq · Powerful)', value: 'llama-3.3-70b-versatile', provider: 'groq' as const },
  { label: 'GPT-OSS 20B (Groq)', value: 'openai/gpt-oss-20b', provider: 'groq' as const },
  { label: 'Llama 3.2 3B (OpenRouter · Free)', value: 'meta-llama/llama-3.2-3b-instruct:free', provider: 'openrouter' as const },
];

export function AiReplyStudioView({ rule, onBack, lang }: AiReplyStudioViewProps) {
  const update = useAutoReplyStore((s) => s.update);
  const targetUsers: string[] = rule.aiTargetUsers ?? [];
  const restriction: AiUserRestriction = rule.aiUserRestriction ?? 'none';
  const provider = rule.aiProvider ?? 'groq';

  // Tag input state for user targeting
  const [tagInput, setTagInput] = useState('');

  // Live Playground simulation state
  const [simUser, setSimUser] = useState(targetUsers[0] ? `@${targetUsers[0]}` : 'kirin_x_');
  const [simMessage, setSimMessage] = useState(
    rule.triggers[0] ? `!${rule.triggers[0]}` : 'hello',
  );
  const [testState, setTestState] = useState<{
    loading: boolean;
    output?: string;
    error?: string;
    status?: 'allowed' | 'skipped' | 'blocked';
    reason?: string;
  }>({ loading: false });

  // Escape key to navigate back
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const BackIcon = lang === 'ar' ? ChevronLeft : ArrowLeft;

  // Add chatter username chip
  const handleAddUserTag = () => {
    const clean = normalizeUsername(tagInput);
    if (!clean) return;
    if (!targetUsers.includes(clean)) {
      update(rule.id, { aiTargetUsers: [...targetUsers, clean] });
    }
    setTagInput('');
  };

  // Remove chatter username chip
  const handleRemoveUserTag = (userToRemove: string) => {
    update(rule.id, {
      aiTargetUsers: targetUsers.filter((u) => u !== userToRemove),
    });
  };

  // Trigger words management
  const setTrigger = (index: number, val: string) => {
    update(rule.id, {
      triggers: rule.triggers.map((tr, i) => (i === index ? val : tr)),
    });
  };

  const addTrigger = () => {
    update(rule.id, { triggers: [...rule.triggers, ''] });
  };

  const removeTrigger = (index: number) => {
    if (rule.triggers.length <= 1) return;
    update(rule.id, { triggers: rule.triggers.filter((_, i) => i !== index) });
  };

  // Live Playground simulation
  const handleRunTest = async () => {
    setTestState({ loading: true });

    const cleanSimUser = normalizeUsername(simUser) || 'viewer';
    const mockMsg: ChatMessage = {
      id: 'sim-' + Date.now(),
      username: cleanSimUser,
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: simMessage.trim() || 'hello',
      timestamp: new Date().toISOString(),
      emotes: [],
    };

    // 1. Check chatter restriction eligibility
    const isAllowed = checkUserRestriction(restriction, targetUsers, cleanSimUser);
    if (!isAllowed) {
      if (restriction === 'allowlist') {
        setTestState({
          loading: false,
          status: 'skipped',
          reason: `Skipped: This AI reply only triggers for ${targetUsers.map((u) => `@${u}`).join(', ') || 'listed users'}. @${cleanSimUser} was ignored.`,
        });
      } else {
        setTestState({
          loading: false,
          status: 'blocked',
          reason: `Blocked: @${cleanSimUser} is on the blocklist for this AI reply.`,
        });
      }
      return;
    }

    // 2. Generate live response using rule's persona prompt
    try {
      await rpc.invoke(Channels.AutoRepliesSave, { rule }).catch(() => undefined);
      const result = await rpc.invoke(Channels.AutoRepliesGenerate, {
        ruleId: rule.id,
        send: false,
        message: mockMsg,
      });

      if (result.ok && result.message) {
        setTestState({
          loading: false,
          status: 'allowed',
          output: result.message,
        });
      } else {
        setTestState({
          loading: false,
          status: 'allowed',
          error: result.error ?? 'AI did not return a response. Check API keys in settings.',
        });
      }
    } catch (err) {
      setTestState({
        loading: false,
        status: 'allowed',
        error: String(err),
      });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      {/* Top Sub-Header Toolbar */}
      <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-rule bg-surface px-3">
        <Button size="sm" variant="outline" onClick={onBack} title={t(lang, 'workspace.backToCommands')}>
          <BackIcon size={13} className="text-accent-text" />
          <span className="font-bold">{t(lang, 'workspace.backToCommands')}</span>
        </Button>

        <span aria-hidden className="mx-1 h-[22px] w-px bg-rule" />

        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={13} className="text-accent-text shrink-0" />
          <span className="truncate font-sans text-[13px] font-extrabold text-ink">
            {rule.triggers[0] ? `!${rule.triggers[0]}` : t(lang, 'workspace.untitled')}
          </span>
          <span className="font-sans text-[11px] text-muted hidden sm:inline">
            · {t(lang, 'aiStudio.title')}
          </span>
        </div>

        {/* Right Status Badges & Active Toggle */}
        <div className="ms-auto flex items-center gap-2">
          <Switch
            checked={rule.enabled}
            onChange={(enabled) => update(rule.id, { enabled })}
            label={rule.enabled ? t(lang, 'common.active') : t(lang, 'workspace.paused')}
          />
          <span className="rounded-md border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] uppercase font-bold text-accent-text">
            {provider === 'groq' ? 'Groq' : 'OpenRouter'}
          </span>
          <span className="rounded-md border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-muted hidden md:inline truncate max-w-[160px]">
            {rule.aiModel ?? 'llama-3.1-8b-instant'}
          </span>
          <span className="rounded-md border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-muted hidden sm:inline">
            {rule.aiMaxTokens ?? 120} tok
          </span>
        </div>
      </div>

      {/* Main Studio Scroll Canvas */}
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-5 xl:p-6 space-y-6">
        {/* Banner Section */}
        <div className="border-b border-rule pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-sans text-base font-bold tracking-tight text-ink flex items-center gap-2">
                <Bot size={18} className="text-accent-text" />
                <span>{t(lang, 'aiStudio.title')}</span>
                <span className="text-muted text-[13px] font-normal">
                  ({rule.triggers.map((tr) => (tr ? `!${tr}` : '')).filter(Boolean).join(', ') || 'No trigger set'})
                </span>
              </h2>
              <p className="font-sans text-[12px] text-muted mt-0.5">
                {t(lang, 'aiStudio.studioSubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Command Triggers & Quick Triggers/Cooldown */}
        <div className="rounded-lg border border-rule bg-surface-3 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-hair pb-2">
            <h3 className="font-sans text-[13px] font-bold text-ink tracking-wide flex items-center gap-2">
              <Terminal size={15} className="text-accent-text" />
              <span>Command Triggers & Activation</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Triggers List */}
            <div className="space-y-2">
              <label className="ui-label">{t(lang, 'workspace.triggerWord')}</label>
              <div className="space-y-1.5">
                {rule.triggers.map((trigger, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      dir="auto"
                      className="h-8 font-mono text-[12px]"
                      value={trigger}
                      onChange={(e) => setTrigger(idx, e.target.value)}
                      placeholder={idx === 0 ? 'welcome' : 'hi'}
                    />
                    {rule.triggers.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTrigger(idx)}
                        title="Remove trigger"
                      >
                        <X size={12} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addTrigger}>
                  <Plus size={12} />
                  <span>{t(lang, 'workspace.addTrigger')}</span>
                </Button>
              </div>
            </div>

            {/* Match Mode & Permissions */}
            <div className="space-y-4">
              <Field label={t(lang, 'workspace.matchMode')}>
                <SegmentedControl
                  name={`matchMode-${rule.id}`}
                  value={rule.matchMode}
                  options={[
                    { value: 'exact', label: t(lang, 'workspace.exact') },
                    { value: 'startsWith', label: t(lang, 'workspace.starts') },
                    { value: 'contains', label: t(lang, 'workspace.contains') },
                  ]}
                  onChange={(matchMode) => update(rule.id, { matchMode })}
                />
              </Field>

              <div className="space-y-3">
                <Field label="Trigger Rank">
                  <SegmentedControl
                    name={`rank-${rule.id}`}
                    value={rule.minimumRank ?? 'everyone'}
                    options={[
                      { value: 'everyone', label: 'All' },
                      { value: 'vip', label: 'VIP' },
                      { value: 'mod', label: 'Mod' },
                      { value: 'broadcaster', label: 'Host' },
                    ]}
                    onChange={(rank) => update(rule.id, { minimumRank: rank as PermissionLevel })}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Global Cooldown · ${rule.cooldownSeconds}s`}>
                    <Slider
                      min={0}
                      max={120}
                      step={5}
                      value={rule.cooldownSeconds}
                      onChange={(cooldownSeconds) => update(rule.id, { cooldownSeconds })}
                      ariaLabel="Global cooldown"
                    />
                  </Field>

                  <Field label={`User Cooldown · ${rule.userCooldownSeconds ?? 0}s`}>
                    <Input
                      dir="ltr"
                      type="number"
                      min={0}
                      max={3600}
                      className="h-8 font-mono text-[11.5px]"
                      value={rule.userCooldownSeconds ?? 0}
                      onChange={(event) =>
                        update(rule.id, {
                          userCooldownSeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)),
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Chatter Access (Who can trigger) */}
        <div className="rounded-lg border border-rule bg-surface-3 p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="font-sans text-[13px] font-bold text-ink tracking-wide flex items-center gap-2">
              <UserCheck size={15} className="text-accent-text" />
              <span>{t(lang, 'aiStudio.userRestrictions')}</span>
            </h3>
            <p className="font-sans text-[11px] text-muted">
              {t(lang, 'aiStudio.userRestrictionsHint')}
            </p>
          </div>

          <SegmentedControl
            name={`${rule.id}-restriction`}
            value={restriction}
            options={[
              { value: 'none', label: t(lang, 'aiStudio.restrictEveryone') },
              { value: 'allowlist', label: t(lang, 'aiStudio.restrictAllowlist') },
              { value: 'blocklist', label: t(lang, 'aiStudio.restrictBlocklist') },
            ]}
            onChange={(res) => update(rule.id, { aiUserRestriction: res })}
          />

          {restriction !== 'none' && (
            <div className="space-y-3 border-t border-hair pt-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    dir="ltr"
                    className="h-8 font-mono text-[12px] ps-6"
                    placeholder={t(lang, 'aiStudio.userTagsPlaceholder')}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUserTag();
                      }
                    }}
                  />
                  <span className="absolute start-2 top-1/2 -translate-y-1/2 font-mono text-muted text-[11px]">
                    @
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={handleAddUserTag}>
                  <Plus size={12} />
                  <span>{t(lang, 'aiStudio.addUser')}</span>
                </Button>
              </div>

              {/* Tag Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {targetUsers.length === 0 ? (
                  <span className="font-sans text-[11px] text-muted italic">
                    {t(lang, 'aiStudio.noTargetUsers')}
                  </span>
                ) : (
                  targetUsers.map((user) => (
                    <span
                      key={user}
                      className="flex items-center gap-1.5 rounded-md border border-rule bg-surface-2 px-2.5 py-1 font-mono text-[11.5px] font-bold text-ink shadow-xs"
                    >
                      <span className="text-accent-text">@{user}</span>
                      <button
                        type="button"
                        className="text-muted hover:text-accent-text transition-colors"
                        onClick={() => handleRemoveUserTag(user)}
                        title={`Remove @${user}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Friendly Tip Box */}
              <div className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent-soft p-2.5 text-[11.5px] text-ink">
                <Info size={14} className="text-accent-text shrink-0 mt-0.5" />
                <span>{t(lang, 'aiStudio.userTip')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: AI Persona & Instructions (No response presets) */}
        <div className="rounded-lg border border-rule bg-surface-3 p-5 space-y-3 shadow-sm">
          <div>
            <h3 className="font-sans text-[13px] font-bold text-ink tracking-wide">
              {t(lang, 'aiStudio.generalInstructions')}
            </h3>
            <p className="font-sans text-[11px] text-muted">
              {t(lang, 'aiStudio.generalInstructionsHint')}
            </p>
          </div>

          <textarea
            dir="auto"
            rows={5}
            className="w-full resize-y rounded-md border border-rule bg-surface-2 p-3 font-[Cairo] text-[13px] text-ink focus-visible:outline-none focus-visible:border-accent shadow-inner"
            placeholder={t(lang, 'aiStudio.generalInstructionsHint')}
            value={rule.aiInstructions ?? ''}
            onChange={(e) => update(rule.id, { aiInstructions: e.target.value })}
          />
        </div>

        {/* Section 4: Live Interactive Playground & Simulator */}
        <div className="rounded-lg border border-rule bg-surface-3 p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="font-sans text-[13px] font-bold text-ink tracking-wide flex items-center gap-2">
              <Cpu size={15} className="text-accent-text" />
              <span>{t(lang, 'aiStudio.playgroundTitle')}</span>
            </h3>
            <p className="font-sans text-[11px] text-muted">
              {t(lang, 'aiStudio.playgroundSubtitle')}
            </p>
          </div>

          {/* Test Input Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end rounded-lg border border-rule bg-surface-2 p-3.5">
            <div className="sm:col-span-5 space-y-1">
              <label className="ui-label text-[10px]">{t(lang, 'aiStudio.simulatedUser')}</label>
              <div className="relative">
                <span className="absolute start-2 top-1/2 -translate-y-1/2 font-mono text-muted text-[11px]">
                  @
                </span>
                <Input
                  dir="ltr"
                  className="h-8 ps-6 font-mono text-[11.5px]"
                  value={simUser}
                  onChange={(e) => setSimUser(e.target.value)}
                  placeholder="kirin_x_"
                />
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label className="ui-label text-[10px]">{t(lang, 'aiStudio.simulatedMessage')}</label>
              <Input
                dir="auto"
                className="h-8 font-sans text-[11.5px]"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="!welcome"
              />
            </div>

            <div className="sm:col-span-3">
              <Button
                size="sm"
                className="w-full h-8 font-bold"
                disabled={testState.loading}
                onClick={handleRunTest}
              >
                <Send size={12} />
                <span>{testState.loading ? t(lang, 'aiStudio.testing') : t(lang, 'aiStudio.testButton')}</span>
              </Button>
            </div>
          </div>

          {/* Test Output Box */}
          {(testState.output || testState.error || testState.reason || testState.loading) && (
            <div className="rounded-lg border border-rule bg-surface-2 p-4 space-y-2 text-start">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] uppercase font-bold text-muted">
                    Chatter Match:
                  </span>
                  {testState.status === 'allowed' ? (
                    <span className="flex items-center gap-1 rounded border border-rule bg-surface-3 px-2 py-0.5 font-mono text-[10.5px] font-bold text-ink">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>{t(lang, 'aiStudio.statusAllowed')}</span>
                    </span>
                  ) : testState.status === 'skipped' ? (
                    <span className="flex items-center gap-1 rounded border border-rule bg-surface-3 px-2 py-0.5 font-mono text-[10.5px] font-bold text-amber-500">
                      <AlertCircle size={12} />
                      <span>{t(lang, 'aiStudio.statusSkipped')}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded border border-rule bg-surface-3 px-2 py-0.5 font-mono text-[10.5px] font-bold text-accent-text">
                      <AlertCircle size={12} />
                      <span>{t(lang, 'aiStudio.statusBlocked')}</span>
                    </span>
                  )}
                </div>
              </div>

              {testState.loading ? (
                <div className="flex items-center gap-2 py-2 font-mono text-[11px] text-muted animate-pulse">
                  <Sparkles size={13} className="text-accent-text" />
                  <span>Generating AI response via {provider === 'groq' ? 'Groq' : 'OpenRouter'}…</span>
                </div>
              ) : testState.reason ? (
                <div className="font-sans text-[12px] text-muted italic py-1">
                  {testState.reason}
                </div>
              ) : testState.error ? (
                <div className="flex items-center gap-2 text-accent-text font-mono text-[11px]">
                  <AlertCircle size={14} />
                  <span>{testState.error}</span>
                </div>
              ) : (
                <div className="font-sans text-[13px] text-ink font-bold pt-1">
                  &ldquo;{testState.output}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Engine, Model & Limits */}
        <div className="rounded-lg border border-rule bg-surface-3 p-5 space-y-4 shadow-sm">
          <div>
            <h3 className="font-sans text-[13px] font-bold text-ink tracking-wide">
              {t(lang, 'aiStudio.modelSettings')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <Field label={t(lang, 'workspace.provider')}>
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
                      aiModel: aiProvider === 'groq' ? 'llama-3.1-8b-instant' : 'meta-llama/llama-3.2-3b-instruct:free',
                    })
                  }
                />
              </Field>

              <Field label={t(lang, 'workspace.model')}>
                <div className="space-y-1.5">
                  <Input
                    dir="ltr"
                    className="font-mono text-[11px] h-8"
                    value={rule.aiModel ?? 'llama-3.1-8b-instant'}
                    onChange={(e) => update(rule.id, { aiModel: e.target.value })}
                  />
                  <div className="flex flex-wrap gap-1">
                    {MODEL_PRESETS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        className="rounded border border-rule bg-surface-2 px-2 py-0.5 font-mono text-[9.5px] text-muted hover:border-accent hover:text-ink transition-colors"
                        onClick={() => update(rule.id, { aiModel: m.value, aiProvider: m.provider })}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            </div>

            <div className="space-y-4">
              <Field label={`${t(lang, 'autoReplies.aiMaxTokens')} · ${rule.aiMaxTokens ?? 120}`}>
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[10px] text-muted">
                    <span>40 tokens (Short)</span>
                    <span>240 tokens (Long)</span>
                  </div>
                  <Slider
                    min={40}
                    max={240}
                    step={10}
                    value={rule.aiMaxTokens ?? 120}
                    onChange={(aiMaxTokens) => update(rule.id, { aiMaxTokens })}
                    ariaLabel={t(lang, 'autoReplies.aiMaxTokens')}
                  />
                </div>
              </Field>

              <Field label={t(lang, 'workspace.fallback')}>
                <Input
                  dir="auto"
                  className="h-8 font-sans text-[11.5px]"
                  placeholder="Message to send if AI is unreachable"
                  value={rule.aiFallback ?? ''}
                  onChange={(e) => update(rule.id, { aiFallback: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
