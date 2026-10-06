import { chatterIdentifiersMatch } from './chatterNormalization.ts';

export interface ShieldSettings {
  roles: { moderator: boolean; vip: boolean; subscriber: boolean };
  /** Viewers who are always protected, by login or display name. */
  names: string[];
}

export interface ShieldChatterInfo {
  isMod?: boolean;
  isVip?: boolean;
  isSubscriber?: boolean;
}

export const DEFAULT_SHIELD: ShieldSettings = {
  roles: { moderator: false, vip: false, subscriber: false },
  names: [],
};

export function cleanShieldName(raw: string): string {
  return raw.trim().replace(/^@+/, '').slice(0, 60);
}

/**
 * Is this viewer protected from timeouts/bans? Roles come from the last chat message we saw from
 * them, so someone who has never chatted can only be shielded by name.
 */
export function isShielded(username: string, settings: ShieldSettings, chatter?: ShieldChatterInfo): boolean {
  const name = cleanShieldName(username);
  if (!name) return false;
  if (settings.names.some((n) => chatterIdentifiersMatch(n, name))) return true;
  if (!chatter) return false;
  if (settings.roles.moderator && chatter.isMod) return true;
  if (settings.roles.vip && chatter.isVip) return true;
  if (settings.roles.subscriber && chatter.isSubscriber) return true;
  return false;
}
