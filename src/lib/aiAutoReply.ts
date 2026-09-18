import type { ChatMessage } from '../rpc/contracts';

export function truncateChatText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export interface AgentPromptOptions {
  agentName?: string;
  agentRole?: string;
  agentContext?: string;
  streamerChannel?: string;
}

export function buildAiPrompt(
  instructions: string,
  message: ChatMessage,
  agentOptions?: AgentPromptOptions,
): string {
  const username = truncateChatText(message.username.trim(), 80);
  const chatText = truncateChatText(message.message.trim(), 1000);
  const safeInstructions = truncateChatText(instructions.trim(), 8000);

  const parts: string[] = [];
  if (agentOptions?.agentName?.trim()) {
    const role = agentOptions.agentRole?.trim() ? `, ${truncateChatText(agentOptions.agentRole.trim(), 300)}` : '';
    parts.push(`Agent Persona: You are ${truncateChatText(agentOptions.agentName.trim(), 80)}${role}. Always stay in character.`);
  } else if (agentOptions?.agentRole?.trim()) {
    parts.push(`Agent Persona: You are ${truncateChatText(agentOptions.agentRole.trim(), 300)}.`);
  }

  if (agentOptions?.streamerChannel?.trim()) {
    parts.push(`Stream: Live in ${truncateChatText(agentOptions.streamerChannel.trim(), 80)}'s channel.`);
  }

  if (agentOptions?.agentContext?.trim()) {
    parts.push(`Stream Lore & Facts:\n${truncateChatText(agentOptions.agentContext.trim(), 4000)}`);
  }

  if (safeInstructions) {
    parts.push(`Streamer instructions:\n${safeInstructions}`);
  }

  parts.push(`Viewer username: ${username}\nViewer message: ${chatText}`);
  return parts.join('\n\n');
}

export function selectFallback(generated: string | null | undefined, fallback: string): string | null {
  const value = generated?.trim() ?? '';
  return value || fallback.trim() || null;
}
