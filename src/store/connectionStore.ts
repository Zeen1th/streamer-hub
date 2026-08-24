import { create } from 'zustand';
import type { ConnectionStatus } from '../rpc/contracts';

interface ConnectionState {
  coreConnected: boolean;
  twitchConnected: boolean;
  coreVersion: string | null;
  twitchChannel: string | null;
  authRequired: boolean;
  statusReceived: boolean;
  isMaximized: boolean;
  setStatus(status: ConnectionStatus): void;
  setCoreConnected(connected: boolean): void;
  setMaximized(value: boolean): void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  coreConnected: false,
  twitchConnected: false,
  coreVersion: null,
  twitchChannel: null,
  authRequired: false,
  statusReceived: false,
  isMaximized: false,
  setStatus: (status) =>
    set({
      coreConnected: status.coreConnected,
      twitchConnected: status.twitchConnected,
      coreVersion: status.coreVersion,
      twitchChannel: status.twitchChannel || null,
      authRequired: status.authRequired ?? false,
      statusReceived: true,
    }),
  setCoreConnected: (connected) => set({ coreConnected: connected, statusReceived: true }),
  setMaximized: (value) => set({ isMaximized: value }),
}));
