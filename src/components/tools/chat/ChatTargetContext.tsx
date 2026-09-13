import React, { createContext, useContext } from 'react';
import {
  useChatOverlayStore,
  useObsChatOverlayStore,
  type ChatOverlayState,
} from '../../../store/chatOverlayStore';

export type ChatTarget = 'overlay' | 'obs-chat';

const ChatTargetContext = createContext<ChatTarget>('overlay');

export function ChatTargetProvider({
  target,
  children,
}: {
  target: ChatTarget;
  children: React.ReactNode;
}) {
  return (
    <ChatTargetContext.Provider value={target}>
      {children}
    </ChatTargetContext.Provider>
  );
}

export function useChatTarget(): ChatTarget {
  return useContext(ChatTargetContext);
}

export function useChatStore(): ChatOverlayState;
export function useChatStore<T>(selector: (state: ChatOverlayState) => T): T;
export function useChatStore<T>(selector?: (state: ChatOverlayState) => T): T | ChatOverlayState {
  const target = useChatTarget();
  const store = target === 'obs-chat' ? useObsChatOverlayStore : useChatOverlayStore;
  return selector ? store(selector) : store();
}
