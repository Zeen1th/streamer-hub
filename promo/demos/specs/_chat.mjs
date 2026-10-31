// Shared pieces for chat-page demos (screenshots from capture/app.mjs openChatScene: 1746 px wide, rows ~104 px apart).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PROMO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const layoutOf = (name) => JSON.parse(readFileSync(join(PROMO, 'shots', `${name}-layout.json`), 'utf8'));

/** The last four chat rows, above the message box. */
export const CHAT_CROP = { x: 0, y: 520, w: 1746, h: 400 };
export const chatView = (src) => ({ src: `shots/${src}`, crop: CHAT_CROP, imageWidth: 1746 });
export const boardView = (src, board) => ({ src: `shots/${src}`, crop: { x: 0, y: 0, w: board.width, h: board.height }, imageWidth: board.width, maxScale: 0.75 });
export const ring = (r, color) => r && { x: r.x, y: r.y, w: r.w, h: r.h, color };
