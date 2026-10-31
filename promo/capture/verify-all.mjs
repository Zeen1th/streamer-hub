// Checks every "See how it works" button in the real UI: it is there, it opens, and its own video plays.
import { openApp, goTab, sleep } from './app.mjs';

const lang = process.argv[2] || 'ar';
const BUTTON = /See how it works|شاهد كيف يعمل/;
const results = [];

async function pressAndCheck(page, name, expectedFile) {
  const has = await page.evaluate((src) => !![...document.querySelectorAll('button')].find((b) => new RegExp(src).test(b.textContent)), BUTTON.source);
  if (!has) {
    results.push([name, 'NO BUTTON']);
    return;
  }
  await page.evaluate((src) => [...document.querySelectorAll('button')].find((b) => new RegExp(src).test(b.textContent)).click(), BUTTON.source);
  await sleep(1500);
  const v = await page.evaluate(() => {
    const el = document.querySelector('video');
    return el ? { src: el.currentSrc.split('/').pop().split('?')[0], playing: !el.paused && el.currentTime > 0.2, w: el.videoWidth } : null;
  });
  const title = await page.evaluate(() => document.querySelector('[role="dialog"][aria-label] h3')?.textContent);
  results.push([name, v && v.src === expectedFile && v.playing && v.w === 1280 ? 'OK' : 'FAIL', v, title]);
  await page.keyboard.press('Escape');
  await sleep(300);
}

const { browser, page } = await openApp({ width: 1400, height: 860, scale: 1, lang });

// Step editors
const steps = [
  ['clip_create', { type: 'clip_create', clipTitle: 'x' }, 'clip-create.webm'],
  ['obs_clip', { type: 'obs_clip', clipChannel: '{target}' }, 'shoutout-clip.webm'],
  ['duel', { type: 'duel', duelMode: 'random', duelOpponent: '{input}' }, 'duel.webm'],
  ['if', { type: 'if', ifCondition: 'duel_challenger_won', ifThen: [], ifElse: [] }, 'if-branch.webm'],
];
for (const [name, step, file] of steps) {
  const seqName = `verify ${name}`;
  await page.evaluate(async (n, st) => {
    const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
    useSequenceStore.getState().add(n, { triggers: [], steps: [{ id: crypto.randomUUID(), ...st }] });
  }, seqName, step);
  await goTab(page, 'home');
  await goTab(page, 'commands');
  await page.evaluate((n) => {
    const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === n);
    el?.click();
  }, seqName);
  await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /فتح استوديو المتسلسلات|Open Sequence Studio/.test(b.textContent))?.click());
  await sleep(800);
  // double-click the first step row
  const at = await page.evaluate(() => {
    const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /الإجراءات الفرعية|Sub-Actions/.test(e.textContent));
    let panel = title;
    while (panel && panel.getBoundingClientRect().height < 300) panel = panel.parentElement;
    const row = [...panel.querySelectorAll('[draggable="true"]')][0] || [...panel.querySelectorAll('div')].find((d) => d.className.includes('cursor-pointer') && d.className.includes('justify-between'));
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!at) {
    results.push([name, 'NO STEP ROW']);
    continue;
  }
  await page.mouse.click(at.x, at.y, { clickCount: 2 });
  await sleep(700);
  await pressAndCheck(page, name, file);
  await page.keyboard.press('Escape'); // close the editor
  await sleep(300);
}

// Counter page: set command card
await page.evaluate(async () => {
  const { useCounterStore } = await import('/src/store/counterStore.ts');
  useCounterStore.getState().addCounter();
});
await goTab(page, 'home');
await goTab(page, 'commands');
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /^Counter \d+$/.test(e.textContent.trim()));
  el?.click();
});
await sleep(500);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /تعديل الإجراءات|Configure actions/i.test(b.textContent))?.click());
await sleep(800);
await pressAndCheck(page, 'counter_set', 'counter-set.webm');

// Chat overlay: Filters tab
await goTab(page, 'overlay');
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^(الفلاتر|Filters)$/.test(b.textContent.trim()))?.click());
await sleep(600);
await pressAndCheck(page, 'always_show', 'always-show.webm');

for (const r of results) console.log(JSON.stringify(r));
await browser.close();
