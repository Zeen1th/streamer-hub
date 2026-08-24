import type { ChatMessage } from '../rpc/contracts';

export function truncateChatText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function buildAiPrompt(instructions: string, message: ChatMessage): string {
  return `Streamer instructions:\n${truncateChatText(instructions.trim(), 2000)}\n\nViewer username: ${truncateChatText(message.username.trim(), 80)}\nViewer message: ${truncateChatText(message.message.trim(), 1000)}`;
}

export function selectFallback(generated: string | null | undefined, fallback: string): string | null {
  const value = generated?.trim() ?? '';
  return value || fallback.trim() || null;
}
