// Builds one "See how it works" demo from a spec: real-UI screenshots shown in a window, a caption per beat, rings
// around the rows that matter. Writes a HyperFrames project, checks it, renders it, and encodes a small looping WebM
// into the app (src/assets/demos/<id>.webm).
//
//   node demos/build.mjs <id>            (spec: demos/specs/<id>.mjs, screenshots: shots/)
//   node demos/build.mjs <id> --no-render
import { copyFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMO = resolve(HERE, '..');
const APP_ASSETS = resolve(PROMO, '..', 'src', 'assets', 'demos');
const HF = 'npx --yes hyperframes@0.8.206';

const W = 1280;
const H = 720;
const BOX = { top: 190, maxW: 1180, maxH: 430 };
const FADE = 0.35;

const id = process.argv[2];
const noRender = process.argv.includes('--no-render');
if (!id) throw new Error('usage: node demos/build.mjs <id>');
const spec = (await import(pathToFileURL(join(HERE, 'specs', `${id}.mjs`)).href)).default;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Captions may mark commands with `code`; they become left-to-right isolated spans. */
const caption = (s) => esc(s).replace(/`([^`]+)`/g, '<bdi>$1</bdi>');

const project = join(HERE, id);
rmSync(join(project, 'assets'), { recursive: true, force: true });
mkdirSync(join(project, 'assets'), { recursive: true });

// One window per distinct view (image + crop); consecutive beats on the same view keep the window still
const views = [];
const viewKey = (v) => `${v.src}|${v.crop.x},${v.crop.y},${v.crop.w},${v.crop.h}`;
for (const beat of spec.beats) {
  const key = viewKey(beat.view);
  if (!views.find((v) => v.key === key)) {
    const scale = Math.min(BOX.maxW / beat.view.crop.w, BOX.maxH / beat.view.crop.h, beat.view.maxScale ?? 10);
    const w = Math.round(beat.view.crop.w * scale);
    const h = Math.round(beat.view.crop.h * scale);
    views.push({ key, ...beat.view, scale, w, h, left: Math.round((W - w) / 2), top: Math.round(BOX.top + (BOX.maxH - h) / 2) });
    const file = beat.view.src.split('/').pop();
    if (!existsSync(join(project, 'assets', file))) copyFileSync(join(PROMO, beat.view.src), join(project, 'assets', file));
  }
}
const viewOf = (beat) => views.findIndex((v) => v.key === viewKey(beat.view));

// Timeline
let t = 0;
const timed = spec.beats.map((beat, i) => {
  const start = t;
  t += beat.hold;
  return { ...beat, i, start, view: viewOf(beat) };
});
const duration = +(t + 0.6).toFixed(2); // last 0.6 s returns to the first beat for a seamless loop

const html = [];
const js = [];
html.push(`<div class="caption">${timed.map((b) => `<span id="cap${b.i}">${caption(b.caption)}</span>`).join('')}</div>`);

views.forEach((v, vi) => {
  const rings = [];
  timed.forEach((b) => {
    if (b.view !== vi) return;
    (b.rings ?? []).forEach((r, ri) => {
      const x = (r.x - v.crop.x) * v.scale - 6;
      const y = (r.y - v.crop.y) * v.scale - 6;
      const color = r.color ?? '#818cf8';
      rings.push(
        `<div class="ring" id="ring${b.i}_${ri}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${(r.w * v.scale + 12).toFixed(1)}px;height:${(r.h * v.scale + 12).toFixed(1)}px;border-color:${color};box-shadow:0 0 24px ${color}88"></div>`,
      );
    });
    if (b.badge) {
      const x = (b.badge.x - v.crop.x) * v.scale;
      const y = (b.badge.y - v.crop.y) * v.scale;
      rings.push(`<span class="badge" id="badge${b.i}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;background:${b.badge.color ?? '#22c55e'}">${esc(b.badge.text)}</span>`);
    }
  });
  const imgW = (v.imageWidth ?? 0) * v.scale;
  html.push(
    `<div class="win" id="win${vi}" style="left:${v.left}px;top:${v.top}px;width:${v.w}px;height:${v.h}px">` +
      `<img src="assets/${v.src.split('/').pop()}" style="left:${(-v.crop.x * v.scale).toFixed(1)}px;top:${(-v.crop.y * v.scale).toFixed(1)}px;width:${imgW.toFixed(1)}px" alt="" />` +
      rings.join('') +
      `</div>`,
  );
});
timed.forEach((b) => {
  if (b.chip) html.push(`<div class="chip" id="chip${b.i}"><div><i class="spin" id="spin${b.i}"></i>${caption(b.chip)}</div></div>`);
});

// Motion
const E = "'power3.out'";
js.push(`tl.set('#cap0, #win${timed[0].view}', { opacity: 1 }, 0);`);
timed.forEach((b, k) => {
  const prev = timed[k - 1];
  if (k > 0) {
    if (prev.caption !== b.caption) {
      js.push(`tl.to('#cap${prev.i}', { opacity: 0, duration: 0.25 }, ${b.start - 0.1});`);
      js.push(`tl.fromTo('#cap${b.i}', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: ${FADE}, ease: ${E} }, ${b.start});`);
    } else {
      js.push(`tl.set('#cap${prev.i}', { opacity: 0 }, ${b.start}); tl.set('#cap${b.i}', { opacity: 1 }, ${b.start});`);
    }
    if (prev.view !== b.view) {
      js.push(`tl.to('#win${prev.view}', { opacity: 0, y: -16, duration: ${FADE}, ease: ${E} }, ${b.start});`);
      js.push(`tl.fromTo('#win${b.view}', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: ${FADE}, ease: ${E} }, ${b.start});`);
    }
    (prev.rings ?? []).forEach((_, ri) => js.push(`tl.to('#ring${prev.i}_${ri}', { opacity: 0, duration: 0.2 }, ${b.start - 0.05});`));
    if (prev.badge) js.push(`tl.to('#badge${prev.i}', { opacity: 0, duration: 0.2 }, ${b.start - 0.05});`);
    if (prev.chip) js.push(`tl.to('#chip${prev.i}', { opacity: 0, duration: 0.2 }, ${b.start - 0.05});`);
  }
  (b.rings ?? []).forEach((_, ri) =>
    js.push(`tl.fromTo('#ring${b.i}_${ri}', { opacity: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: 0.3, ease: ${E} }, ${b.start + 0.25 + ri * 0.15});`),
  );
  if (b.badge) js.push(`tl.fromTo('#badge${b.i}', { opacity: 0, scale: 0.4, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(2.4)' }, ${b.start + 0.45});`);
  if (b.chip) {
    js.push(`tl.fromTo('#chip${b.i}', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: ${E} }, ${b.start + 0.2});`);
    js.push(`tl.fromTo('#spin${b.i}', { rotation: 0 }, { rotation: ${Math.round(b.hold * 540)}, duration: ${b.hold}, ease: 'none' }, ${b.start});`);
  }
});
// back to the first beat
const last = timed[timed.length - 1];
const end = t;
js.push(`tl.to('#cap${last.i}', { opacity: 0, duration: 0.25 }, ${end - 0.1});`);
(last.rings ?? []).forEach((_, ri) => js.push(`tl.to('#ring${last.i}_${ri}', { opacity: 0, duration: 0.2 }, ${end - 0.1});`));
if (last.badge) js.push(`tl.to('#badge${last.i}', { opacity: 0, duration: 0.2 }, ${end - 0.1});`);
if (last.view !== timed[0].view) {
  js.push(`tl.to('#win${last.view}', { opacity: 0, duration: 0.3 }, ${end - 0.1});`);
  js.push(`tl.fromTo('#win${timed[0].view}', { opacity: 0, y: 0 }, { opacity: 1, y: 0, duration: 0.35, ease: ${E} }, ${end + 0.1});`);
}
js.push(`tl.fromTo('#cap0', { opacity: 0, y: 0 }, { opacity: 1, y: 0, duration: 0.35, ease: ${E} }, ${end + 0.1});`);
js.push(`tl.to({}, { duration: 0.01 }, ${duration - 0.01});`);

