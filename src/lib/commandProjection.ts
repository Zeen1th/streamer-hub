import type { AutoReply, Counter, CounterAction, PermissionLevel } from '../rpc/contracts';
import { renderTemplate } from './counterRules.ts';

export type CommandGroup = 'all' | 'counters' | 'replies' | 'ai' | 'disabled';
export type CommandSink = 'file' | 'title' | 'chat';

export interface CommandRow {
  id: string;
  sourceId: string;
  sourceKind: 'counter' | 'reply';
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
}

interface ProjectionInput {
  counters: Counter[];
  replies: AutoReply[];
  counterLastTriggeredAt?: Record<string, Partial<Record<CounterAction, number>>>;
  replyLastTriggeredAt?: Record<string, number>;
  obsErrors: Record<string, { state?: string; message?: string | null }>;
}

const ACTION_DESCRIPTION: Record<CounterAction, string> = {
  increase: 'Increase',
  decrease: 'Decrease',
  reset: 'Reset',
};

export function projectCommands({
  counters,
  replies,
  counterLastTriggeredAt = {},
  replyLastTriggeredAt = {},
  obsErrors,
}: ProjectionInput): CommandRow[] {
  const counterRows = counters.flatMap((counter) =>
    (['increase', 'decrease', 'reset'] as CounterAction[]).map((action) => {
      const config = counter.commands[action];
      const writes: CommandSink[] = [];
      if (counter.obs.enabled) writes.push('file');
      if (counter.titleEnabled) writes.push('title');
      const status = obsErrors[counter.id];
      return {
        id: `counter:${counter.id}:${action}`,
        sourceId: counter.id,
        sourceKind: 'counter' as const,
        group: 'counters' as const,
        action,
        command: config.commandName,
        description: `${ACTION_DESCRIPTION[action]} ${counter.name}`,
        permission: config.permission,
        cooldownSeconds: config.cooldownSeconds,
        writes,
        enabled: true,
        lastTriggeredAt: counterLastTriggeredAt[counter.id]?.[action],
        error: status?.state === 'error' ? status.message ?? 'Write failed' : undefined,
        literalFileOutput: counter.obs.enabled
          ? renderTemplate(counter.obs.template, counter.count, null)
          : undefined,
        literalTitleOutput: counter.titleEnabled && counter.titleTemplate
          ? renderTemplate(counter.titleTemplate, counter.count, null)
          : undefined,
      };
    }),
  );

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

  return [...counterRows, ...replyRows];
}

export function filterCommands(rows: CommandRow[], group: CommandGroup, query: string): CommandRow[] {
  const normalized = query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const inGroup = group === 'all' || (group === 'disabled' ? !row.enabled : row.group === group);
    if (!inGroup) return false;
    if (!normalized) return true;
    return `${row.command} ${row.description}`.toLocaleLowerCase().includes(normalized);
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

