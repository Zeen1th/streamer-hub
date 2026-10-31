import { layoutOf, chatView, ring } from './_chat.mjs';

const L = layoutOf('if');
const S = L.studio;
// The Sub-Actions list: the duel step, the If and its two branches
const studio = { src: 'shots/if-1-studio.png', crop: { x: S.duel.x - 40, y: S.duel.y - 40, w: S.duel.w + 80, h: S.elseBlock.y + S.elseBlock.h - S.duel.y + 80 }, imageWidth: 2200 };

export default {
  beats: [
    { caption: 'مبارزة أولاً…', hold: 1.8, view: studio, rings: [ring(S.duel, '#fbbf24')] },
    { caption: 'ثم «إذا»: هل فاز المتحدّي؟', hold: 2.0, view: studio, rings: [ring(S.cond, '#22d3ee')] },
    { caption: 'نعم ← يُنفَّذ «إذا صحّ»', hold: 1.8, view: studio, rings: [ring(S.thenBlock, '#22c55e')] },
    { caption: 'نعم ← يُنفَّذ «إذا صحّ»', hold: 2.0, view: chatView('if-2-win.png'), rings: [ring(L.win, '#22c55e')] },
    { caption: 'لا ← يُنفَّذ «وإلا»', hold: 1.8, view: studio, rings: [ring(S.elseBlock, '#f43f5e')] },
    { caption: 'لا ← يُنفَّذ «وإلا»', hold: 2.2, view: chatView('if-3-lose.png'), rings: [ring(L.lose, '#f43f5e')] },
  ],
};