const hidden = [
  ...timed.slice(1).map((b) => `#cap${b.i}`),
  ...views.map((_, vi) => `#win${vi}`).filter((s) => s !== `#win${timed[0].view}`),
  '.ring',
  '.badge',
  '.chip',
].join(', ');

const page = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@600&family=IBM+Plex+Sans+Arabic:wght@500;600;700&display=block" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      /* Generated by demos/build.mjs from demos/specs/${id}.mjs: real Streamer Hub screenshots, staged and highlighted. */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #0d1117; font-family: 'IBM Plex Sans Arabic', sans-serif; color: #f0f3f7; }
      #root { position: relative; width: ${W}px; height: ${H}px; overflow: hidden;
        background: radial-gradient(900px 520px at 50% 50%, rgba(99, 102, 241, 0.18), transparent 70%), #0d1117; }
      .clip { position: absolute; inset: 0; }
      .caption { position: absolute; top: 70px; left: 0; right: 0; height: 64px; display: flex; justify-content: center; }
      .caption span { position: absolute; padding: 10px 26px; border-radius: 999px; font-size: 32px; font-weight: 700; white-space: nowrap;
        background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); }
      bdi { font-family: 'IBM Plex Mono', monospace; color: #d8b4fe; direction: ltr; unicode-bidi: isolate; }
      .win { position: absolute; overflow: hidden; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.12); background: #12161c;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5); }
      .win img { position: absolute; height: auto; max-width: none; }
      .ring { position: absolute; border-radius: 12px; border: 3px solid #818cf8; }
      .badge { position: absolute; padding: 2px 12px; border-radius: 999px; font-size: 28px; font-weight: 700; color: #052e16; direction: ltr; }
      .chip { position: absolute; left: 0; right: 0; top: ${BOX.top + BOX.maxH + 22}px; display: flex; justify-content: center; }
      .chip div { display: flex; align-items: center; gap: 14px; padding: 10px 22px; border-radius: 14px; font-size: 28px; font-weight: 600;
        background: rgba(99, 102, 241, 0.16); border: 1px solid rgba(129, 140, 248, 0.45); }
      .spin { width: 26px; height: 26px; border-radius: 50%; border: 4px solid rgba(255, 255, 255, 0.18); border-top-color: #818cf8; }
      ${hidden} { opacity: 0; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="${W}" data-height="${H}">
      <section id="scene" class="clip" data-start="0" data-duration="${duration}" data-track-index="0">
        ${html.join('\n        ')}
      </section>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${js.join('\n      ')}
      window.__timelines['main'] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;

writeFileSync(join(project, 'index.html'), page);
writeFileSync(join(project, 'hyperframes.json'), JSON.stringify({ paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' } }, null, 2));
writeFileSync(join(project, 'meta.json'), JSON.stringify({ id: `demo-${id}`, name: `${id} demo` }));
console.log(`${id}: ${duration}s, ${views.length} view(s), ${timed.length} beat(s)`);

const run = (cmd, cwd = project) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const check = strip(run(`${HF} check`));
const problems = check.split('\n').filter((l) => /✗|Check failed/.test(l));
if (problems.length) {
  console.log(problems.join('\n'));
  if (!process.argv.includes('--force')) process.exit(1);
}
console.log('check passed');
if (noRender) process.exit(0);

mkdirSync(APP_ASSETS, { recursive: true });
const raw = join(project, 'render.webm');
strip(run(`${HF} render --format webm -f 30 -q delivery -o "${raw}"`));
run(`ffmpeg -v error -y -i "${raw}" -c:v libvpx-vp9 -crf 36 -b:v 0 -pix_fmt yuv420p -row-mt 1 -an "${join(APP_ASSETS, `${id}.webm`)}"`);
rmSync(raw, { force: true });
console.log(`rendered ${join(APP_ASSETS, `${id}.webm`)}`);
