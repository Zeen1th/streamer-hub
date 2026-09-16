import type { AutoReply, CommandSequence, Counter, CounterAction, PermissionLevel } from '../rpc/contracts';
import { renderTemplate } from './counterRules.ts';

export type CommandGroup = 'all' | 'counters' | 'replies' | 'ai' | 'sequences' | 'disabled';
export type CommandSink = 'file' | 'title' | 'chat';

export interface CommandRow {
  id: string;
  sourceId: string;
  sourceKind: 'counter' | 'reply' | 'sequence';
  group: Exclude<CommandGroup, 'all' | 'disabled'>;
  action?: CounterAction;
  command: string;
  description: string;
  permission: PermissionLevel;
  cooldownSeconds: number;
  writes: CommandSink[];
  enabled: boolean;
  lastTriggeredAt?: number;
  error?: string;
  literalFileOutput?: string;
  literalTitleOutput?: string;
  count?: number;
  subCommands?: string[];
  sequenceStepCount?: number;
}

interface ProjectionInput {
  counters: Counter[];
  replies: AutoReply[];
  sequences?: CommandSequence[];
  counterLastTriggeredAt?: Record<string, Partial<Record<CounterAction, number>>>;
  replyLastTriggeredAt?: Record<string, number>;
  sequenceLastTriggeredAt?: Record<string, number>;
  obsErrors: Record<string, { state?: string; message?: string | null }>;
}

export function projectCommands({
  counters,
  replies,
  sequences = [],
  counterLastTriggeredAt = {},
  replyLastTriggeredAt = {},
  sequenceLastTriggeredAt = {},
  obsErrors,
}: ProjectionInput): CommandRow[] {
  const counterRows: CommandRow[] = counters.map((counter) => {
    const primary = counter.commands.increase;
    const writes: CommandSink[] = [];
    if (counter.obs.enabled) writes.push('file');
    if (counter.titleEnabled) writes.push('title');
    const status = obsErrors[counter.id];
    const timestamps = counterLastTriggeredAt[counter.id];
    const latestTimestamp = timestamps
      ? Math.max(timestamps.increase ?? 0, timestamps.decrease ?? 0, timestamps.reset ?? 0) || undefined
      : undefined;

    return {
      id: `counter:${counter.id}`,
      sourceId: counter.id,
      sourceKind: 'counter' as const,
      group: 'counters' as const,
      action: 'increase',
      command: primary.commandName,
      description: counter.name,
      permission: primary.permission,
      cooldownSeconds: primary.cooldownSeconds,
      writes,
      enabled: true,
      lastTriggeredAt: latestTimestamp,
      error: status?.state === 'error' ? status.message ?? 'Write failed' : undefined,
      literalFileOutput: counter.obs.enabled
        ? renderTemplate(counter.obs.template, counter.count, null)
        : undefined,
      literalTitleOutput: counter.titleEnabled && counter.titleTemplate
        ? renderTemplate(counter.titleTemplate, counter.count, null)
        : undefined,
      count: counter.count,
      subCommands: [
        counter.commands.increase.commandName,
        counter.commands.decrease.commandName,
        counter.commands.reset.commandName,
      ],
    };
  });

  const replyRows: CommandRow[] = replies.map((reply) => {
    const writes: CommandSink[] = [];
    if (reply.responseEnabled !== false) writes.push('chat');
    if (reply.titleActionEnabled) writes.push('title');
    const isAi = reply.responseMode === 'ai';
    return {
      id: `reply:${reply.id}`,
      sourceId: reply.id,
      sourceKind: 'reply',
      group: isAi ? 'ai' : 'replies',
      command: reply.triggers[0] ?? '',
      description: isAi ? 'AI reply' : 'Prepared reply',
      permission: reply.minimumRank ?? 'everyone',
      cooldownSeconds: reply.cooldownSeconds,
      writes,
      enabled: reply.enabled,
      lastTriggeredAt: replyLastTriggeredAt[reply.id],
      literalTitleOutput: reply.titleActionEnabled ? reply.titleTemplate : undefined,
    };
  });

  const sequenceRows: CommandRow[] = (sequences ?? []).map((seq) => {
    let triggerLabel = '🪙 Channel Points';
    if (Array.isArray(seq.triggers)) {
      if (seq.triggers.length === 0) {
        triggerLabel = '(No Triggers)';
      } else {
        const labels = seq.triggers.map((t) => {
          if (t.type === 'twitch_raid') return `🔥 Raid (≥${t.minViewers ?? 1})`;
          if (t.type === 'twitch_chat') return t.chatCommand || 'Chat';
          return t.rewardTitle ? `🪙 ${t.rewardTitle}` : '🪙 Reward';
        });
        triggerLabel = labels.join(', ');
      }
    } else if (seq.triggerType === 'channel_points') {
      triggerLabel = seq.rewardTitle ? `🪙 ${seq.rewardTitle}` : '🪙 Channel Points';
    } else if (seq.triggerType === 'chat') {
      triggerLabel = seq.chatTrigger || 'Chat';
    } else {
      triggerLabel = `${seq.rewardTitle ? `🪙 ${seq.rewardTitle}` : '🪙'} / ${seq.chatTrigger || 'Chat'}`;
    }

    const writes: CommandSink[] = [];
    if (seq.steps.some((s) => s.type === 'chat')) writes.push('chat');
    if (seq.steps.some((s) => s.type === 'counter')) writes.push('file');

    return {
      id: `sequence:${seq.id}`,
      sourceId: seq.id,
      sourceKind: 'sequence' as const,
      group: 'sequences' as const,
      command: triggerLabel,
      description: seq.name,
      permission: 'everyone',
      cooldownSeconds: seq.cooldownSeconds,
      writes,
      enabled: seq.enabled,
      lastTriggeredAt: sequenceLastTriggeredAt?.[seq.id],
      sequenceStepCount: seq.steps.length,
    };
  });

  return [...counterRows, ...replyRows, ...sequenceRows];
}

export function filterCommands(rows: CommandRow[], group: CommandGroup, query: string): CommandRow[] {
  const normalized = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const inGroup = group === 'all' || (group === 'disabled' ? !row.enabled : row.group === group);
    if (!inGroup) return false;
    if (!normalized) return true;
    const sub = row.subCommands ? ` ${row.subCommands.join(' ')}` : '';
    return `${row.command} ${row.description}${sub}`.toLocaleLowerCase().includes(normalized);
  });
}

export function selectionAfterClick(current: string[], id: string, modified: boolean): string[] {
  if (!modified) return [id];
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export function clampMenuPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  menuWidth = 180,
  menuHeight = 200,
  padding = 10,
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(x, viewportWidth - menuWidth - padding)),
    y: Math.max(padding, Math.min(y, viewportHeight - menuHeight - padding)),
  };
}

export const DEFAULT_INSPECTOR_WIDTH = 298;
export const MIN_INSPECTOR_WIDTH = 240;
export const MAX_INSPECTOR_WIDTH = 640;

export function clampInspectorWidth(
  width: number,
  containerWidth?: number,
  min = MIN_INSPECTOR_WIDTH,
  max = MAX_INSPECTOR_WIDTH,
  reservedWidth = 186 + 320,
): number {
  if (typeof width !== 'number' || Number.isNaN(width)) return DEFAULT_INSPECTOR_WIDTH;
  const dynamicMax = typeof containerWidth === 'number' && Number.isFinite(containerWidth)
    ? Math.max(min, Math.min(max, containerWidth - reservedWidth))
    : max;
  return Math.max(min, Math.min(Math.round(width), dynamicMax));
}

