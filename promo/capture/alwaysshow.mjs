// Real-UI captures for "Always show these messages": the real chat overlay page (what OBS shows) hides Nightbot, except the
// one line the streamer pasted into the list in the app's Filters tab.
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CHROME, APP_URL, openApp, goTab, sleep } from './app.mjs';

const OUT = 'shots/always';
const KEEP = 'تابعوني على تويتر وانستقرام 💜';
const LINES = [
  ['noura', 'مساء الخير يا الشباب 👋'],
  ['Nightbot', 'قائمة الأوامر كاملة في الرابط بالبايو'],
  ['abu_fahad', 'الجيم هذا رهيب 🔥'],
  ['Nightbot', KEEP],
  ['sara_gg', 'لحظة أسطورية 😂'],
];

/** The overlay page with its WebSocket replaced, so the capture can play the host's part. */
async function overlayShot(path, alwaysShow) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 620, deviceScaleFactor: 2 });
  await page.evaluateOnNewDocument(() => {
    class FakeSocket extends EventTarget {
      constructor() {
        super();
        this.readyState = 1;
        globalThis.__overlaySocket = this;
        setTimeout(() => this.dispatchEvent(new Event('open')), 0);
      }
      send() {}
      close() {}
    }
    window.WebSocket = FakeSocket;
    globalThis.__overlaySend = (kind, payload) =>
      globalThis.__overlaySocket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ v: 1, id: crypto.randomUUID(), kind, payload }) }));
  });
  await page.goto(`${APP_URL}src/chat-overlay.html`, { waitUntil: 'networkidle0' });
  // a stream-like backdrop behind the transparent overlay
  await page.addStyleTag({ content: 'html,body{background:radial-gradient(800px 500px at 70% 30%,#3a2a4f,#1c2235 60%,#121624)!important}' });
  await page.evaluate(async (keep) => {
    const { DEFAULT_CHAT_OVERLAY_SETTINGS, normalizeChatOverlaySettings } = await import('/src/lib/chatOverlay.ts');
    const base = typeof DEFAULT_CHAT_OVERLAY_SETTINGS === 'function' ? DEFAULT_CHAT_OVERLAY_SETTINGS() : DEFAULT_CHAT_OVERLAY_SETTINGS;
    const settings = normalizeChatOverlaySettings({ ...base, enabled: true, filters: { ...base.filters, hideBots: true, alwaysShowMessages: keep ? [keep] : [] } });
    globalThis.__overlaySend('hello', { settings });
  }, alwaysShow ? KEEP : '');
  await sleep(300);
  for (const [u, m] of LINES) {
    await page.evaluate(
      (user, text) =>
        globalThis.__overlaySend('chat-message', {
          id: crypto.randomUUID(),
          username: user,
          displayName: user,
          userId: `mock-${user}`,
          message: text,
          timestamp: new Date().toISOString(),
          isBroadcaster: false,
          isMod: user === 'Nightbot',
          isVip: false,
          isSubscriber: false,
        }),
      u,
      m,
    );
    await sleep(250);
  }
  await sleep(900);
  await page.screenshot({ path });
  const keepRow = await page.evaluate((keep) => {
    const leaf = [...document.querySelectorAll('body *')].find((e) => e.children.length === 0 && e.textContent.includes(keep));
    if (!leaf) return null;
    let card = leaf;
    // up to the message card: the last ancestor that holds only this message
    while (card.parentElement && !/noura|abu_fahad|sara_gg/.test(card.parentElement.textContent)) card = card.parentElement;
    const r = card.getBoundingClientRect();
    return { x: r.left * 2, y: r.top * 2, w: r.width * 2, h: r.height * 2 };
  }, KEEP);
  const texts = await page.evaluate(() => document.body.innerText);
  await browser.close();
  return { keepRow, texts };
}

const layout = {};
layout.hidden = await overlayShot(`${OUT}-1-hidden.png`, false);
layout.shown = await overlayShot(`${OUT}-3-shown.png`, true);

// The app's Filters tab, with the line pasted into "Always show these messages" (typed in, like a streamer would)
const { browser, page } = await openApp({ width: 1360, height: 820, scale: 2 });
await goTab(page, 'overlay');
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^(الفلاتر|Filters)$/.test(b.textContent.trim()))?.click());
await sleep(600);
const inputAt = await page.evaluate(() => {
  const label = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /أظهر هذه الرسائل دائماً|Always show these messages/.test(e.textContent));
  let field = label;
  while (field && !field.querySelector('input')) field = field.parentElement;
  const input = field.querySelector('input');
  input.scrollIntoView({ block: 'center' });
  const r = input.getBoundingClientRect();
  return { x: r.left + 20, y: r.top + r.height / 2 };
});
await sleep(300);
await page.mouse.click(inputAt.x, inputAt.y);
await page.keyboard.type(KEEP);
await page.keyboard.press('Enter');
await sleep(500);
const panel = await page.evaluate((keep) => {
  const label = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /أظهر هذه الرسائل دائماً|Always show these messages/.test(e.textContent));
  let field = label;
  while (field && !field.querySelector('input')) field = field.parentElement;
  field.scrollIntoView({ block: 'center' });
  const f = field.getBoundingClientRect();
  const chip = [...field.querySelectorAll('button')].find((b) => b.textContent.includes(keep));
  const c = chip?.getBoundingClientRect();
  return { field: { x: f.left, y: f.top, width: f.width, height: f.height }, chip: c && { x: c.left, y: c.top, w: c.width, h: c.height } };
}, KEEP);
await sleep(300);
const pad = 24;
const clip = { x: panel.field.x - pad, y: panel.field.y - pad, width: panel.field.width + pad * 2, height: panel.field.height + pad * 2 };
await page.screenshot({ path: `${OUT}-2-filter.png`, clip });
layout.filter = {
  width: clip.width * 2,
  height: clip.height * 2,
  chip: panel.chip && { x: (panel.chip.x - clip.x) * 2, y: (panel.chip.y - clip.y) * 2, w: panel.chip.w * 2, h: panel.chip.h * 2 },
};
await browser.close();
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
