import type { ActionTrigger } from '../rpc/contracts.ts';

/**
 * Every chat command a Twitch Chat trigger answers to, cleaned and without repeats.
 * Triggers made before several commands were allowed only have `chatCommand`.
 */
export function triggerChatCommands(trigger: Pick<ActionTrigger, 'chatCommand' | 'chatCommands'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(trigger.chatCommands ?? []), trigger.chatCommand ?? '']) {
    const cmd = (raw ?? '').trim();
    const key = cmd.toLowerCase();
    if (!cmd || seen.has(key)) continue;
    seen.add(key);
    out.push(cmd);
  }
  return out;
}

/** Does this chat line match one of the trigger's commands, using the trigger's match mode? */
export function chatMessageMatchesTrigger(
  trigger: Pick<ActionTrigger, 'chatCommand' | 'chatCommands' | 'matchMode'>,
  chatMessage: string,
): boolean {
  const rawMsg = chatMessage.trim().toLowerCase();
  if (!rawMsg) return false;
  const mode = trigger.matchMode || 'startsWith';
  return triggerChatCommands(trigger).some((command) => {
    const cmd = command.toLowerCase();
    if (mode === 'exact') return rawMsg === cmd;
    if (mode === 'contains') return rawMsg.includes(cmd);
    return rawMsg === cmd || rawMsg.startsWith(`${cmd} `);
  });
}
