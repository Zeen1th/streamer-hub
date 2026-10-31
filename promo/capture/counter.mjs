// Real-UI captures for the counter "!set" demo: !deaths adds one, a moderator's "!set 6000" jumps the counter.
import { writeFileSync } from 'node:fs';
import { openApp, goTab, sleep, mainBox } from './app.mjs';

const OUT = 'shots/counter';
const explore = process.argv.includes('--explore');
const { browser, page } = await openApp({ width: 1180, height: 500, scale: 2 });
await page.evaluate(() => { document.documentElement.style.zoom = '1.3'; });

/** A chat line from a viewer or a moderator, through the same event path real chat uses. */
const say = (username, message, isMod = false) =>
  page.evaluate(
    (u, m, mod) =>
      globalThis.__mockHost.emitEvent('twitch/chat-message', {
        id: crypto.randomUUID(),
        username: u,
        userLogin: u,
        userId: `mock-${u}`,
        isBroadcaster: false,
        isMod: mod,
        isVip: false,
        isSubscriber: false,
        message: m,
        timestamp: new Date().toISOString(),
      }),
    username,
    message,
    isMod,
  );

// A "Deaths" counter with the set command switched on as "!set" (mods only, the default permission)
await page.evaluate(async () => {
  const { useCounterStore } = await import('/src/store/counterStore.ts');
  const store = useCounterStore.getState();
  store.addCounter();
  const id = useCounterStore.getState().selectedId;
  store.updateName(id, 'الوفيات');
  store.updateCommand(id, 'increase', { commandName: 'deaths', cooldownSeconds: 0 });
  store.updateSetCommand(id, { enabled: true, commandName: 'set', permission: 'mod', cooldownSeconds: 0 });
});
await sleep(300);
await say('mod_khalid', '!set 41', true);
await sleep(300);

await goTab(page, 'commands');
await page.evaluate(() => {
  const row = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'الوفيات');
  row?.click();
});
await sleep(500);
const box = await mainBox(page);
if (explore) {
  await page.screenshot({ path: `${OUT}-explore.png` });
  await browser.close();
  process.exit(0);
}

/** Count badge of the counter row, and the log lines that mention `needles` (screenshot px, relative to main). */
const measure = (needles) =>
  page.evaluate((list) => {
    const main = document.querySelector('main').getBoundingClientRect();
    const rel = (r) => ({ x: (r.left - main.left) * 2, y: (r.top - main.top) * 2, w: r.width * 2, h: r.height * 2 });
    const leaves = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim());
    const name = leaves.find((e) => e.textContent.trim() === 'الوفيات');
    let row = name;
    while (row && row.getBoundingClientRect().width < 400) row = row.parentElement;
    const badge = [...row.querySelectorAll('*')].find((e) => e.children.length === 0 && /^\d+$/.test(e.textContent.trim()));
    const lines = {};
    for (const n of list) {
      const el = leaves.filter((e) => e.textContent.includes(n)).pop();
      if (!el) continue;
      let line = el;
      while (line.parentElement && line.getBoundingClientRect().width < 500) line = line.parentElement;
      lines[n] = rel(line.getBoundingClientRect());
    }
    return { row: rel(row.getBoundingClientRect()), badge: { ...rel(badge.getBoundingClientRect()), text: badge.textContent.trim() }, lines };
  }, needles);

const layout = { main: { w: box.width * 2, h: box.height * 2 } };
await page.screenshot({ path: `${OUT}-1-start.png`, clip: box });
layout.s1 = await measure([]);
await say('zeen1th', '!deaths');
await sleep(600);
await page.screenshot({ path: `${OUT}-2-plus.png`, clip: box });
layout.s2 = await measure(['!deaths']);
await say('mod_khalid', '!set 6000', true);
await sleep(600);
await page.screenshot({ path: `${OUT}-3-set.png`, clip: box });
layout.s3 = await measure(['!set 6000', '6000']);
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
await browser.close();
