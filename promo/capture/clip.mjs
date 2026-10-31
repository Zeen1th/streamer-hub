// Real-UI captures for the "Create a Clip for the Viewer" demo: the viewer's !clip line, the app's announcement, the leaderboard.
// Writes the screenshots plus a JSON file with where each highlighted row sits, so the animation lines up with the real UI.
import { writeFileSync } from 'node:fs';
import { openApp, goTab, chat, sleep } from './app.mjs';

const OUT = process.argv[2] || 'shots/clip';
const VIEWER = 'zeen1th';
const { browser, page } = await openApp({ width: 1180, height: 640, scale: 2 });
// Bigger UI so the chat reads at the size of a small in-app player
await page.evaluate(() => { document.documentElement.style.zoom = '1.3'; });

// Earlier clips, so the announcement says #3 and the leaderboard has a ranking
await page.evaluate(async () => {
  const { useStatsStore } = await import('/src/store/statsStore.ts');
  const stats = useStatsStore.getState();
  stats.recordClip({ login: 'zeen1th', name: 'zeen1th', url: 'https://clips.twitch.tv/a' });
  stats.recordClip({ login: 'zeen1th', name: 'zeen1th', url: 'https://clips.twitch.tv/b' });
  stats.recordClip({ login: 'sara_gg', name: 'sara_gg', url: 'https://clips.twitch.tv/c' });
});

await goTab(page, 'obs-chat');
await chat(page, 'noura', 'مساء الخير يا الشباب 👋');
await chat(page, 'abu_fahad', 'الجيم هذا رهيب 🔥');
await chat(page, 'faisal', 'شفتوا الحركة هذي؟!');
await chat(page, 'sara_gg', 'لحظة أسطورية 😂');
await sleep(400);

const box = await page.evaluate(() => {
  const r = document.querySelector('main').getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
});

/** Rows of the chat (relative to main, in screenshot pixels) whose text contains each needle. */
const rowsFor = (needles) =>
  page.evaluate((list) => {
    const main = document.querySelector('main').getBoundingClientRect();
    const leaves = [...document.querySelectorAll('main *')].filter((el) => el.children.length === 0 && el.textContent.trim());
    const out = {};
    for (const needle of list) {
      const el = leaves.filter((e) => e.textContent.includes(needle)).pop();
      if (!el) continue;
      let row = el;
      while (row.parentElement && row.getBoundingClientRect().width < main.width * 0.8) row = row.parentElement;
      const r = row.getBoundingClientRect();
      // twice: the screenshots are taken at 2x
      out[needle] = { x: (r.left - main.left) * 2, y: (r.top - main.top) * 2, width: r.width * 2, height: r.height * 2 };
    }
    return out;
  }, needles);

await page.screenshot({ path: `${OUT}-1-chat.png`, clip: box });
const rows1 = await rowsFor(['لحظة أسطورية']);

// The viewer's line on its own (the command is added after this shot, so nothing answers yet)
await chat(page, VIEWER, '!clip');
await sleep(300);
await page.screenshot({ path: `${OUT}-2-command.png`, clip: box });
const rows2 = await rowsFor(['!clip']);

// A real !clip command, built like the Clip Command preset, run for that line
await page.evaluate(async (viewer) => {
  const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
  const store = useSequenceStore.getState();
  const id = store.add('أمر المقطع', {
    triggers: [{ id: crypto.randomUUID(), type: 'twitch_chat', enabled: true, chatCommand: '!clip', matchMode: 'startsWith' }],
    steps: [
      {
        id: crypto.randomUUID(),
        type: 'clip_create',
        clipTitle: 'Clipped by {username}',
        clipLengthSeconds: 30,
        clipAnnounceMessage: '🎬 المقطع رقم {clip_count} صنعه {username} — {clip_url}',
        clipCreateFailMessage: '',
      },
    ],
  });
  await useSequenceStore.getState().runSequence(id, { username: viewer, userLogin: viewer, source: 'chat', userInput: '' });
}, VIEWER);
for (let i = 0; i < 20; i++) {
  if (await page.evaluate(() => document.querySelector('main').innerText.includes('المقطع رقم'))) break;
  await sleep(250);
}
await sleep(400);
await page.screenshot({ path: `${OUT}-3-announce.png`, clip: box });
const rows3 = await rowsFor(['!clip', 'المقطع رقم']);

// Leaderboard on Home, Clips tab
await goTab(page, 'home');
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => /^(Clips|المقاطع)$/.test(b.textContent.trim()));
  tab?.click();
});
await sleep(600);
const board = await page.evaluate(() => {
  const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /^(Leaderboards|لوحات المتصدرين)$/.test(e.textContent.trim()));
  let card = title;
  while (card && card.getBoundingClientRect().height < 200) card = card.parentElement;
  card.scrollIntoView({ block: 'center' });
  const c = card.getBoundingClientRect();
  const li = card.querySelector('li');
  const row = li.getBoundingClientRect();
  const spans = [...li.querySelectorAll('span')];
  const count = spans[spans.length - 1].getBoundingClientRect();
  const rel = (r) => ({ x: (r.left - c.left) * 2, y: (r.top - c.top) * 2, width: r.width * 2, height: r.height * 2 });
  return { clip: { x: c.left, y: c.top, width: c.width, height: c.height }, row: rel(row), count: rel(count) };
});
await sleep(300);
await page.screenshot({ path: `${OUT}-4-leaderboard.png`, clip: board.clip });

const layout = { main: { width: box.width * 2, height: box.height * 2 }, rows1, rows2, rows3, board: { width: board.clip.width * 2, height: board.clip.height * 2, row: board.row, count: board.count } };
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
await browser.close();
