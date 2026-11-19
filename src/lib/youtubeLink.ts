/*
 * Reads a YouTube link out of what a viewer typed (e.g. "!request https://youtu.be/abc123def45?t=90 this is great").
 * Only YouTube is accepted: anything else is not a link we can play, so the request is refused.
 */

export interface YouTubeLink {
  /** The 11 character video id. */
  videoId: string;
  /** Where to start, from t= or start= (0 = the beginning). */
  startSeconds: number;
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

/** "90", "90s", "1m30s", "1h2m3s" -> seconds. Anything else -> 0. */
export function parseYouTubeTime(raw: string | null | undefined): number {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 0;
  if (/^\d+s?$/.test(value)) return Number.parseInt(value, 10);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match || (!match[1] && !match[2] && !match[3])) return 0;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

function toUrl(token: string): URL | null {
  const cleaned = token.replace(/^[<(]+|[>),.!?]+$/g, '');
  if (!cleaned) return null;
  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function startOf(url: URL): number {
  const fromQuery = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (fromQuery) return parseYouTubeTime(fromQuery);
  // youtu.be/ID#t=1m30s
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return parseYouTubeTime(hash.get('t') ?? hash.get('start'));
}

/** The video in a single URL, or null when it is not a YouTube video link. */
export function parseYouTubeUrl(token: string): YouTubeLink | null {
  const url = toUrl(token);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);

  let videoId: string | null = null;
  if (SHORT_HOSTS.has(host)) {
    videoId = parts[0] ?? null;
  } else if (WATCH_HOSTS.has(host)) {
    if (parts[0] === 'watch' && parts.length === 1) videoId = url.searchParams.get('v');
    else if ((parts[0] === 'shorts' || parts[0] === 'embed') && parts.length >= 2) videoId = parts[1];
  }

  if (!videoId || !VIDEO_ID.test(videoId)) return null;
  return { videoId, startSeconds: startOf(url) };
}

/** The first YouTube video link in the text, or null when there is none. */
export function parseYouTubeLink(text: string | null | undefined): YouTubeLink | null {
  for (const token of (text ?? '').trim().split(/\s+/)) {
    if (!token) continue;
    const link = parseYouTubeUrl(token);
    if (link) return link;
  }
  return null;
}

/** The normal watch page for a video (used for the oEmbed title lookup and the log). */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}
