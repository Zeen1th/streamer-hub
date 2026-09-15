import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  MessageSquare,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import type { AutoReply, ChatMessage, PermissionLevel } from '../../rpc/contracts';
import { Channels } from '../../rpc/contracts';
import { rpc } from '../../rpc';
import { useAutoReplyStore } from '../../store/autoReplyStore';
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

interface ReplyStudioViewProps {
  rule: AutoReply;
  onBack: () => void;
  onSwitchToAi?: () => void;
  lang: 'en' | 'ar';
}

const RANKS: PermissionLevel[] = ['everyone', 'subscriber', 'vip', 'mod', 'broadcaster'];

export function ReplyStudioView({
  rule,
  onBack,
  onSwitchToAi,
  lang,
}: ReplyStudioViewProps) {
  const update = useAutoReplyStore((s) => s.update);
  const remove = useAutoReplyStore((s) => s.remove);
  const [newTriggerInput, setNewTriggerInput] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [testUser, setTestUser] = useState('viewer');

  // Escape key to navigate back
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

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
    const current = rule.response || '';
    update(rule.id, {
      response: current ? `${current} ${token}` : token,
    });
  };

  const handleTestSimulate = async () => {
    const cleanSimUser = testUser.trim().replace(/^@+/, '') || 'viewer';
    const mockMsg: ChatMessage = {
      id: 'sim-' + Date.now(),
      username: cleanSimUser,
      isBroadcaster: false,
      isMod: false,
      isVip: false,
      isSubscriber: false,
      message: rule.triggers[0] ? `!${rule.triggers[0]}` : 'hello',
      timestamp: new Date().toISOString(),
      emotes: [],
    };

    const plan = evaluateRuleExecution(rule, mockMsg);
    if (plan.type === 'ignore') {
      useLogStore.getState().add({
        kind: 'system',
        message: `[Simulated Reply] Silenced/Ignored for @${cleanSimUser} (Chatter Override)`,
      });
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
        });
        const out = res.ok && res.message ? res.message : `[AI response with instructions: "${plan.instructions}"]`;
        useLogStore.getState().add({
          kind: 'chat',
          message: `[Simulated AI Reply for @${cleanSimUser}] ${out}`,
        });
      } catch {
        useLogStore.getState().add({
          kind: 'chat',
          message: `[Simulated AI Reply for @${cleanSimUser}] Generated AI response with instructions: "${plan.instructions}"`,
        });
      }
      setTestSent(true);
      setTimeout(() => setTestSent(false), 2500);
      return;
    }

    const previewText = renderAutoReply(plan.text, mockMsg);
    const tag = plan.isOverride ? `[Simulated Override for @${cleanSimUser}]` : `[Simulated Reply for @${cleanSimUser}]`;
    useLogStore.getState().add({
      kind: 'chat',
      message: `${tag} ${previewText}`,
    });

    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const preview = (rule.response || '')
    .replace(/\{username\}/gi, 'viewer')
    .replace(/\{mention\}/gi, '@viewer')
    .replace(/\{message\}/gi, rule.triggers[0] || 'hello');

  const rankOptions: SegmentedOption<PermissionLevel>[] = RANKS.map((value) => ({
    value,
    label: t(lang, `ranks.${value}`),
  }));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface font-sans text-foreground">
      {/* Sticky Sub-Header Banner */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-rule bg-surface/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={onBack} title={t(lang, 'sequence.back')}>
            <BackIcon size={13} />
            <span>{t(lang, 'sequence.back')}</span>
          </Button>

          <div className="h-4 w-px bg-rule" />

          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-sky-500" />
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
              className="h-6 border border-sky-500/40 bg-sky-600/90 text-white hover:bg-sky-600 px-2 text-[11px]"
            >
              <Play size={11} className="fill-current me-1" />
              <span>{testSent ? '✓ Simulated!' : t(lang, 'sequence.runTest')}</span>
            </Button>
          </div>

          {onSwitchToAi && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                update(rule.id, { responseMode: 'ai' });
                onSwitchToAi();
              }}
              className="border-accent/40 bg-accent-soft text-accent-text hover:border-accent"
              title={t(lang, 'aiStudio.openStudio')}
            >
              <Sparkles size={12} className="text-accent-text" />
              <span>{t(lang, 'workspace.ai')}</span>
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
                Configure chat words that activate this prepared reply
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted">{t(lang, 'workspace.responseType')}:</span>
              <SegmentedControl<'static' | 'ai'>
                value={rule.responseMode ?? 'static'}
                onChange={(mode) => {
                  update(rule.id, { responseMode: mode });
                  if (mode === 'ai' && onSwitchToAi) {
                    onSwitchToAi();
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
          </div>
        </section>

        {/* Section 2: Response Composer & Live Preview */}
        <section className="flex flex-col gap-3 rounded-lg border border-rule bg-surface-3 p-4">
          <div className="flex items-center justify-between border-b border-rule pb-2">
            <h2 className="font-semibold text-[13px] tracking-tight">
              {t(lang, 'workspace.response')}
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted">Insert:</span>
              {['{username}', '{mention}', '{message}'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => handleInsertToken(token)}
                  className="rounded border border-rule bg-surface px-1.5 py-0.5 font-mono text-[10px] hover:border-accent hover:text-accent"
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <textarea
                rows={4}
                value={rule.response}
                onChange={(e) => update(rule.id, { response: e.target.value })}
                placeholder={t(lang, 'workspace.response')}
                className="w-full rounded border border-rule bg-surface p-3 text-[12px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent font-sans"
              />
            </div>

            {/* Live Chat Preview Bubble */}
            <div className="flex flex-col justify-between rounded border border-sky-500/30 bg-sky-500/5 p-3">
              <div className="flex items-center gap-2 border-b border-sky-500/20 pb-2 text-[11px] font-semibold text-sky-400">
                <MessageSquare size={13} />
                <span>Live Chat Preview</span>
              </div>
              <div className="my-2 min-h-[40px] text-[12px] text-foreground">
                {preview || <span className="italic text-muted">No message typed yet...</span>}
              </div>
              <span className="font-mono text-[10px] text-muted">
                Tokens like &#123;username&#125; and &#123;mention&#125; are resolved automatically.
              </span>
            </div>
          </div>
        </section>

        {/* Section 3: Specific Chatter Overrides (Priority 1) */}
        <ChatterOverridesSection rule={rule} update={update} lang={lang} />

        {/* Section 4: Permission & Cooldowns */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Permission Rank */}
          <div className="flex flex-col gap-3 rounded-lg border border-rule bg-surface-3 p-4">
            <div className="border-b border-rule pb-2">
              <h3 className="font-semibold text-[13px]">{t(lang, 'workspace.who')}</h3>
              <p className="text-[11px] text-muted">Minimum rank required to trigger this reply</p>
            </div>
            <SegmentedControl
              value={rule.minimumRank ?? 'everyone'}
              options={rankOptions}
              onChange={(minimumRank) => update(rule.id, { minimumRank })}
            />
          </div>

          {/* Cooldowns */}
          <div className="flex flex-col gap-3 rounded-lg border border-rule bg-surface-3 p-4">
            <div className="border-b border-rule pb-2">
              <h3 className="font-semibold text-[13px]">{t(lang, 'workspace.cooldown')}</h3>
              <p className="text-[11px] text-muted">Global and per-user spam prevention</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium">Global:</span>
                  <span className="font-mono text-muted">{rule.cooldownSeconds || 0}s</span>
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

        {/* Section 5: Output Actions & Sinks */}
        <section className="flex flex-col gap-4 rounded-lg border border-rule bg-surface-3 p-4">
          <div className="border-b border-rule pb-2">
            <h3 className="font-semibold text-[13px]">{t(lang, 'workspace.writesTo')}</h3>
            <p className="text-[11px] text-muted">Outputs updated when this reply triggers</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded border border-rule bg-surface p-3">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={15} className="text-sky-500" />
                <div>
                  <div className="text-[12px] font-semibold">{t(lang, 'workspace.chatReply')}</div>
                  <div className="text-[11px] text-muted">Post message directly to Twitch chat</div>
                </div>
              </div>
              <Switch
                checked={rule.responseEnabled !== false}
                onChange={(checked) => update(rule.id, { responseEnabled: checked })}
                label={t(lang, 'workspace.chatReply')}
              />
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
