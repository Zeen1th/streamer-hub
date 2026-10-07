export const TIMER_DEFAULT_INTERVAL_MINUTES = 30;
/** Nightbot's default: stay quiet in a dead chat so the message is not just repeated at nobody. */
export const TIMER_DEFAULT_MIN_CHAT_MESSAGES = 5;
export const TIMER_MIN_INTERVAL_MINUTES = 1;
export const TIMER_MAX_INTERVAL_MINUTES = 24 * 60;

export interface TimerCheck {
  intervalMinutes: number;
  /** Chat messages that must have arrived since the last run (0 = send even in a silent chat). */
  minChatMessages: number;
  lastFiredAt: number;
  now: number;
  chatLinesSince: number;
}

/** A timer fires once its interval has passed AND chat has been active enough since it last ran. */
export function shouldFireTimer(check: TimerCheck): boolean {
  const interval = Math.min(TIMER_MAX_INTERVAL_MINUTES, Math.max(TIMER_MIN_INTERVAL_MINUTES, check.intervalMinutes || TIMER_DEFAULT_INTERVAL_MINUTES));
  if (check.now - check.lastFiredAt < interval * 60_000) return false;
  return check.chatLinesSince >= Math.max(0, check.minChatMessages);
}

/** "30 min", "1 h", "1 h 30 min": how a timer interval reads in lists. */
export function formatTimerInterval(minutes: number): string {
  const total = Math.max(1, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
