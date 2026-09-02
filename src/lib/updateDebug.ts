import type { UpdateState } from '../rpc/contracts';

export function createDebugUpdateState(state: UpdateState): UpdateState | null {
  if (!state.downloadUrl) return null;
  const releaseNotes = state.releaseNotes
    ? `[Updater test]\n\n${state.releaseNotes}`
    : '[Updater test] The current installer will be downloaded again.';
  return {
    ...state,
    updateAvailable: true,
    releaseNotes,
  };
}
