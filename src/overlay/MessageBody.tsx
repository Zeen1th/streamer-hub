import { formatBidiText } from '../lib/chatOverlay';
import { tokenizeMessage, type ThirdPartyEmoteMap } from '../lib/chatEmotes';
import type { ChatOverlayEmoteSettings, EmoteRange } from '../rpc/contracts';

interface MessageBodyProps {
  text: string;
  emotes: readonly EmoteRange[];
  thirdParty: ThirdPartyEmoteMap | undefined;
  settings: ChatOverlayEmoteSettings;
  isRtl: boolean;
  /** Set by the parent so the emote-only scale can apply. */
  onEmoteOnly?: (emoteOnly: boolean) => void;
}

/**
 * Renders message content as text runs and emote images.
 *
 * Two rendering paths on purpose:
 *
 * - No emotes (the common case) renders a single span with explicit RLI/PDI
 *   wrapping, which is the exact behaviour the existing BiDi handling was built
 *   and tested against. Emote support must not regress right-to-left text.
 * - With emotes, the runs become separate elements, so directional isolation is
 *   expressed structurally instead (`dir` plus `unicode-bidi: isolate` in CSS).
 */
export function MessageBody({ text, emotes, thirdParty, settings, isRtl }: MessageBodyProps) {
  const { tokens } = tokenizeMessage(text, emotes, thirdParty, { twitch: settings.twitch });
  const dir = isRtl ? 'rtl' : 'ltr';

  const hasEmotes = tokens.some((token) => token.type === 'emote');
  if (!hasEmotes) {
    return (
      <span className="co-body" dir={dir}>
        {formatBidiText(text, isRtl)}
      </span>
    );
  }

  return (
    <span className="co-body" dir={dir}>
      {tokens.map((token, index) =>
        token.type === 'emote' ? (
          <img
            className="co-emote"
            key={`emote-${index}`}
            src={token.url}
            alt={token.name}
            title={token.name}
            loading="eager"
            decoding="async"
            onError={(event) => {
              // A dead emote URL falls back to its name rather than a broken image.
              const img = event.currentTarget;
              const replacement = document.createElement('span');
              replacement.textContent = token.name;
              img.replaceWith(replacement);
            }}
          />
        ) : (
          <span className="co-run" dir={dir} key={`text-${index}`}>
            {token.value}
          </span>
        ),
      )}
    </span>
  );
}

/** Whether a message renders as emotes only, used to apply the emote-only scale. */
export function isEmoteOnlyMessage(
  text: string,
  emotes: readonly EmoteRange[],
  thirdParty: ThirdPartyEmoteMap | undefined,
  settings: ChatOverlayEmoteSettings,
): boolean {
  return tokenizeMessage(text, emotes, thirdParty, { twitch: settings.twitch }).emoteOnly;
}
