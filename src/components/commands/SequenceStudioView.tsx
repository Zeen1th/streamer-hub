import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Edit3,
  Flame,
  Info,
  Layers,
  Megaphone,
  MessageSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
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
import { t } from '../../i18n/translations';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';

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
  onClose: () => void;
}

function EditTriggerModal({ trigger, availableRewards, lang, onSave, onClose }: EditTriggerModalProps) {
  const [enabled, setEnabled] = useState(trigger.enabled);
  const [minViewers, setMinViewers] = useState(trigger.minViewers ?? 1);
  const [chatCommand, setChatCommand] = useState(trigger.chatCommand ?? '!command');
  const [matchMode, setMatchMode] = useState(trigger.matchMode ?? 'startsWith');
  const [rewardTitle, setRewardTitle] = useState(trigger.rewardTitle ?? 'Custom Reward');
  const [rewardId, setRewardId] = useState(trigger.rewardId ?? '');

  const handleApply = () => {
    if (trigger.type === 'twitch_raid') {
      onSave({ enabled, minViewers: Math.max(1, Number(minViewers) || 1) });
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
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {trigger.type === 'twitch_raid' ? (
                <Flame size={15} />
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
                {trigger.type === 'twitch_raid'
                  ? `${t(lang, 'sequence.sourceTwitchChannel')} > ${t(lang, 'sequence.typeChannelRaid')}`
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
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.rewardTitle')}
                </label>
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
                  ? 'Comment / Note'
                  : step.type === 'chat'
                  ? 'Twitch > Send Message'
                  : step.type === 'moderation'
                  ? `Twitch > Moderation (${moderationAction})`
                  : step.type === 'wait'
                  ? 'Core > Delay / Wait'
                  : step.type === 'counter'
                  ? 'Counters > Modify Counter'
                  : 'Core > Run Sub-Command'}
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
                <div className="flex flex-col gap-2 rounded-md border border-white/[0.08] bg-[#11131a] p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] font-medium text-zinc-300">
                      {t(lang, 'sequence.modDuration')}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {[10, 30, 60, 120, 300, 600].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setDurationSeconds(sec)}
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                              durationSeconds === sec
                                ? 'border border-rose-500/40 bg-rose-500/20 text-rose-400'
                                : 'bg-white/5 text-muted hover:text-white'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">{durationSeconds}s</span>
                    </div>
                  </div>
                  <Slider
                    value={durationSeconds}
                    min={5}
                    max={1800}
                    step={5}
                    onChange={setDurationSeconds}
                    ariaLabel={t(lang, 'sequence.modDuration')}
                  />
                  {moderationAction === 'smart_timeout' && (
                    <div className="mt-1 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.duration')}
                </label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={waitDuration}
                  onChange={(e) => setWaitDuration(Math.max(0.1, Number(e.target.value)))}
                  className="h-9 font-mono text-[13px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-sans text-[12px] font-medium text-zinc-300">
                  {t(lang, 'sequence.duration')}
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
  const runSequence = useSequenceStore((s) => s.runSequence);
  const availableRewards = useSequenceStore((s) => s.availableRewards);
  const fetchAvailableRewards = useSequenceStore((s) => s.fetchAvailableRewards);
  const activeRunningSequenceId = useSequenceStore((s) => s.activeRunningSequenceId);
  const activeRunningStepIndex = useSequenceStore((s) => s.activeRunningStepIndex);

  const counters = useCounterStore((s) => s.counters);
  const botAccountEnabled = useConnectionStore((s) => s.botAccountEnabled);
  const botConnected = useConnectionStore((s) => s.botConnected);
  const botLogin = useConnectionStore((s) => s.botLogin);
  const twitchChannel = useConnectionStore((s) => s.twitchChannel);
  const preferredChatSender = useSettingsStore((s) => s.preferredChatSender);
  const setPreferredChatSender = useSettingsStore((s) => s.setPreferredChatSender);

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
  const [simMode, setSimMode] = useState<'raid' | 'chat' | 'points'>('raid');
  const [simRaider, setSimRaider] = useState('EpicRaider');
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
    let source: 'raid' | 'chat' | 'channel_points' | 'test' = 'test';

    if (simMode === 'raid') {
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
    });

    if (res) {
      setTestStatus({
        status: 'success',
        message:
          simMode === 'raid'
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
        return `// ${st.commentText || 'This is a comment!'}`;
      case 'chat':
        return `Twitch: Send Message "${st.chatMessage || ''}"`;
      case 'moderation': {
        const action = st.moderationAction || 'smart_timeout';
        const target = st.targetUser || (action === 'shoutout' ? '{raider}' : '{input}');
        if (action === 'shoutout') return `Twitch: Shoutout ${target}`;
        if (action === 'smart_timeout') return `Twitch: Smart Timeout "${target}" (${st.durationSeconds ?? 60}s)`;
        if (action === 'timeout') return `Twitch: Timeout "${target}" (${st.durationSeconds ?? 60}s)`;
        if (action === 'ban') return `Twitch: Ban "${target}"`;
        if (action === 'clear_chat') return 'Twitch: Clear Chat';
        return `Twitch: Moderation (${action}) on "${target}"`;
      }
      case 'wait':
        return `Core: Wait ${st.waitDuration ?? 2}${st.waitUnit === 'minutes' ? 'm' : 's'}`;
      case 'counter': {
        const matched = counters.find((c) => c.id === st.counterId);
        const name = matched ? matched.name : 'Counter';
        return `Counters: Modify ${name} (${st.counterAction ?? 'increase'})`;
      }
      case 'command':
        return `Core: Run Command "${st.commandTrigger || '!sound'}"`;
    }
  };

  // Trigger search items
  const TRIGGER_SEARCH_ITEMS = [
    {
      type: 'twitch_raid' as ActionTriggerType,
      source: 'Twitch > Channel',
      title: 'Channel Raid',
      desc: 'Triggers when another streamer raids your channel',
      icon: Flame,
      color: 'text-orange-400',
    },
    {
      type: 'twitch_chat' as ActionTriggerType,
      source: 'Core > Commands',
      title: 'Command Triggered',
      desc: 'Triggers when viewer enters a chat command',
      icon: Terminal,
      color: 'text-sky-400',
    },
    {
      type: 'twitch_channel_points' as ActionTriggerType,
      source: 'Twitch > Channel Points',
      title: 'Reward Redemption',
      desc: 'Triggers when a channel points custom reward is redeemed',
      icon: Coins,
      color: 'text-amber-400',
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
      title: '💬 Add Comment / Note',
      desc: 'Visual green comment step for organizing actions',
      icon: MessageSquare,
      color: 'text-emerald-400',
    },
    {
      id: 'chat',
      type: 'chat' as SequenceStepType,
      title: 'Twitch: Send Chat Message',
      desc: 'Post a custom message or alert to Twitch chat',
      icon: MessageSquare,
      color: 'text-sky-400',
    },
    {
      id: 'shoutout',
      type: 'moderation' as SequenceStepType,
      title: 'Twitch: Shoutout Raider / Channel',
      desc: 'Send an official Twitch shoutout (/shoutout)',
      icon: Megaphone,
      color: 'text-orange-400',
      options: { moderationAction: 'shoutout' as ModerationAction, targetUser: '{raider}' },
    },
    {
      id: 'smart_timeout',
      type: 'moderation' as SequenceStepType,
      title: 'Twitch: Smart Timeout (Mods & Lead Mods)',
      desc: 'Temporarily unmods, times out, and automatically re-mods (supports Mods & Lead Mods)',
      icon: Zap,
      color: 'text-amber-400',
      options: { moderationAction: 'smart_timeout' as ModerationAction, targetUser: '{input}', durationSeconds: 60 },
    },
    {
      id: 'timeout',
      type: 'moderation' as SequenceStepType,
      title: 'Twitch: Regular Timeout',
      desc: 'Timeout a target chatter for specified seconds',
      icon: Shield,
      color: 'text-rose-400',
      options: { moderationAction: 'timeout' as ModerationAction, targetUser: '{input}', durationSeconds: 60 },
    },
    {
      id: 'clear_chat',
      type: 'moderation' as SequenceStepType,
      title: 'Twitch: Clear Chat',
      desc: 'Clear the entire Twitch chat room',
      icon: Shield,
      color: 'text-rose-400',
      options: { moderationAction: 'clear_chat' as ModerationAction },
    },
    {
      id: 'wait',
      type: 'wait' as SequenceStepType,
      title: 'Core: Delay / Wait',
      desc: 'Pause execution for specified seconds or minutes',
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      id: 'counter',
      type: 'counter' as SequenceStepType,
      title: 'Counters: Modify Counter',
      desc: 'Increment, decrement, or reset a stream counter',
      icon: Calculator,
      color: 'text-emerald-400',
    },
    {
      id: 'command',
      type: 'command' as SequenceStepType,
      title: 'Core: Run Sub-Command',
      desc: 'Trigger another command or sequence',
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
              <span>Presets</span>
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
            <span>Simulator</span>
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

              <SegmentedControl<'raid' | 'chat' | 'points'>
                value={simMode}
                onChange={setSimMode}
                options={[
                  { value: 'raid', label: `🔥 ${t(lang, 'sequence.simRaid')}` },
                  { value: 'chat', label: `💬 ${t(lang, 'sequence.simChat')}` },
                  { value: 'points', label: `🪙 ${t(lang, 'sequence.simPoints')}` },
                ]}
              />
            </div>

            <div className="mt-3">
              {simMode === 'raid' ? (
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

                {/* + Add Trigger button */}
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setShowAddTriggerMenu(!showAddTriggerMenu)}
                    className="h-7.5 border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11.5px] font-medium"
                  >
                    <Plus size={12} className="me-1" />
                    <span>Add</span>
                    <ChevronDown size={11} className="ms-1 opacity-70" />
                  </Button>

                  {showAddTriggerMenu && (
                    <div className="absolute end-0 top-full z-30 mt-1 w-60 rounded-md border border-[#2e3448] bg-[#161a26] p-1.5 shadow-xl">
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
                          <div className="font-mono text-[10px] text-muted">Twitch &gt; Channel</div>
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
                          <div className="font-mono text-[10px] text-muted">Core &gt; Commands</div>
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
                          <div className="font-mono text-[10px] text-muted">Twitch &gt; Channel Points</div>
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
                        trig.type === 'twitch_raid'
                          ? t(lang, 'sequence.sourceTwitchChannel')
                          : trig.type === 'twitch_chat'
                          ? t(lang, 'sequence.sourceCoreCommands')
                          : t(lang, 'sequence.sourceTwitchPoints');

                      const typeText =
                        trig.type === 'twitch_raid'
                          ? t(lang, 'sequence.typeChannelRaid')
                          : trig.type === 'twitch_chat'
                          ? t(lang, 'sequence.typeCommandTriggered')
                          : t(lang, 'sequence.typeRewardRedemption');

                      const criteriaText =
                        trig.type === 'twitch_raid'
                          ? `Min: ${trig.minViewers ?? 1} viewers`
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
                              {trig.type === 'twitch_raid' ? (
                                <Flame size={13} className="text-orange-400 shrink-0" />
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
                            <div className="flex items-center justify-between">
                              <span>{criteriaText}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTriggerId(trig.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-white transition-opacity"
                                title={t(lang, 'sequence.editTrigger')}
                              >
                                <Edit3 size={12} />
                              </button>
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
                  <span>Comment</span>
                </button>

                {/* + Add Sub-Action button */}
                <div className="relative">
                  <Button
                    size="sm"
                    onClick={() => setShowAddActionMenu(!showAddActionMenu)}
                    className="h-7.5 border border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 text-[11.5px] font-medium"
                  >
                    <Plus size={12} className="me-1" />
                    <span>Add</span>
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

                    return (
                      <div
                        key={st.id}
                        onDoubleClick={() => setEditingStepId(st.id)}
                        onContextMenu={(e) => openContextMenu(e, 'action_row', st.id, idx)}
                        className={`group flex items-center justify-between rounded px-2.5 py-1.5 border transition-all cursor-pointer select-none ${
                          isStepRunning
                            ? 'border-accent bg-accent/15 ring-2 ring-accent text-white animate-pulse'
                            : isComment
                            ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/30'
                            : 'border-transparent hover:border-[#2b3142] hover:bg-[#161a26] text-zinc-200'
                        }`}
                        title="Double-click to edit, right-click for options"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="w-5 text-end text-[11px] text-zinc-600 font-mono select-none">
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
