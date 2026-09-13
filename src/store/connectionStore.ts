import { create } from 'zustand';
import type { ChatSenderRole, ConnectionStatus } from '../rpc/contracts';

interface ConnectionState {
  coreConnected: boolean;
  twitchConnected: boolean;
  coreVersion: string | null;
  twitchChannel: string | null;
  authRequired: boolean;
  botAccountEnabled: boolean;
  botConnected: boolean;
  botLogin: string | null;
  preferredChatSender: ChatSenderRole;
  activeChatSender: ChatSenderRole;
  activeChatSenderLogin: string | null;
  statusReceived: boolean;
  isMaximized: boolean;
  broadcasterAvatarUrl: string | null;
  broadcasterDisplayName: string | null;
  setStatus(status: ConnectionStatus): void;
  setCoreConnected(connected: boolean): void;
  setMaximized(value: boolean): void;
  setBroadcasterProfile(avatarUrl: string | null, displayName: string | null): void;
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
  preferredChatSender: 'bot',
  activeChatSender: 'broadcaster',
  activeChatSenderLogin: null,
  statusReceived: false,
  isMaximized: false,
  broadcasterAvatarUrl: null,
  broadcasterDisplayName: null,
  setStatus: (status) =>
    set((prev) => ({
      coreConnected: status.coreConnected,
      twitchConnected: status.twitchConnected,
      coreVersion: status.coreVersion,
      twitchChannel: status.twitchChannel || null,
      authRequired: status.authRequired ?? false,
      botAccountEnabled: status.botAccountEnabled ?? false,
      botConnected: status.botConnected ?? false,
      botLogin: status.botLogin || null,
      preferredChatSender: status.preferredChatSender ?? 'bot',
      activeChatSender: status.activeChatSender ?? (status.botAccountEnabled && status.botConnected ? 'bot' : 'broadcaster'),
      activeChatSenderLogin: status.activeChatSenderLogin || (status.botAccountEnabled && status.botConnected ? status.botLogin : status.twitchChannel) || null,
      statusReceived: true,
      // If disconnected, clear avatar unless channel matches
      broadcasterAvatarUrl: status.twitchConnected ? prev.broadcasterAvatarUrl : null,
      broadcasterDisplayName: status.twitchConnected ? prev.broadcasterDisplayName : null,
    })),
  setCoreConnected: (connected) => set({ coreConnected: connected, statusReceived: true }),
  setMaximized: (value) => set({ isMaximized: value }),
  setBroadcasterProfile: (avatarUrl, displayName) => set({ broadcasterAvatarUrl: avatarUrl, broadcasterDisplayName: displayName }),
}));
