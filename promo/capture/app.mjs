// Drives the real Streamer Hub UI (vite dev server in mock mode) in headless Chrome, for demo captures.
import puppeteer from 'puppeteer-core';

export const CHROME =
  'C:/Users/PC/.cache/hyperframes/chrome/chrome-headless-shell/win64-152.0.7977.30/chrome-headless-shell-win64/chrome-headless-shell.exe';
export const APP_URL = 'http://localhost:5173/';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openApp({ width = 1440, height = 900, scale = 2, lang = 'ar' } = {}) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars'] });
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  // No guided tour or what's-new on top of the capture
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('streamer-hub-tour-done', '1');
    localStorage.setItem('streamer-hub-last-seen-version', '99.0.0');
  });
  await page.goto(APP_URL, { waitUntil: 'networkidle0' });
  await sleep(1500);
  await page.evaluate(async (language) => {
    const { useSettingsStore } = await import('/src/store/settingsStore.ts');
    useSettingsStore.getState().setLanguage(language);
  }, lang);
  await sleep(800);
  await dismissDialogs(page);
  return { browser, page };
}

/** Closes the mock re-auth prompt and the what's-new dialog if they are up. */
export async function dismissDialogs(page) {
  for (let i = 0; i < 3; i++) {
    const closed = await page.evaluate(() => {
      const texts = [/Remind Me Later/, /ذكرني لاحق/, /^Got it$/, /^فهمت$/, /حسناً/, /^تمام$/];
      const b = [...document.querySelectorAll('button')].find((x) => texts.some((re) => re.test(x.textContent.trim())));
      if (b) b.click();
      return !!b;
    });
    if (!closed) break;
    await sleep(500);
  }
  // Fallback: any open dialog's close (X) button
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"] button[aria-label]').forEach((b) => {
      if (/close|إغلاق/i.test(b.getAttribute('aria-label') || '')) b.click();
    });
  });
  await sleep(300);
}

export async function goTab(page, tab) {
  await page.evaluate(async (t) => {
    const { useToolStore } = await import('/src/store/toolStore.ts');
    useToolStore.getState().setTab(t);
  }, tab);
  await sleep(700);
}

export async function chat(page, username, message) {
  await page.evaluate((u, m) => globalThis.__mockHost.simulateChat({ username: u, message: m }), username, message);
  await sleep(400);
}

export async function shot(page, path, clip) {
  await page.screenshot({ path, clip, captureBeyondViewport: false });
}

/** Box of the page's main area (CSS px), for screenshots of just that area. */
export const mainBox = (page) =>
  page.evaluate(() => {
    const r = document.querySelector('main').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

/**
 * For each needle, the chat row (full-width line) whose text contains it, relative to `main`, in screenshot pixels
 * (`scale` = deviceScaleFactor). The last matching row wins.
 */
export const rowsFor = (page, needles, scale = 2) =>
  page.evaluate(
    (list, s) => {
      const main = document.querySelector('main').getBoundingClientRect();
      const leaves = [...document.querySelectorAll('main *')].filter((el) => el.children.length === 0 && el.textContent.trim());
      const out = {};
      for (const needle of list) {
        const el = leaves.filter((e) => e.textContent.includes(needle)).pop();
        if (!el) continue;
        let row = el;
        while (row.parentElement && row.getBoundingClientRect().width < main.width * 0.8) row = row.parentElement;
        const r = row.getBoundingClientRect();
        out[needle] = { x: (r.left - main.left) * s, y: (r.top - main.top) * s, w: r.width * s, h: r.height * s };
      }
      return out;
    },
    needles,
    scale,
  );

/** Waits until the main area's text contains `text` (up to `ms`). */
export async function waitForText(page, text, ms = 6000) {
  for (let waited = 0; waited < ms; waited += 200) {
    if (await page.evaluate((t) => document.querySelector('main').innerText.includes(t), text)) return true;
    await sleep(200);
  }
  return false;
}

/** Home > Leaderboards on the tab matching `tabRe`; screenshots the card and returns its first row (screenshot px). */
export async function leaderboardShot(page, tabRe, path, scale = 2) {
  await goTab(page, 'home');
  await page.evaluate((src) => {
    const re = new RegExp(src);
    [...document.querySelectorAll('button[role="tab"]')].find((b) => re.test(b.textContent.trim()))?.click();
  }, tabRe.source);
  await sleep(600);
  const info = await page.evaluate((s) => {
    const title = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /^(Leaderboards|لوحات المتصدرين)$/.test(e.textContent.trim()));
    let card = title;
    while (card && card.getBoundingClientRect().height < 200) card = card.parentElement;
    card.scrollIntoView({ block: 'center' });
    const c = card.getBoundingClientRect();
    const li = card.querySelector('li');
    const row = li ? li.getBoundingClientRect() : null;
    const spans = li ? [...li.querySelectorAll('span')] : [];
    const count = spans.length ? spans[spans.length - 1].getBoundingClientRect() : null;
    const rel = (r) => r && { x: (r.left - c.left) * s, y: (r.top - c.top) * s, w: r.width * s, h: r.height * s };
    return { clip: { x: c.left, y: c.top, width: c.width, height: c.height }, row: rel(row), count: rel(count) };
  }, scale);
  await sleep(300);
  await page.screenshot({ path, clip: info.clip });
  return { width: info.clip.width * scale, height: info.clip.height * scale, row: info.row, count: info.count };
}

/** Fresh app with the chat page open and a few viewers talking (zoomed so chat reads in a small player). */
export async function openChatScene(lines) {
  const app = await openApp({ width: 1180, height: 640, scale: 2 });
  await app.page.evaluate(() => { document.documentElement.style.zoom = '1.3'; });
  await goTab(app.page, 'obs-chat');
  for (const [user, text] of lines) await chat(app.page, user, text);
  await sleep(400);
  return app;
}
