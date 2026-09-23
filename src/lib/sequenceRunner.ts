import type { CommandSequence, CounterAction, LogKind, ModerationAction, SequenceStep } from '../rpc/contracts';

export interface SequenceExecutionContext {
  username: string;
  userLogin?: string;
  userId?: string;
  source: 'channel_points' | 'chat' | 'raid' | 'follow' | 'test';
  userInput?: string;
  raider?: string;
  viewers?: number;
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
  playSound?: (soundPath: string, volume?: number) => Promise<boolean>;
  speakTts?: (
    text: string,
    voice?: string,
    rate?: number,
    pitch?: number,
    volume?: number,
  ) => Promise<boolean>;
  writeObsText?: (filePath: string, content: string) => Promise<boolean>;
  executePollAction?: (
    action: 'start' | 'end' | 'reset',
    question?: string,
    options?: string[],
    durationSeconds?: number,
  ) => Promise<boolean>;
  muteMic?: (durationSeconds: number) => Promise<boolean>;
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

export function extractCommandArguments(messageText: string, trigger: string): string {
  const trimmedMsg = messageText.trim();
  const trimmedTrigger = trigger.trim();
  if (trimmedTrigger && trimmedMsg.toLowerCase().startsWith(trimmedTrigger.toLowerCase())) {
    return trimmedMsg.slice(trimmedTrigger.length).trim();
  }
  return trimmedMsg;
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
  const raider = ctx.raider || ctx.username || 'raider';
  const viewers = ctx.viewers != null ? String(ctx.viewers) : '0';
  let target = extractTargetUsername(input);
  if (!target && ctx.source === 'raid') {
    target = extractTargetUsername(raider);
  }

  return template
    .replace(/\{username\}/gi, username)
    .replace(/\{user\}/gi, username)
    .replace(/\{mention\}/gi, mention)
    .replace(/\{input\}/gi, input)
    .replace(/\{target\}/gi, target)
    .replace(/\{target_user\}/gi, target)
    .replace(/\{raider\}/gi, raider)
    .replace(/\{viewers\}/gi, viewers);
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
  raid?: {
    fromUserName: string;
    fromUserLogin: string;
    viewers: number;
  };
  follow?: {
    userId: string;
    userName: string;
    userLogin: string;
  };
}

export function matchesSequenceTrigger(sequence: CommandSequence, query: SequenceTriggerQuery): boolean {
  if (!sequence.enabled) return false;

  // If triggers array is defined (including empty array), evaluate triggers
  if (Array.isArray(sequence.triggers)) {
    for (const trigger of sequence.triggers) {
      if (!trigger.enabled) continue;

      if (trigger.type === 'twitch_follow' && query.follow) {
        return true;
      }

      if (trigger.type === 'twitch_raid' && query.raid) {
        const min = trigger.minViewers ?? 1;
        if (query.raid.viewers >= min) {
          return true;
        }
      }

      if (trigger.type === 'twitch_channel_points') {
        if (query.customRewardId && trigger.rewardId) {
          if (query.customRewardId.trim().toLowerCase() === trigger.rewardId.trim().toLowerCase()) {
            return true;
          }
        }
        if (query.rewardTitle && trigger.rewardTitle) {
          if (query.rewardTitle.trim().toLowerCase() === trigger.rewardTitle.trim().toLowerCase()) {
            return true;
          }
        }
      }

      if (trigger.type === 'twitch_chat' && query.chatMessage && trigger.chatCommand) {
        const cmd = trigger.chatCommand.trim().toLowerCase();
        const rawMsg = query.chatMessage.trim().toLowerCase();
        const mode = trigger.matchMode || 'startsWith';
        if (mode === 'exact' && rawMsg === cmd) return true;
        if (mode === 'startsWith' && (rawMsg === cmd || rawMsg.startsWith(`${cmd} `))) return true;
        if (mode === 'contains' && rawMsg.includes(cmd)) return true;
      }
    }
    return false;
  }

  // Fallback for legacy sequences:
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
        case 'comment': {
          log('system', `[Sequence ${sequence.name}] Step ${i + 1}: // ${step.commentText || ''}`);
          break;
        }

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
          const cleanTarget = extractTargetUsername(resolvedTarget);

          if (action !== 'clear_chat' && !cleanTarget) {
            const errMsg = `Moderation action "${action}" skipped — empty target username. (Usage: ${sequence.chatTrigger || sequence.name} @username)`;
            log('obs-error', `[Sequence ${sequence.name}] Step ${i + 1}: ${errMsg}`);
            sinks.onStepComplete?.(i, step);
            return { ok: false, executedSteps: executedCount, error: errMsg };
          }

          const duration = step.durationSeconds && step.durationSeconds > 0 ? step.durationSeconds : 60;
          const reason = step.reason ? replaceSequenceTokens(step.reason, ctx) : `Triggered by ${ctx.username} via Streamer Hub`;

          log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Moderation "${action}" on "${cleanTarget}" (duration: ${duration}s)`);

          if (sinks.executeModerationAction) {
            const res = await sinks.executeModerationAction(action, cleanTarget, duration, reason);
            if (!res.ok) {
              const rawErr = res.error || 'UNKNOWN';
              let userFriendlyMsg = rawErr;
              if (rawErr === 'CANNOT_TIMEOUT_BROADCASTER' || rawErr === 'CANNOT_BAN_BROADCASTER') {
                userFriendlyMsg = 'Cannot timeout or ban the channel broadcaster (Twitch does not allow self-moderation of the channel owner).';
              } else if (rawErr.includes('403') || rawErr.includes('Forbidden') || rawErr.includes('401') || rawErr.includes('Unauthorized')) {
                userFriendlyMsg = `Twitch permission denied (${rawErr}). Ensure you have moderator privileges and re-authenticate Twitch if scopes were updated.`;
              }
              log('obs-error', `[Sequence ${sequence.name}] Step ${i + 1} moderation failed: ${userFriendlyMsg}`);
              sinks.onStepComplete?.(i, step);
              return { ok: false, executedSteps: executedCount, error: userFriendlyMsg };
            } else if (res.wasMod) {
              log('system', `[Sequence ${sequence.name}] Step ${i + 1}: Note: ${cleanTarget} is a mod — temporarily unmodded, timed out for ${duration}s, and will be re-modded automatically.`);
            }
          }
          break;
        }

        case 'sound': {
          if (step.soundPath?.trim()) {
            const vol = step.soundVolume ?? 1.0;
            log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Play sound "${step.soundPath.trim()}" (vol: ${Math.round(vol * 100)}%)`);
            if (sinks.playSound) {
              await sinks.playSound(step.soundPath.trim(), vol);
            }
          }
          break;
        }

        case 'tts': {
          if (step.ttsText?.trim()) {
            const resolvedText = replaceSequenceTokens(step.ttsText, ctx);
            log('chat', `[Sequence ${sequence.name}] Step ${i + 1}: TTS speak "${resolvedText}"`);
            if (sinks.speakTts) {
              await sinks.speakTts(
                resolvedText,
                step.ttsVoice,
                step.ttsRate ?? 1.0,
                step.ttsPitch ?? 1.0,
                step.ttsVolume ?? 1.0,
              );
            }
          }
          break;
        }

        case 'obs_text': {
          if (step.filePath?.trim()) {
            const content = step.fileContent !== undefined ? step.fileContent : '';
            const resolvedContent = replaceSequenceTokens(content, ctx);
            log('system', `[Sequence ${sequence.name}] Step ${i + 1}: Write OBS text file "${step.filePath.trim()}" -> "${resolvedContent}"`);
            if (sinks.writeObsText) {
              await sinks.writeObsText(step.filePath.trim(), resolvedContent);
            }
          }
          break;
        }

        case 'poll': {
          const action = step.pollAction || 'start';
          log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Live Poll -> ${action}`);
          if (sinks.executePollAction) {
            await sinks.executePollAction(
              action,
              step.pollQuestion ? replaceSequenceTokens(step.pollQuestion, ctx) : undefined,
              step.pollOptions,
              step.pollDurationSeconds,
            );
          }
          break;
        }

        case 'mic_mute': {
          const duration = step.micMuteDurationSeconds && step.micMuteDurationSeconds > 0 ? step.micMuteDurationSeconds : 5;
          log('trigger', `[Sequence ${sequence.name}] Step ${i + 1}: Mute streamer microphone for ${duration}s`);
          if (sinks.muteMic) {
            await sinks.muteMic(duration);
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
