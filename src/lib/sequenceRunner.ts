import type { CommandSequence, CounterAction, LogKind, ModerationAction, SequenceStep } from '../rpc/contracts';

export interface SequenceExecutionContext {
  username: string;
  userLogin?: string;
  userId?: string;
  source: 'channel_points' | 'chat' | 'test';
  userInput?: string;
}

export interface SequenceExecutionSinks {
  sendChatMessage?: (message: string) => Promise<boolean>;
  executeCounterAction?: (counterId: string, action: CounterAction) => Promise<void>;
  executeCommand?: (trigger: string, ctx: SequenceExecutionContext) => Promise<void>;
  executeModerationAction?: (
    action: ModerationAction,
    target: string,
    durationSeconds?: number,
    reason?: string,
  ) => Promise<{ ok: boolean; wasMod?: boolean; error?: string }>;
  delay?: (ms: number) => Promise<void>;
  onStepStart?: (stepIndex: number, step: SequenceStep) => void;
  onStepComplete?: (stepIndex: number, step: SequenceStep) => void;
  log?: (kind: LogKind, message: string) => void;
}

export interface SequenceExecutionResult {
  ok: boolean;
  executedSteps: number;
  error?: string;
}

export function extractTargetUsername(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const firstToken = trimmed.split(/\s+/)[0] || '';
  return firstToken.replace(/^[@#!]+/, '').replace(/[,:;.!?]+$/, '');
}

export function replaceSequenceTokens(template: string, ctx: SequenceExecutionContext): string {
  const username = ctx.username || 'viewer';
  const mention = `@${username}`;
  const input = ctx.userInput || '';
  const target = extractTargetUsername(input) || 'kirin_x_';

  return template
    .replace(/\{username\}/gi, username)
    .replace(/\{user\}/gi, username)
    .replace(/\{mention\}/gi, mention)
    .replace(/\{input\}/gi, input)
    .replace(/\{target\}/gi, target)
    .replace(/\{target_user\}/gi, target);
}

export function calculateWaitMs(duration?: number, unit?: 'seconds' | 'minutes'): number {
  const amount = duration != null && !Number.isNaN(duration) && duration > 0 ? duration : 0;
  if (unit === 'minutes') {
    return Math.round(amount * 60 * 1000);
  }
  return Math.round(amount * 1000);
}

export function isSequenceOnCooldown(sequence: CommandSequence, lastRanAtUtcMs?: number, nowUtcMs: number = Date.now()): boolean {
  if (!sequence.cooldownSeconds || sequence.cooldownSeconds <= 0 || !lastRanAtUtcMs) {
    return false;
  }
  return nowUtcMs - lastRanAtUtcMs < sequence.cooldownSeconds * 1000;
}

export interface SequenceTriggerQuery {
  customRewardId?: string;
  rewardTitle?: string;
  chatMessage?: string;
}

export function matchesSequenceTrigger(sequence: CommandSequence, query: SequenceTriggerQuery): boolean {
  if (!sequence.enabled) return false;

  // Channel points matching
  if (sequence.triggerType === 'channel_points' || sequence.triggerType === 'both') {
    if (query.customRewardId && sequence.rewardId) {
      if (query.customRewardId.trim().toLowerCase() === sequence.rewardId.trim().toLowerCase()) {
        return true;
      }
    }
    if (query.rewardTitle && sequence.rewardTitle) {
      if (query.rewardTitle.trim().toLowerCase() === sequence.rewardTitle.trim().toLowerCase()) {
        return true;
      }
    }
  }

  // Chat command matching
  if (sequence.triggerType === 'chat' || sequence.triggerType === 'both') {
    if (query.chatMessage && sequence.chatTrigger) {
      const trigger = sequence.chatTrigger.trim().toLowerCase();
      const rawMsg = query.chatMessage.trim().toLowerCase();
      if (rawMsg === trigger || rawMsg.startsWith(`${trigger} `)) {
        return true;
      }
    }
  }

  return false;
}

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function executeSequence(
  sequence: CommandSequence,
  ctx: SequenceExecutionContext,
  sinks: SequenceExecutionSinks = {},
): Promise<SequenceExecutionResult> {
  const delay = sinks.delay ?? defaultDelay;
  const log = sinks.log ?? (() => {});

  log('trigger', `Starting Sequence [${sequence.name}] triggered by ${ctx.username} (${ctx.source})`);

  let executedCount = 0;

  for (let i = 0; i < sequence.steps.length; i++) {
    const step = sequence.steps[i];
    sinks.onStepStart?.(i, step);

    try {
      switch (step.type) {
        case 'chat': {
          if (step.chatMessage?.trim()) {
            const formatted = replaceSequenceTokens(step.chatMessage, ctx);
            log('chat', `[Sequence ${sequence.name}] Step ${i + 1}: Send chat "${formatted}"`);
            if (sinks.sendChatMessage) {
              await sinks.sendChatMessage(formatted);
            }
          }
          break;
        }

        case 'counter': {
          if (step.counterId && step.counterAction) {
            log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Counter ${step.counterId} -> ${step.counterAction}`);
            if (sinks.executeCounterAction) {
              await sinks.executeCounterAction(step.counterId, step.counterAction);
            }
          }
          break;
        }

        case 'command': {
          if (step.commandTrigger?.trim()) {
            log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Run command "${step.commandTrigger.trim()}"`);
            if (sinks.executeCommand) {
              await sinks.executeCommand(step.commandTrigger.trim(), ctx);
            }
          }
          break;
        }

        case 'wait': {
          const waitMs = calculateWaitMs(step.waitDuration, step.waitUnit);
          if (waitMs > 0) {
            log('system', `[Sequence ${sequence.name}] Step ${i + 1}: Waiting ${step.waitDuration} ${step.waitUnit || 'seconds'}...`);
            await delay(waitMs);
          }
          break;
        }

        case 'moderation': {
          const action = step.moderationAction || 'smart_timeout';
          const rawTarget = step.targetUser !== undefined ? step.targetUser.trim() : '{input}';
          const resolvedTarget = replaceSequenceTokens(rawTarget, ctx).trim();
          let cleanTarget = extractTargetUsername(resolvedTarget);

          // Default timeout/moderation target to kirin_x_ if not supplied
          if (!cleanTarget && step.targetUser !== '' && (action === 'smart_timeout' || action === 'timeout' || action === 'ban')) {
            cleanTarget = 'kirin_x_';
          }

          if (action !== 'clear_chat' && !cleanTarget) {
            log('obs-error', `[Sequence ${sequence.name}] Step ${i + 1}: Moderation action "${action}" skipped — empty target username.`);
            break;
          }

          const duration = step.durationSeconds && step.durationSeconds > 0 ? step.durationSeconds : 60;
          const reason = step.reason ? replaceSequenceTokens(step.reason, ctx) : `Triggered by ${ctx.username} via Streamer Hub`;

          log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Moderation "${action}" on "${cleanTarget}" (duration: ${duration}s)`);

          if (sinks.executeModerationAction) {
            const res = await sinks.executeModerationAction(action, cleanTarget, duration, reason);
            if (!res.ok) {
              log('obs-error', `[Sequence ${sequence.name}] Step ${i + 1} moderation failed: ${res.error || 'UNKNOWN'}`);
            } else if (res.wasMod) {
              log('system', `[Sequence ${sequence.name}] Step ${i + 1}: Note: ${cleanTarget} is a mod — temporarily unmodded, timed out for ${duration}s, and will be re-modded automatically.`);
            }
          }
          break;
        }
      }

      executedCount++;
      sinks.onStepComplete?.(i, step);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log('obs-error', `[Sequence ${sequence.name}] Step ${i + 1} failed: ${errorMsg}`);
      sinks.onStepComplete?.(i, step);
      return { ok: false, executedSteps: executedCount, error: errorMsg };
    }
  }

  log('trigger', `Sequence [${sequence.name}] completed (${executedCount} steps).`);
  return { ok: true, executedSteps: executedCount };
}
