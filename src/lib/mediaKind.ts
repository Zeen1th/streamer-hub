/** File types the "show a picture" step plays as a video instead of showing as an image. */
export const VIDEO_FILE_EXTENSIONS = ['mp4', 'webm', 'mov'] as const;

/**
 * True when this path or URL is a video file (.mp4 / .webm / .mov). Works on overlay media URLs too, where the file
 * path sits encoded in the query (`/media?path=C%3A%5Cclips%5Cmeme.mp4`).
 */
export function isVideoFile(source: string | null | undefined): boolean {
  if (!source) return false;
  let text = source;
  try {
    text = decodeURIComponent(source);
  } catch {
    // keep the raw text
  }
  return /\.(mp4|webm|mov)(?=$|[?#&])/i.test(text.trim());
}
