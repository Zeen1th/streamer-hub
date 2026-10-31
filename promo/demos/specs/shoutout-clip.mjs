import { layoutOf, chatView, ring } from './_chat.mjs';

const L = layoutOf('so');
// The real clip-overlay page (what OBS shows), full frame
const overlay = { src: 'shots/so-3-overlay.png', crop: { x: 0, y: 0, w: 1280, h: 720 }, imageWidth: 1280 };

export default {
  beats: [
    { caption: 'شوت أوت للرايدر: `!so @basil_raider`', hold: 2.0, view: chatView('so-1-command.png'), rings: [ring(L.command, '#a970ff')] },
    { caption: 'التطبيق يرحّب به في الشات', hold: 2.1, view: chatView('so-2-reply.png'), rings: [ring(L.reply)] },
    { caption: 'ويعرض مقطعاً من قناته على البث', hold: 3.0, view: overlay, rings: [ring(L.overlay, '#e879f9')] },
  ],
};
