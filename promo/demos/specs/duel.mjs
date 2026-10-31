import { layoutOf, chatView, boardView, ring } from './_chat.mjs';

const L = layoutOf('duel');
export default {
  beats: [
    { caption: 'مشاهد يتحدّى مشاهد آخر', hold: 1.0, view: chatView('duel-1-chat.png') },
    { caption: 'مشاهد يتحدّى مشاهد آخر', hold: 1.9, view: chatView('duel-2-command.png'), rings: [ring(L.command, '#a970ff')] },
    { caption: 'العملة في الهواء…', hold: 1.9, view: chatView('duel-3-start.png'), rings: [ring(L.start)] },
    { caption: 'الخاسر يُسكت تلقائياً', hold: 2.3, view: chatView('duel-4-result.png'), rings: [ring(L.result, '#f43f5e')] },
    { caption: 'والفوز يُحسب في لوحة التحديات', hold: 2.4, view: boardView('duel-5-board.png', L.board), rings: [ring(L.board.row, '#fbbf24')] },
  ],
};
