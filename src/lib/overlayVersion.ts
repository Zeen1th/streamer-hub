/*
 * Keeps OBS from running an old overlay page after the app updates.
 *
 * An OBS browser source loads the page once and then only reconnects its socket when the app restarts, so it
 * keeps the previous version's code (an update's fixes never appear until someone refreshes the source). The app
 * sends its version when a page connects; a page built for a different version reloads itself once.
 */

declare const __APP_VERSION__: string | undefined;

/** The version this page was built for. Empty when the build did not define it (tests, odd setups). */
export const OVERLAY_BUILD_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';

/** True when the app and this page are known to be different versions. */
export function needsReload(serverVersion: unknown, buildVersion: string = OVERLAY_BUILD_VERSION): boolean {
  if (typeof serverVersion !== 'string' || !serverVersion.trim()) return false;
  if (!buildVersion) return false;
  return serverVersion.trim() !== buildVersion;
}

/**
 * Reloads the page when the app reports another version. Once per reported version, so a mismatch that a reload
 * cannot fix (for example a dev build) never turns into a reload loop.
 */
export function reloadIfStale(serverVersion: unknown): boolean {
  if (!needsReload(serverVersion)) return false;
  const key = `streamer-hub-overlay-reloaded-for-${String(serverVersion)}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
  } catch {
    // Without storage we cannot tell whether we already tried, so do nothing rather than risk a reload loop.
    return false;
  }
  window.location.reload();
  return true;
}
