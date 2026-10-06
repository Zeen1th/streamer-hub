export const AUTO_UPDATE_COUNTDOWN_SECONDS = 15;
/** Do not retry the same version more often than this (a failed installer restarts the old app). */
export const AUTO_UPDATE_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

export type AutoUpdateDecision = 'none' | 'install_soon' | 'defer';

export interface AutoUpdateInput {
  enabled: boolean;
  updateAvailable: boolean;
  downloadUrl?: string | null;
  latestVersion: string;
  /** 'startup' = the check right after launch; 'periodic' = a later check during a session. */
  trigger: 'startup' | 'periodic';
  lastAttempt: { version: string; at: number } | null;
  /** Version the user chose not to auto-install this session (clicked Cancel). */
  declinedVersion: string | null;
  now: number;
}

/**
 * Updating restarts the app, which would cut a live stream's chat overlay and OBS link. So an
 * update is only installed automatically right after launch (with a short cancelable countdown);
 * one found mid-session waits and installs on the next launch.
 */
export function decideAutoUpdate(input: AutoUpdateInput): AutoUpdateDecision {
  if (!input.enabled || !input.updateAvailable || !input.downloadUrl) return 'none';
  if (input.declinedVersion === input.latestVersion) return 'none';
  const { lastAttempt } = input;
  if (lastAttempt && lastAttempt.version === input.latestVersion && input.now - lastAttempt.at < AUTO_UPDATE_RETRY_AFTER_MS) {
    return 'none';
  }
  return input.trigger === 'startup' ? 'install_soon' : 'defer';
}
