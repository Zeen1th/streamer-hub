import type { CommandSequence, SequenceStep } from '../rpc/contracts';

/*
 * "!so skip": stops the shoutout clip that is playing. Each Show Clip step says which command skips it and who may use
 * it. The command never starts the shoutout itself, so "!so skip" cannot shout out a channel called "skip".
 */

export type ClipSkipWho = 'off' | 'everyone' | 'mods' | 'requester_mods';

export const DEFAULT_CLIP_SKIP_COMMAND = '!so skip';
export const DEFAULT_CLIP_SKIP_WHO: ClipSkipWho = 'requester_mods';

export interface ClipSkipRule {
  command: string;
  who: ClipSkipWho;
}

export interface ClipSkipSender {
  login: string;
  isMod: boolean;
  isBroadcaster: boolean;
}

export function clipSkipRule(step: SequenceStep): ClipSkipRule {
  return {
    command: (step.clipSkipCommand ?? DEFAULT_CLIP_SKIP_COMMAND).trim(),
    who: step.clipSkipWho ?? DEFAULT_CLIP_SKIP_WHO,
  };
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function* walkSteps(steps: SequenceStep[]): Generator<SequenceStep> {
  for (const step of steps) {
    yield step;
    if (step.ifThen) yield* walkSteps(step.ifThen);
    if (step.ifElse) yield* walkSteps(step.ifElse);
  }
}

/** The skip rule a chat line matches, from any enabled sequence's Show Clip step (also inside If branches). */
export function matchClipSkip(sequences: CommandSequence[], message: string): ClipSkipRule | null {
  const said = normalize(message);
  if (!said) return null;
  for (const seq of sequences) {
    if (!seq.enabled) continue;
    for (const step of walkSteps(seq.steps ?? [])) {
      if (step.type !== 'obs_clip') continue;
      const rule = clipSkipRule(step);
      if (rule.who !== 'off' && rule.command && normalize(rule.command) === said) return rule;
    }
  }
  return null;
}

/** Whether this chatter may skip the clip that `requesterLogin` started. The streamer can always skip. */
export function canSkipClip(who: ClipSkipWho, sender: ClipSkipSender, requesterLogin: string | undefined): boolean {
  if (who === 'off') return false;
  if (sender.isBroadcaster) return true;
  if (who === 'everyone') return true;
  if (sender.isMod) return true;
  if (who === 'mods') return false;
  return Boolean(requesterLogin) && sender.login.toLowerCase() === requesterLogin!.toLowerCase();
}
