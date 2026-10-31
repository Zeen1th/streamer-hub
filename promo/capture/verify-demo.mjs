// Opens a "Create a Clip" step in the real Sequence Studio and presses "See how it works".
import { openApp, goTab, sleep } from './app.mjs';

const lang = process.argv[2] || 'ar';
const { browser, page } = await openApp({ width: 1400, height: 860, scale: 1, lang });
await page.evaluate(async () => {
  const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
  useSequenceStore.getState().add('Clip demo test', {
    triggers: [{ id: crypto.randomUUID(), type: 'twitch_chat', enabled: true, chatCommand: '!clip', matchMode: 'startsWith' }],
    steps: [{ id: crypto.randomUUID(), type: 'clip_create', clipTitle: 'Clipped by {username}' }],
  });
});
await goTab(page, 'commands');
const clickText = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const el = [...document.querySelectorAll('button, [role="row"], tr, li, div')].find(
      (e) => e.children.length < 6 && rx.test(e.textContent.trim()) && e.getBoundingClientRect().height > 0,
    );
    el?.click();
    return !!el;
  }, re.source);

const log = [];
log.push(['row', await clickText(/^Clip demo test/)]);
await sleep(600);
// open the studio for it if a button is shown
log.push(['open', await clickText(/^(Open Sequence Studio|فتح استوديو المتسلسلات)$/)]);
await sleep(800);
await page.screenshot({ path: 'shots/verify-1.png' });
const stepAt = await page.evaluate(() => {
  const leaf = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /إنشاء مقطع للمشاهد|Create a clip for the viewer/i.test(e.textContent));
  if (!leaf) return null;
  const r = leaf.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
if (stepAt) await page.mouse.click(stepAt.x, stepAt.y, { clickCount: 2 });
log.push(['step', !!stepAt]);
await sleep(800);
await page.screenshot({ path: 'shots/verify-2.png' });
const hasButton = await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => /See how it works|شاهد كيف يعمل/.test(b.textContent)));
log.push(['button', hasButton]);
if (hasButton) {
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /See how it works|شاهد كيف يعمل/.test(b.textContent)).click());
  await sleep(1500);
  const video = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { src: v.currentSrc, readyState: v.readyState, paused: v.paused, t: v.currentTime, w: v.videoWidth } : null;
  });
  log.push(['video', video]);
  await page.screenshot({ path: 'shots/verify-3.png' });
  await page.keyboard.press('Escape');
  await sleep(400);
  log.push(['editor still open after Esc', await page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => /See how it works|شاهد كيف يعمل/.test(b.textContent)))]);
  log.push(['player closed', await page.evaluate(() => !document.querySelector('video'))]);
}
console.log(JSON.stringify(log));
await browser.close();
