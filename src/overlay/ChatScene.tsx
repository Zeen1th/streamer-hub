import React from 'react';
import type { NormalizedChatOverlayMessage } from '../lib/chatOverlay';
import type { ThirdPartyEmoteMap } from '../lib/chatEmotes';
import type { ChatOverlaySettings } from '../rpc/contracts';
import { CHAT_OVERLAY_CANVAS } from '../rpc/contracts';
import { ChatMessageCard, type ChatOverlayPart, type OverlayLanguage } from './ChatMessageCard';
import { blockPositionStyle, settingsToCssVars } from './tokens';

export interface ChatSceneProps {
  settings: ChatOverlaySettings;
  messages: readonly NormalizedChatOverlayMessage[];
  thirdParty?: ThirdPartyEmoteMap;
  lang?: OverlayLanguage;
  /** Editor only. */
  selectedPart?: ChatOverlayPart | null;
  onSelectPart?: (part: ChatOverlayPart) => void;
  /** Editor only. Rendered inside the canvas, above the messages. */
  overlayChrome?: React.ReactNode;
  /** Editor only. Renders the block even when the overlay is disabled or empty. */
  alwaysRenderBlock?: boolean;
}

/**
 * The overlay's visuals, shared verbatim by the OBS renderer and the in-app
 * editor. Anything specific to one of those two belongs in its host, not here.
 *
 * The canvas is a fixed 1920x1080 coordinate space. The OBS browser source is
 * that size at 100%, so what the editor shows is pixel-for-pixel what viewers
 * see. Fitting the canvas into a smaller panel is the editor's job.
 */
export function ChatScene({
  settings,
  messages,
  thirdParty,
  lang = 'en',
  selectedPart = null,
  onSelectPart,
  overlayChrome,
  alwaysRenderBlock = false,
}: ChatSceneProps) {
  const visible =
    settings.flow.displayMode === 'latest'
      ? messages.slice(-1)
      : messages.slice(-settings.flow.maxMessages);

  const showBlock = alwaysRenderBlock || (settings.enabled && visible.length > 0);

  return (
    <div
      className="co-canvas"
      style={{
        ...settingsToCssVars(settings),
        width: `${CHAT_OVERLAY_CANVAS.width}px`,
        height: `${CHAT_OVERLAY_CANVAS.height}px`,
      }}
    >
      {showBlock && (
        <div
          className="co-block"
          style={blockPositionStyle(settings)}
          data-direction={settings.flow.direction}
          data-wrap={settings.text.wrapMode}
          data-username-position={settings.username.position}
          data-text-shadow={settings.text.shadow ? 'true' : 'false'}
        >
          <ol className="co-list" aria-live="polite" aria-relevant="additions removals">
            {visible.map((message) => (
              <ChatMessageCard
                key={message.id}
                message={message}
                settings={settings}
                thirdParty={thirdParty}
                lang={lang}
                selectedPart={selectedPart}
                onSelectPart={onSelectPart}
              />
            ))}
          </ol>
        </div>
      )}
      {overlayChrome}
    </div>
  );
}
