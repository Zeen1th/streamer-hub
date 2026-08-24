import { create } from 'zustand';
import type { ConnectionStatus } from '../rpc/contracts';

interface ConnectionState {
  coreConnected: boolean;
  twitchConnected: boolean;
  coreVersion: string | null;
  twitchChannel: string | null;
  authRequired: boolean;
  botAccountEnabled: boolean;
  botConnected: boolean;
  botLogin: string | null;
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
  botAccountEnabled: false,
  botConnected: false,
  botLogin: null,
  statusReceived: false,
  isMaximized: false,
  setStatus: (status) =>
    set({
      coreConnected: status.coreConnected,
      twitchConnected: status.twitchConnected,
      coreVersion: status.coreVersion,
      twitchChannel: status.twitchChannel || null,
      authRequired: status.authRequired ?? false,
      botAccountEnabled: status.botAccountEnabled ?? false,
      botConnected: status.botConnected ?? false,
      botLogin: status.botLogin || null,
      statusReceived: true,
    }),
  setCoreConnected: (connected) => set({ coreConnected: connected, statusReceived: true }),
  setMaximized: (value) => set({ isMaximized: value }),
}));
