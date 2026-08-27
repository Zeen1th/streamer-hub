/**
 * Source images are requested LARGER than they are displayed, then downscaled by
 * CSS. Downscaling is sharp; upscaling is not. This is half of the overlay
 * sharpness fix (the other half is not transform-scaling the output).
 */

const TWITCH_AVATAR_SIZE_SUFFIX = /-(\d{1,4})x(\d{1,4})(\.[a-zA-Z0-9]+)$/;

/**
 * Rewrites a Twitch profile image URL to a larger variant.
 * Twitch serves these as `..._-profile_image-70x70.png`; requesting 300x300
 * gives a crisp source for avatars rendered at any reasonable size.
 * Returns the input unchanged if it does not match the known pattern.
 */
export function twitchAvatarUrl(url: string, size = 300): string {
  if (typeof url !== 'string' || !url) return url;
  if (!TWITCH_AVATAR_SIZE_SUFFIX.test(url)) return url;
  return url.replace(TWITCH_AVATAR_SIZE_SUFFIX, `-${size}x${size}$3`);
}

export type TwitchEmoteScale = '1.0' | '2.0' | '3.0';

/** Builds a Twitch CDN emote URL. `3.0` is the largest variant Twitch serves. */
export function twitchEmoteUrl(id: string, scale: TwitchEmoteScale = '3.0'): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/${scale}`;
}
