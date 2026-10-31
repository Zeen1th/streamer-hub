// Real-UI captures for the Timeout Duel demo: !duel @someone, the start line, the result with the timeout, the Duels board.
import { writeFileSync } from 'node:fs';
import { openChatScene, chat, mainBox, rowsFor, waitForText, leaderboardShot, sleep } from './app.mjs';

const OUT = 'shots/duel';
const { browser, page } = await openChatScene([
  ['noura', 'مساء الخير يا الشباب 👋'],
  ['abu_fahad', 'الجيم هذا رهيب 🔥'],
  ['sara_gg', 'أحد يتحداني؟ 😏'],
  ['faisal', 'ههههه'],
]);
const box = await mainBox(page);
const layout = { main: { w: box.width * 2, h: box.height * 2 } };

await page.screenshot({ path: `${OUT}-1-chat.png`, clip: box });
await chat(page, 'zeen1th', '!duel @sara_gg');
await sleep(300);
await page.screenshot({ path: `${OUT}-2-command.png`, clip: box });
layout.command = (await rowsFor(page, ['!duel']))['!duel'];

// A real duel command (random mode). The odds favour the challenger so the capture shows a win.
await page.evaluate(async () => {
  const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
  const store = useSequenceStore.getState();
  const id = store.add('مبارزة', {
    triggers: [{ id: crypto.randomUUID(), type: 'twitch_chat', enabled: true, chatCommand: '!duel', matchMode: 'startsWith' }],
    steps: [
      {
        id: crypto.randomUUID(),
        type: 'duel',
        duelMode: 'random',
        duelOpponent: '{input}',
        duelTimeoutDuration: 60,
        duelChallengerWinChance: 99,
        duelMessageStart: '⚔️ مبارزة بين {challenger} وخصمه {opponent} والعملة في الهواء',
        duelMessageWin: '💥 الفائز {winner} والخاسر {loser} تم إسكاته {duration} ثانية 💀',
      },
    ],
  });
  void useSequenceStore.getState().runSequence(id, { username: 'zeen1th', userLogin: 'zeen1th', source: 'chat', userInput: '@sara_gg' });
});
await waitForText(page, 'العملة في الهواء');
await sleep(250);
await page.screenshot({ path: `${OUT}-3-start.png`, clip: box });
layout.start = (await rowsFor(page, ['العملة في الهواء']))['العملة في الهواء'];

await waitForText(page, 'تم إسكاته', 8000);
await sleep(400);
await page.screenshot({ path: `${OUT}-4-result.png`, clip: box });
layout.result = (await rowsFor(page, ['تم إسكاته']))['تم إسكاته'];

layout.board = await leaderboardShot(page, /^(Duels|التحديات)$/, `${OUT}-5-board.png`);
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
await browser.close();
