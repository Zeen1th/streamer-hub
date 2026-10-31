import { layoutOf, ring } from './_chat.mjs';

const L = layoutOf('always');
// The real chat overlay page (what OBS shows), around the chat block
const overlay = (src) => ({ src: `shots/${src}`, crop: { x: 20, y: 500, w: 680, h: 340 }, imageWidth: 1520 });
// The app's Filters tab: just the "Always show these messages" field
const filter = { src: 'shots/always-2-filter.png', crop: { x: 470, y: 30, w: 714, h: 326 }, imageWidth: L.filter.width };

// The pasted entry as drawn in the screenshot (the field lays its chips out right to left, so the DOM box of the
// row does not match where the chip shows)
const CHIP = { x: 488, y: L.filter.chip.y, w: L.filter.chip.w, h: L.filter.chip.h };

export default {
  beats: [
    { caption: 'Nightbot مخفي من الشات على البث', hold: 2.1, view: overlay('always-1-hidden.png') },
    { caption: 'انسخ سطراً من Nightbot والصقه هنا', hold: 2.5, view: filter, rings: [{ ...CHIP, color: '#22c55e' }] },
    { caption: 'يظهر هذا السطر فقط والباقي يبقى مخفياً', hold: 2.8, view: overlay('always-3-shown.png'), rings: [ring(L.shown.keepRow, '#22c55e')] },
  ],
};
