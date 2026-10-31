// Real-UI captures for the shoutout clip demo: "!so @raider" in chat, the app's shoutout line, and the real clip-overlay
// page (what OBS shows) playing a clip. Twitch is not reachable from the mock, so the clip itself is a local sample video.
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { CHROME, APP_URL, openChatScene, chat, mainBox, rowsFor, waitForText, sleep } from './app.mjs';

const OUT = 'shots/so';
const RAIDER = 'basil_raider';

const { browser, page } = await openChatScene([
  ['noura', 'مساء الخير يا الشباب 👋'],
  ['abu_fahad', 'رايد! 🔥🔥'],
  [RAIDER, 'هلا والله وصلنا 💜'],
  ['faisal', 'حيّاكم الله'],
]);
const box = await mainBox(page);
const layout = {};
await chat(page, 'mod_khalid', `!so @${RAIDER}`);
await sleep(300);
await page.screenshot({ path: `${OUT}-1-command.png`, clip: box });
layout.command = (await rowsFor(page, ['!so']))['!so'];

// The real shoutout command: a chat line, then the raider's clip on the clip overlay
await page.evaluate(async () => {
  const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
  const id = useSequenceStore.getState().add('شوت أوت', {
    triggers: [{ id: crypto.randomUUID(), type: 'twitch_chat', enabled: true, chatCommand: '!so', matchMode: 'startsWith' }],
    steps: [
      { id: crypto.randomUUID(), type: 'chat', chatMessage: '📣 شوت أوت لقناة {target} ومقطع من قناته على الشاشة الآن' },
      { id: crypto.randomUUID(), type: 'obs_clip', clipChannel: '{target}', clipSelection: 'top', clipUseClipLength: true, clipShowCaption: true },
    ],
  });
  void useSequenceStore.getState().runSequence(id, { username: 'mod_khalid', userLogin: 'mod_khalid', source: 'chat', userInput: '@basil_raider' });
});
await waitForText(page, 'شوت أوت لقناة');
await sleep(400);
await page.screenshot({ path: `${OUT}-2-reply.png`, clip: box });
layout.reply = (await rowsFor(page, ['شوت أوت لقناة']))['شوت أوت لقناة'];
await browser.close();

// The clip overlay page, fed the same kind of show-clip message the app sends
const b2 = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
const p2 = await b2.newPage();
await p2.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
await p2.evaluateOnNewDocument(() => {
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
});
await p2.goto(`${APP_URL}src/clip-overlay.html`, { waitUntil: 'networkidle0' });
await p2.addStyleTag({
  content:
    'html,body{background:radial-gradient(900px 520px at 75% 25%,#3a2a4f,#1c2235 60%,#121624)!important}' +
    'body::after{content:"● LIVE";position:fixed;top:18px;right:20px;font:700 18px/1 system-ui;color:#fff;background:#dc2626;padding:6px 10px;border-radius:6px}',
});
await p2.evaluate((raider) => {
  globalThis.__overlaySocket.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify({
        v: 1,
        id: crypto.randomUUID(),
        kind: 'show-clip',
        payload: {
          clipId: 'SampleClip',
          videoUrl: '/promo/shots/raider-clip.mp4',
          title: 'CLUTCH 1v4',
          channel: raider,
          durationSeconds: 6,
          volume: 0,
          position: 'center',
          animation: 'zoom',
          size: 62,
          caption: `مقطع من قناة ${raider} 💜`,
        },
      }),
    }),
  );
}, RAIDER);
await sleep(2200);
await p2.screenshot({ path: `${OUT}-3-overlay.png` });
layout.overlay = await p2.evaluate(() => {
  const v = document.querySelector('video');
  let card = v;
  while (card && card.parentElement && card.parentElement.getBoundingClientRect().width < window.innerWidth * 0.9) card = card.parentElement;
  const r = card.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, playing: v && !v.paused, t: v?.currentTime };
});
await b2.close();
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
