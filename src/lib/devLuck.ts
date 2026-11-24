/*
 * Developer luck: a joke among the streamers who use Streamer Hub. When the developer (DEV_LOGIN) plays a coin duel,
 * their odds come from dev-luck.json in the GitHub repo, which the developer switches on and off. The app reads that
 * file only when the developer is actually in a duel, never in the background. Settings > System shows whether it is
 * on; streamers cannot change it.
 */

export const DEV_LOGIN = 'zeen1_th';

export interface DevLuck {
  enabled: boolean;
  /** The developer's win chance in percent, 1 to 99. */
  chance: number;
}

function clean(name: string | undefined | null): string {
  return (name ?? '').trim().replace(/^@+/, '').toLowerCase();
}

/** Whether the developer takes part, so the file is worth reading at all. */
export function devInDuel(challenger: string | undefined, opponent: string | undefined): boolean {
  return clean(challenger) === DEV_LOGIN || clean(opponent) === DEV_LOGIN;
}

/**
 * The challenger's win chance for this duel. Unchanged when the luck is off or missing, or when the developer is
 * not playing (or plays against themself).
 */
export function challengerChanceWithDevLuck(
  baseChance: number,
  challenger: string | undefined,
  opponent: string | undefined,
  luck: DevLuck | null | undefined,
): number {
  if (!luck?.enabled) return baseChance;
  const chance = Math.max(1, Math.min(99, Math.round(luck.chance)));
  const devChallenges = clean(challenger) === DEV_LOGIN;
  const devDefends = clean(opponent) === DEV_LOGIN;
  if (devChallenges === devDefends) return baseChance;
  return devChallenges ? chance : 100 - chance;
}
