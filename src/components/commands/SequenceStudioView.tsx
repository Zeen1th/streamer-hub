import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  CommandSequence,
  CounterAction,
  ModerationAction,
  SequenceStepType,
  SequenceTriggerType,
  SequenceWaitUnit,
} from '../../rpc/contracts';
import { useSequenceStore } from '../../store/sequenceStore';
import { useCounterStore } from '../../store/counterStore';
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Field } from '../ui/Field';
import { Switch } from '../ui/Switch';

interface SequenceStudioViewProps {
  sequence: CommandSequence;
  onBack: () => void;
  lang: 'en' | 'ar';
}

const STEP_ICONS: Record<SequenceStepType, React.ElementType> = {
  chat: MessageSquare,
  wait: Clock,
  counter: Calculator,
  command: Terminal,
  moderation: Shield,
};

export function SequenceStudioView({ sequence, onBack, lang }: SequenceStudioViewProps) {
  const update = useSequenceStore((s) => s.update);
  const addStep = useSequenceStore((s) => s.addStep);
  const updateStep = useSequenceStore((s) => s.updateStep);
  const removeStep = useSequenceStore((s) => s.removeStep);
  const moveStep = useSequenceStore((s) => s.moveStep);
  const runSequence = useSequenceStore((s) => s.runSequence);
  const availableRewards = useSequenceStore((s) => s.availableRewards);
  const fetchAvailableRewards = useSequenceStore((s) => s.fetchAvailableRewards);
  const isLoadingRewards = useSequenceStore((s) => s.isLoadingRewards);
  const activeRunningSequenceId = useSequenceStore((s) => s.activeRunningSequenceId);
  const activeRunningStepIndex = useSequenceStore((s) => s.activeRunningStepIndex);

  const counters = useCounterStore((s) => s.counters);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [testUser, setTestUser] = useState('StreamViewer');
  const [testTarget, setTestTarget] = useState('');
  const [testStatus, setTestStatus] = useState<{
    status: 'success' | 'error' | 'running';
    message: string;
  } | null>(null);

  const isExecuting = activeRunningSequenceId === sequence.id;

  useEffect(() => {
    void fetchAvailableRewards();
  }, [fetchAvailableRewards]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack]);

  const handleRunTest = async (overrideTarget?: string) => {
    if (isExecuting) return;
    const rawTarget = (overrideTarget !== undefined ? overrideTarget : testTarget).trim();
    const formattedInput = rawTarget ? (rawTarget.startsWith('@') ? rawTarget : `@${rawTarget}`) : '';

    setTestStatus({
      status: 'running',
      message: t(lang, 'sequence.running'),
    });

    const res = await runSequence(sequence.id, {
      username: testUser.trim() || 'StreamViewer',
      userInput: formattedInput,
      source: 'test',
    });

    if (res) {
      setTestStatus({
        status: 'success',
        message: rawTarget
          ? (lang === 'ar' ? `✓ تم تنفيذ التسلسل بنجاح على ${formattedInput}` : `✓ Sequence executed successfully on ${formattedInput}!`)
          : (lang === 'ar' ? '✓ تم تنفيذ جميع الخطوات بنجاح' : `✓ Sequence executed successfully!`),
      });
    } else {
      setTestStatus({
        status: 'error',
        message: lang === 'ar' ? 'فشل تنفيذ التسلسل' : 'Sequence execution failed',
      });
    }
  };

  const handleSelectRewardPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const reward = availableRewards.find((r) => r.id === selectedId);
    if (reward) {
      update(sequence.id, {
        rewardId: reward.id,
        rewardTitle: reward.title,
      });
    }
  };

  const handleInsertToken = (stepId: string, token: string) => {
    const step = sequence.steps.find((s) => s.id === stepId);
    if (!step) return;
    const current = step.chatMessage || '';
    updateStep(sequence.id, stepId, {
      chatMessage: current ? `${current} ${token}` : token,
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
          reason: 'Channel Points Timeout by {username}',
        },
        {
          id: crypto.randomUUID(),
          type: 'chat',
          chatMessage: '✅ @{target} has been timed out! (Will be safely re-modded if they are a mod).',
        },
      ],
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface font-sans text-foreground">
      {/* Sub-Header Banner */}
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-rule bg-surface/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={onBack} title={t(lang, 'sequence.back')}>
            <ArrowLeft size={13} />
            <span>{t(lang, 'sequence.back')}</span>
          </Button>

          <div className="h-4 w-px bg-rule" />

          <div className="flex items-center gap-2">
            <Coins size={16} className="text-amber-500" />
            <Input
              value={sequence.name}
              onChange={(e) => update(sequence.id, { name: e.target.value })}
              className="h-7 w-52 font-semibold text-[13px]"
              placeholder={t(lang, 'sequence.namePlaceholder')}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={sequence.enabled}
              onChange={(checked) => update(sequence.id, { enabled: checked })}
              label={t(lang, 'sequence.enabled')}
            />
            <span className="font-mono text-[11px] text-muted">
              {sequence.enabled ? t(lang, 'workspace.enable') : t(lang, 'workspace.disable')}
            </span>
          </div>

          <div className="h-4 w-px bg-rule" />

          {/* Quick Target Input */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.testTargetLabel')}:</span>
            <div className="relative">
              <span className="absolute start-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">@</span>
              <Input
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleRunTest();
                }}
                placeholder={t(lang, 'sequence.testTargetPlaceholder')}
                className="h-7 w-40 ps-5 font-mono text-[11px]"
              />
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => void handleRunTest()}
            disabled={isExecuting || !sequence.enabled}
            className="border border-emerald-500/40 bg-emerald-600/90 text-white hover:bg-emerald-600"
          >
            {isExecuting ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                <span>{t(lang, 'sequence.running')}</span>
              </>
            ) : (
              <>
                <Play size={12} className="fill-current" />
                <span>{t(lang, 'sequence.runTest')}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        {/* Test & Simulation Sandbox */}
        <section className="rounded-lg border border-rule bg-surface-3 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
            <div className="flex items-center gap-2">
              <Play size={15} className="text-emerald-500" />
              <div>
                <h2 className="font-semibold text-[13px] tracking-tight">{t(lang, 'sequence.testBarTitle')}</h2>
                <p className="text-[11px] text-muted">{t(lang, 'sequence.testBarSubtitle')}</p>
              </div>
            </div>

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

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-4 flex flex-col gap-1">
              <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simulatedChatter')}</label>
              <Input
                value={testUser}
                onChange={(e) => setTestUser(e.target.value)}
                placeholder="StreamViewer"
                className="h-8 font-sans text-[12px]"
              />
            </div>

            <div className="sm:col-span-8 flex flex-col gap-1">
              <label className="font-mono text-[10.5px] text-muted">{t(lang, 'sequence.simulatedTarget')}</label>
              <div className="relative">
                <span className="absolute start-2.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted">@</span>
                <Input
                  value={testTarget}
                  onChange={(e) => setTestTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRunTest();
                  }}
                  placeholder={t(lang, 'sequence.testTargetPlaceholder')}
                  className="h-8 ps-6 font-mono text-[12px]"
                />
              </div>
            </div>
          </div>

          {testStatus && (
            <div
              className={`mt-3 flex items-center justify-between rounded-md border p-2.5 text-[12px] font-mono ${
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
                className="text-[11px] text-muted hover:text-ink px-1"
              >
                ✕
              </button>
            </div>
          )}
        </section>

        {/* Section 1: Trigger Configuration */}
        <section className="rounded-lg border border-rule bg-surface-3 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-rule pb-3">
            <div>
              <h2 className="font-semibold text-[13px] tracking-tight">{t(lang, 'sequence.triggerSection')}</h2>
              <p className="text-[11px] text-muted">{t(lang, 'sequence.triggerType')}</p>
            </div>
            <SegmentedControl<SequenceTriggerType>
              value={sequence.triggerType}
              onChange={(val) => update(sequence.id, { triggerType: val })}
              options={[
                { value: 'channel_points', label: t(lang, 'sequence.channelPoints') },
                { value: 'chat', label: t(lang, 'sequence.chatCommand') },
                { value: 'both', label: t(lang, 'sequence.bothTriggers') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Channel Points trigger settings */}
            {(sequence.triggerType === 'channel_points' || sequence.triggerType === 'both') && (
              <div className="flex flex-col gap-3 rounded-md border border-rule/80 bg-surface/60 p-3">
                <div className="flex items-center gap-1.5 font-medium text-[12px] text-amber-500">
                  <Coins size={14} />
                  <span>{t(lang, 'sequence.rewardTitle')}</span>
                </div>

                {availableRewards.length > 0 && (
                  <Field label={t(lang, 'sequence.rewardSelect')}>
                    <select
                      className="h-8 w-full rounded border border-rule bg-surface px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      value={sequence.rewardId || ''}
                      onChange={handleSelectRewardPreset}
                      disabled={isLoadingRewards}
                    >
                      <option value="">-- {t(lang, 'sequence.rewardSelectPlaceholder')} --</option>
                      {availableRewards.map((reward) => (
                        <option key={reward.id} value={reward.id}>
                          {reward.title} ({reward.cost} pts)
                        </option>
                      ))}
                    </select>
                  </Field>
                )}

                <Field label={t(lang, 'sequence.rewardTitle')} hint={t(lang, 'sequence.rewardTitleHint')}>
                  <Input
                    value={sequence.rewardTitle ?? ''}
                    onChange={(e) => update(sequence.id, { rewardTitle: e.target.value })}
                    placeholder="e.g. Hydrate"
                    className="h-8 text-[12px]"
                  />
                </Field>
              </div>
            )}

            {/* Chat command trigger settings */}
            {(sequence.triggerType === 'chat' || sequence.triggerType === 'both') && (
              <div className="flex flex-col gap-3 rounded-md border border-rule/80 bg-surface/60 p-3">
                <div className="flex items-center gap-1.5 font-medium text-[12px] text-accent">
                  <Terminal size={14} />
                  <span>{t(lang, 'sequence.chatTrigger')}</span>
                </div>

                <Field label={t(lang, 'sequence.chatTrigger')} hint={t(lang, 'sequence.chatTriggerHint')}>
                  <Input
                    value={sequence.chatTrigger ?? ''}
                    onChange={(e) => update(sequence.id, { chatTrigger: e.target.value })}
                    placeholder="!hydrate"
                    className="h-8 font-mono text-[12px]"
                  />
                </Field>
              </div>
            )}

            {/* Cooldown */}
            <div className="flex flex-col gap-2 rounded-md border border-rule/80 bg-surface/60 p-3 md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[12px]">{t(lang, 'sequence.cooldown')}</span>
                <span className="font-mono text-[11px] text-muted">{sequence.cooldownSeconds || 0}s</span>
              </div>
              <Slider
                value={sequence.cooldownSeconds || 0}
                min={0}
                max={300}
                step={5}
                onChange={(v) => update(sequence.id, { cooldownSeconds: v })}
                ariaLabel={t(lang, 'sequence.cooldown')}
              />
            </div>
          </div>
        </section>

        {/* Section 2: The Command Stack */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-[14px]">
                <Sparkles size={16} className="text-accent" />
                {t(lang, 'sequence.stackTitle')}
              </h2>
              <p className="text-[11px] text-muted">{t(lang, 'sequence.stackSubtitle')}</p>
            </div>

            <div className="relative flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAppendSmartTimeoutPreset}
                className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                title={t(lang, 'sequence.presetSmartTimeoutDesc')}
              >
                <Zap size={13} className="text-amber-400" />
                <span>{t(lang, 'sequence.presetSmartTimeout')}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => addStep(sequence.id, 'moderation')}
                className="border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
              >
                <Shield size={13} />
                <span>{t(lang, 'sequence.addModeration')}</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => addStep(sequence.id, 'wait')}
                className="border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              >
                <Clock size={13} />
                <span>{t(lang, 'sequence.addWait')}</span>
              </Button>

              <div className="relative">
                <Button size="sm" onClick={() => setShowAddMenu(!showAddMenu)}>
                  <Plus size={13} />
                  <span>{t(lang, 'sequence.addAction')}</span>
                  <ChevronDown size={11} className="ms-1 opacity-70" />
                </Button>

                {showAddMenu && (
                  <div className="absolute end-0 top-full z-30 mt-1 w-52 rounded-md border border-rule bg-surface-3 p-1 shadow-lg">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-surface-hover transition-colors"
                      onClick={() => {
                        addStep(sequence.id, 'moderation');
                        setShowAddMenu(false);
                      }}
                    >
                      <Shield size={13} className="text-rose-500" />
                      <span>{t(lang, 'sequence.stepModeration')}</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-surface-hover transition-colors"
                      onClick={() => {
                        addStep(sequence.id, 'chat');
                        setShowAddMenu(false);
                      }}
                    >
                      <MessageSquare size={13} className="text-sky-500" />
                      <span>{t(lang, 'sequence.stepChat')}</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-surface-hover transition-colors"
                      onClick={() => {
                        addStep(sequence.id, 'counter');
                        setShowAddMenu(false);
                      }}
                    >
                      <Calculator size={13} className="text-emerald-500" />
                      <span>{t(lang, 'sequence.stepCounter')}</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-[12px] hover:bg-surface-hover transition-colors"
                      onClick={() => {
                        addStep(sequence.id, 'command');
                        setShowAddMenu(false);
                      }}
                    >
                      <Terminal size={13} className="text-violet-500" />
                      <span>{t(lang, 'sequence.stepCommand')}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cards List */}
          {sequence.steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-rule p-8 text-center">
              <Sparkles size={24} className="mb-2 text-muted" />
              <p className="max-w-md text-[12px] text-muted">{t(lang, 'sequence.emptyStack')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAppendSmartTimeoutPreset}
                  className="border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                >
                  <Zap size={12} className="text-amber-400" />
                  <span>{t(lang, 'sequence.presetSmartTimeout')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep(sequence.id, 'moderation')}>
                  <Shield size={12} className="text-rose-400" />
                  <span>{t(lang, 'sequence.stepModeration')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep(sequence.id, 'chat')}>
                  <MessageSquare size={12} className="text-sky-500" />
                  <span>{t(lang, 'sequence.stepChat')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep(sequence.id, 'wait')}>
                  <Clock size={12} className="text-amber-500" />
                  <span>{t(lang, 'sequence.stepWait')}</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => addStep(sequence.id, 'counter')}>
                  <Calculator size={12} className="text-emerald-500" />
                  <span>{t(lang, 'sequence.stepCounter')}</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sequence.steps.map((step, index) => {
                const Icon = STEP_ICONS[step.type] || Terminal;
                const isStepActive = isExecuting && activeRunningStepIndex === index;

                return (
                  <div
                    key={step.id}
                    className={`relative rounded-lg border transition-all ${
                      isStepActive
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500'
                        : step.type === 'wait'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : step.type === 'moderation'
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-rule bg-surface/80'
                    }`}
                  >
                    {/* Card Top Bar */}
                    <div className="flex items-center justify-between border-b border-rule/60 px-3 py-2 text-[12px]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-2 font-mono font-bold text-[10px] text-muted">
                          #{index + 1}
                        </span>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Icon
                            size={14}
                            className={
                              step.type === 'wait'
                                ? 'text-amber-500'
                                : step.type === 'chat'
                                ? 'text-sky-500'
                                : step.type === 'counter'
                                ? 'text-emerald-500'
                                : step.type === 'moderation'
                                ? 'text-rose-500'
                                : 'text-violet-500'
                            }
                          />
                          <span>
                            {step.type === 'wait'
                              ? t(lang, 'sequence.stepWait')
                              : step.type === 'chat'
                              ? t(lang, 'sequence.stepChat')
                              : step.type === 'counter'
                              ? t(lang, 'sequence.stepCounter')
                              : step.type === 'moderation'
                              ? t(lang, 'sequence.stepModeration')
                              : t(lang, 'sequence.stepCommand')}
                          </span>
                        </div>

                        {isStepActive && (
                          <span className="animate-pulse rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                            {t(lang, 'sequence.activeRunning')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveStep(sequence.id, index, 'up')}
                          title={t(lang, 'sequence.moveUp')}
                        >
                          <ChevronUp size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={index === sequence.steps.length - 1}
                          onClick={() => moveStep(sequence.id, index, 'down')}
                          title={t(lang, 'sequence.moveDown')}
                        >
                          <ChevronDown size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStep(sequence.id, step.id)}
                          className="text-red-400 hover:text-red-300"
                          title={t(lang, 'sequence.deleteStep')}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>

                    {/* Card Content based on type */}
                    <div className="p-3">
                      {step.type === 'wait' && (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-muted">{t(lang, 'sequence.duration')}:</span>
                            <Input
                              type="number"
                              min={1}
                              max={3600}
                              value={step.waitDuration ?? 3}
                              onChange={(e) =>
                                updateStep(sequence.id, step.id, {
                                  waitDuration: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="h-8 w-20 text-center font-mono text-[12px]"
                            />
                            <select
                              value={step.waitUnit || 'seconds'}
                              onChange={(e) =>
                                updateStep(sequence.id, step.id, {
                                  waitUnit: e.target.value as SequenceWaitUnit,
                                })
                              }
                              className="h-8 rounded border border-rule bg-surface px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              <option value="seconds">{t(lang, 'sequence.seconds')}</option>
                              <option value="minutes">{t(lang, 'sequence.minutes')}</option>
                            </select>
                          </div>

                          <span className="font-mono text-[11px] text-muted/80">
                            ⏳ Pauses for {step.waitDuration ?? 3} {step.waitUnit || 'seconds'}
                          </span>
                        </div>
                      )}

                      {step.type === 'chat' && (
                        <div className="flex flex-col gap-2">
                          <textarea
                            rows={2}
                            value={step.chatMessage ?? ''}
                            onChange={(e) =>
                              updateStep(sequence.id, step.id, {
                                chatMessage: e.target.value,
                              })
                            }
                            placeholder={t(lang, 'sequence.chatPlaceholder')}
                            className="w-full rounded border border-rule bg-surface p-2 text-[12px] text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-accent"
                          />
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted">Insert:</span>
                            {['{username}', '{mention}', '{input}'].map((token) => (
                              <button
                                key={token}
                                type="button"
                                onClick={() => handleInsertToken(step.id, token)}
                                className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] hover:border-accent hover:text-accent transition-colors"
                              >
                                {token}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.type === 'counter' && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label={t(lang, 'sequence.counterSelect')}>
                            <select
                              value={step.counterId || ''}
                              onChange={(e) =>
                                updateStep(sequence.id, step.id, {
                                  counterId: e.target.value,
                                })
                              }
                              className="h-8 w-full rounded border border-rule bg-surface px-2 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                              <option value="">-- Choose Counter --</option>
                              {counters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} (Current: {c.count})
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label={t(lang, 'sequence.counterAction')}>
                            <SegmentedControl<CounterAction>
                              value={step.counterAction || 'increase'}
                              onChange={(val) =>
                                updateStep(sequence.id, step.id, {
                                  counterAction: val,
                                })
                              }
                              options={[
                                { value: 'increase', label: t(lang, 'sequence.increase') },
                                { value: 'decrease', label: t(lang, 'sequence.decrease') },
                                { value: 'reset', label: t(lang, 'sequence.reset') },
                              ]}
                            />
                          </Field>
                        </div>
                      )}

                      {step.type === 'command' && (
                        <Field label={t(lang, 'sequence.stepCommand')}>
                          <Input
                            value={step.commandTrigger ?? ''}
                            onChange={(e) =>
                              updateStep(sequence.id, step.id, {
                                commandTrigger: e.target.value,
                              })
                            }
                            placeholder={t(lang, 'sequence.commandPlaceholder')}
                            className="h-8 font-mono text-[12px]"
                          />
                        </Field>
                      )}

                      {step.type === 'moderation' && (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field label={t(lang, 'sequence.modAction')}>
                              <select
                                value={step.moderationAction || 'smart_timeout'}
                                onChange={(e) =>
                                  updateStep(sequence.id, step.id, {
                                    moderationAction: e.target.value as ModerationAction,
                                  })
                                }
                                className="h-8 w-full rounded border border-rule bg-surface px-2 text-[12px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                              >
                                <option value="smart_timeout">{t(lang, 'sequence.actionSmartTimeout')}</option>
                                <option value="timeout">{t(lang, 'sequence.actionTimeout')}</option>
                                <option value="ban">{t(lang, 'sequence.actionBan')}</option>
                                <option value="unban">{t(lang, 'sequence.actionUnban')}</option>
                                <option value="mod">{t(lang, 'sequence.actionMod')}</option>
                                <option value="unmod">{t(lang, 'sequence.actionUnmod')}</option>
                                <option value="vip">{t(lang, 'sequence.actionVip')}</option>
                                <option value="unvip">{t(lang, 'sequence.actionUnvip')}</option>
                                <option value="clear_chat">{t(lang, 'sequence.actionClearChat')}</option>
                                <option value="shoutout">{t(lang, 'sequence.actionShoutout')}</option>
                              </select>
                            </Field>

                            {step.moderationAction !== 'clear_chat' && (
                              <Field
                                label={t(lang, 'sequence.targetUser')}
                                hint={t(lang, 'sequence.targetUserHint')}
                              >
                                <div className="flex flex-col gap-1.5">
                                  <Input
                                    value={step.targetUser ?? '{input}'}
                                    onChange={(e) =>
                                      updateStep(sequence.id, step.id, {
                                        targetUser: e.target.value,
                                      })
                                    }
                                    placeholder="{input} or @username"
                                    className="h-8 font-mono text-[12px]"
                                  />
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted">Insert:</span>
                                    {['{input}', '{target}', '{username}'].map((token) => (
                                      <button
                                        key={token}
                                        type="button"
                                        onClick={() =>
                                          updateStep(sequence.id, step.id, {
                                            targetUser: token,
                                          })
                                        }
                                        className="rounded border border-rule bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] hover:border-accent hover:text-accent transition-colors"
                                      >
                                        {token}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </Field>
                            )}
                          </div>

                          {(step.moderationAction === 'smart_timeout' ||
                            step.moderationAction === 'timeout' ||
                            !step.moderationAction) && (
                            <div className="flex flex-col gap-2 rounded-md border border-rule/80 bg-surface/60 p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[12px]">{t(lang, 'sequence.modDuration')}</span>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    {[10, 30, 60, 120, 300, 600].map((sec) => (
                                      <button
                                        key={sec}
                                        type="button"
                                        onClick={() =>
                                          updateStep(sequence.id, step.id, { durationSeconds: sec })
                                        }
                                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                                          (step.durationSeconds ?? 60) === sec
                                            ? 'border border-rose-500/40 bg-rose-500/20 text-rose-400'
                                            : 'bg-surface-2 text-muted hover:text-foreground'
                                        }`}
                                      >
                                        {sec}s
                                      </button>
                                    ))}
                                  </div>
                                  <span className="font-mono text-[11px] text-muted">
                                    {step.durationSeconds ?? 60}s
                                  </span>
                                </div>
                              </div>
                              <Slider
                                value={step.durationSeconds ?? 60}
                                min={5}
                                max={1800}
                                step={5}
                                onChange={(v) =>
                                  updateStep(sequence.id, step.id, { durationSeconds: v })
                                }
                                ariaLabel={t(lang, 'sequence.modDuration')}
                              />

                              {step.moderationAction === 'smart_timeout' && (
                                <div className="mt-1 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                                  <Zap size={14} className="mt-0.5 shrink-0 text-amber-400" />
                                  <span>
                                    {t(lang, 'sequence.smartModNotice', { s: String(step.durationSeconds ?? 60) })}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {step.moderationAction !== 'clear_chat' && (
                            <Field label={t(lang, 'sequence.modReason')}>
                              <Input
                                value={step.reason ?? ''}
                                onChange={(e) =>
                                  updateStep(sequence.id, step.id, {
                                    reason: e.target.value,
                                  })
                                }
                                placeholder={t(lang, 'sequence.modReasonPlaceholder')}
                                className="h-8 text-[12px]"
                              />
                            </Field>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
