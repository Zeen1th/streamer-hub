import { layoutOf } from './_chat.mjs';

const L = layoutOf('counter');
// The commands list (counter row) and the live log under it, without the side panel
const crop = { x: 0, y: 180, w: 1122, h: 500 };
const view = (src) => ({ src: `shots/${src}`, crop, imageWidth: 1746 });
const badge = (s, color) => ({ x: s.badge.x, y: s.badge.y, w: s.badge.w, h: s.badge.h, color });
// newest log pair (chat line + trigger line) is always at the top of the log
const logPair = (color) => ({ x: 10, y: 478, w: 1106, h: 104, color });

export default {
  beats: [
    { caption: 'عدّاد الوفيات', hold: 1.7, view: view('counter-1-start.png'), rings: [badge(L.s1, '#818cf8')] },
    {
      caption: 'المشاهد يكتب `!deaths` فيزيد واحداً',
      hold: 2.5,
      view: view('counter-2-plus.png'),
      rings: [logPair('#a970ff'), badge(L.s2, '#22c55e')],
      badge: { text: '+1', x: L.s2.badge.x + L.s2.badge.w + 14, y: L.s2.badge.y - 6 },
    },
    {
      caption: 'والمشرف يكتب `!set 6000` فيضبطه مباشرة',
      hold: 2.8,
      view: view('counter-3-set.png'),
      rings: [logPair('#a970ff'), badge(L.s3, '#fbbf24')],
    },
  ],
};
