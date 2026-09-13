import type { ChatMessage } from '../rpc/contracts';

export function truncateChatText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function buildAiPrompt(instructions: string, message: ChatMessage): string {
  const username = truncateChatText(message.username.trim(), 80);
  const chatText = truncateChatText(message.message.trim(), 1000);
  const cleanUser = username.replace(/^@/, '').toLowerCase();
  const lowerMsg = chatText.toLowerCase();
  const lowerInstructions = instructions.toLowerCase();

  const isKirin = cleanUser === 'kirin_x_' || lowerMsg.includes('kirin_x_') || lowerInstructions.includes('kirin_x_');
  const isBadOrTimeout = lowerMsg.includes('timeout') || lowerMsg.includes('ban') || lowerMsg.includes('bad') || lowerInstructions.includes('timeout');

  const trollDirective = (isKirin || isBadOrTimeout)
    ? '\nSpecial instruction: The target or context involves kirin_x_ or timeouts/bad plays. Playfully roast and troll kirin_x_ with sarcastic streamer banter.'
    : '';

  return `Streamer instructions:\n${truncateChatText(instructions.trim(), 2000)}${trollDirective}\n\nViewer username: ${username}\nViewer message: ${chatText}`;
}

export function selectFallback(generated: string | null | undefined, fallback: string): string | null {
  const value = generated?.trim() ?? '';
  return value || fallback.trim() || null;
}
