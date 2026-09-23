import type { PollState, VoteOption } from '../rpc/contracts';

export const DEFAULT_OPTION_COLORS = [
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#a855f7', // Purple
];

export function createInitialPoll(): PollState {
  return {
    id: 'poll-' + Date.now(),
    title: 'What should we do next?',
    options: [
      { id: 'opt-1', key: '1', label: 'Option 1', votes: 0, color: DEFAULT_OPTION_COLORS[0] },
      { id: 'opt-2', key: '2', label: 'Option 2', votes: 0, color: DEFAULT_OPTION_COLORS[1] },
      { id: 'opt-3', key: '3', label: 'Option 3', votes: 0, color: DEFAULT_OPTION_COLORS[2] },
    ],
    isActive: false,
    isEnded: false,
    allowChatVotes: true,
    allowChangeVote: true,
    durationSeconds: 0,
    totalVotes: 0,
    voters: {},
  };
}

/**
 * Extracts and parses a vote choice from chat input.
 * Supports:
 * - Direct numbers or keys: "1", "2", "A", "B"
 * - Prefix commands: "!vote 1", "!v 2", "!poll 1"
 * - Option label matches (case-insensitive)
 */
export function parseVoteInput(rawText: string, options: VoteOption[]): string | null {
  if (!rawText || !options || options.length === 0) return null;

  let text = rawText.trim();
  if (!text) return null;

  // Check prefix command: !vote <arg>, !v <arg>, !poll <arg>
  const prefixMatch = text.match(/^!(?:vote|v|poll)\s+(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    text = prefixMatch[1].trim();
  } else if (text.startsWith('!')) {
    // If it's another command like !help or !deaths, ignore
    return null;
  }

  const normalized = text.toLowerCase();

  // 1. Try matching option key (case-insensitive)
  for (const opt of options) {
    if (opt.key && opt.key.trim().toLowerCase() === normalized) {
      return opt.id;
    }
  }

  // 2. Try matching 1-based index (e.g., "1" maps to options[0])
  const parsedNum = parseInt(text, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= options.length && String(parsedNum) === text) {
    return options[parsedNum - 1].id;
  }

  // 3. Try matching exact option label (case-insensitive)
  for (const opt of options) {
    if (opt.label && opt.label.trim().toLowerCase() === normalized) {
      return opt.id;
    }
  }

  return null;
}

export function calculatePercentages(
  options: VoteOption[],
  totalVotes?: number,
): Record<string, number> {
  const total = totalVotes ?? options.reduce((sum, opt) => sum + Math.max(0, opt.votes), 0);
  const result: Record<string, number> = {};

  for (const opt of options) {
    const votes = Math.max(0, opt.votes);
    result[opt.id] = total > 0 ? Math.round((votes / total) * 100) : 0;
  }

  return result;
}

/**
 * Records a vote by a voter (by username or userId).
 * Handles deduplication and vote changes if permitted.
 */
export function recordVote(
  poll: PollState,
  voterId: string,
  optionId: string,
): PollState | null {
  if (!poll.isActive || poll.isEnded) return null;
  if (!poll.options.some((o) => o.id === optionId)) return null;

  const normalizedVoter = voterId.trim().toLowerCase();
  const previousOptionId = poll.voters[normalizedVoter];

  // Already voted for the same option
  if (previousOptionId === optionId) return poll;

  // If already voted and vote change is not allowed, reject
  if (previousOptionId && !poll.allowChangeVote) return null;

  const newOptions = poll.options.map((opt) => {
    if (opt.id === optionId) {
      return { ...opt, votes: opt.votes + 1 };
    }
    if (opt.id === previousOptionId) {
      return { ...opt, votes: Math.max(0, opt.votes - 1) };
    }
    return opt;
  });

  const totalVotes = previousOptionId ? poll.totalVotes : poll.totalVotes + 1;

  return {
    ...poll,
    options: newOptions,
    totalVotes,
    voters: {
      ...poll.voters,
      [normalizedVoter]: optionId,
    },
  };
}

/**
 * Increments vote count for an option manually from the app GUI.
 */
export function incrementManualVote(poll: PollState, optionId: string): PollState {
  if (!poll.options.some((o) => o.id === optionId)) return poll;

  const newOptions = poll.options.map((opt) =>
    opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt,
  );

  return {
    ...poll,
    options: newOptions,
    totalVotes: poll.totalVotes + 1,
  };
}

/**
 * Decrements vote count for an option manually from the app GUI.
 */
export function decrementManualVote(poll: PollState, optionId: string): PollState {
  const target = poll.options.find((o) => o.id === optionId);
  if (!target || target.votes <= 0) return poll;

  const newOptions = poll.options.map((opt) =>
    opt.id === optionId ? { ...opt, votes: Math.max(0, opt.votes - 1) } : opt,
  );

  return {
    ...poll,
    options: newOptions,
    totalVotes: Math.max(0, poll.totalVotes - 1),
  };
}
