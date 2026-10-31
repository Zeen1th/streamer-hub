// Real-UI captures for the If / Else demo: a duel decides which branch runs; the studio shows the branches, the chat shows the result.
import { writeFileSync } from 'node:fs';
import { openApp, goTab, chat, sleep, mainBox, rowsFor, waitForText } from './app.mjs';

const OUT = 'shots/if';
const explore = process.argv.includes('--explore');
const { browser, page } = await openApp({ width: 1360, height: 820, scale: 2 });
// The studio needs room: normal zoom, log folded away
await page.evaluate(async () => {
  const { useToolStore } = await import('/src/store/toolStore.ts');
  useToolStore.getState().setLogOpen(false);
});

// !duel, then If "the challenger won" -> Then / Else, each a chat message
await page.evaluate(async () => {
  const { rpc } = await import('/src/rpc/index.ts');
  const original = rpc.invoke.bind(rpc);
  globalThis.__sent = [];
  rpc.invoke = (channel, payload, ...rest) => {
    if (channel === 'twitch/send-chat-message') globalThis.__sent.push({ msg: payload?.message, at: Date.now(), stack: new Error().stack.split(String.fromCharCode(10)).slice(2, 8).join(' | ') });
    return original(channel, payload, ...rest);
  };
});
const seqId = await page.evaluate(async () => {
  const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
  const chatStep = (msg) => ({ id: crypto.randomUUID(), type: 'chat', chatMessage: msg });
  return useSequenceStore.getState().add('مبارزة بنتيجة', {
    triggers: [{ id: crypto.randomUUID(), type: 'twitch_chat', enabled: true, chatCommand: '!duel', matchMode: 'startsWith' }],
    steps: [
      {
        id: crypto.randomUUID(),
        type: 'duel',
        duelMode: 'random',
        duelOpponent: '{input}',
        duelTimeoutDuration: 30,
        duelChallengerWinChance: 50,
        duelMessageStart: '⚔️ مبارزة بين {challenger} وخصمه {opponent}',
        duelMessageWin: '💥 الفائز {winner} والخاسر {loser}',
      },
      {
        id: crypto.randomUUID(),
        type: 'if',
        ifCondition: 'duel_challenger_won',
        ifThen: [chatStep('🏆 مبروك يا {username} تستاهل الفوز')],
        ifElse: [chatStep('😢 حظ أوفر يا {username} المرة الجاية')],
      },
    ],
  });
});

// The studio with the sequence open
await goTab(page, 'commands');
const clickLeaf = (re) =>
  page.evaluate((src) => {
    const rx = new RegExp(src);
    const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && rx.test(e.textContent.trim()));
    el?.click();
    return !!el;
  }, re.source);
await clickLeaf(/^مبارزة بنتيجة$/);
await sleep(500);
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /فتح استوديو المتسلسلات|Open Sequence Studio/.test(b.textContent))?.click());
await sleep(900);
const box = await mainBox(page);
await page.screenshot({ path: `${OUT}-1-studio.png`, clip: box });
const studio = await page.evaluate(() => {
  const main = document.querySelector('main').getBoundingClientRect();
  const rel = (r) => ({ x: (r.left - main.left) * 2, y: (r.top - main.top) * 2, w: r.width * 2, h: r.height * 2 });
  const leaves = [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.trim());
  const rowOf = (re, minW = 300) => {
    const el = leaves.find((e) => re.test(e.textContent.trim()));
    if (!el) return null;
    let row = el;
    while (row.parentElement && row.getBoundingClientRect().width < minW) row = row.parentElement;
    return rel(row.getBoundingClientRect());
  };
  const rowNear = (re, maxW) => {
    const el = leaves.find((e) => re.test(e.textContent.trim()));
    if (!el) return null;
    let row = el;
    while (row.parentElement && row.parentElement.getBoundingClientRect().width < maxW) row = row.parentElement;
    return rel(row.getBoundingClientRect());
  };
  const title = leaves.find((e) => /الإجراءات الفرعية|Sub-Actions/.test(e.textContent));
  let panel = title;
  while (panel && panel.getBoundingClientRect().height < 300) panel = panel.parentElement;
  const pw = panel.getBoundingClientRect().width * 0.92;
  return {
    panel: rel(panel.getBoundingClientRect()),
    duel: rowNear(/^تحدي تايم آوت/, pw),
    cond: rowNear(/^إذا المتحدّي فاز$/, pw),
    then: rowNear(/مبروك/, pw),
    else: rowNear(/حظ أوفر/, pw),
    thenBlock: (() => {
      const el = leaves.find((e) => /إذا صحّ/.test(e.textContent));
      return el && rel(el.parentElement.getBoundingClientRect());
    })(),
    elseBlock: (() => {
      const el = leaves.find((e) => /^✗\s*وإلا$/.test(e.textContent.trim()) || /وإلا/.test(e.textContent));
      return el && rel(el.parentElement.getBoundingClientRect());
    })(),
  };
});
if (explore) {
  console.log(JSON.stringify(studio));
  await page.screenshot({ path: `${OUT}-explore.png` });
  await browser.close();
  process.exit(0);
}

// Two real runs in the chat: one the challenger wins (Then), one they lose (Else)
await page.setViewport({ width: 1180, height: 640, deviceScaleFactor: 2 });
await page.evaluate(() => { document.documentElement.style.zoom = '1.3'; });
await goTab(page, 'obs-chat');
for (const [u, m] of [['noura', 'مساء الخير 👋'], ['abu_fahad', 'يلا مبارزة 🔥'], ['faisal', 'ههههه']]) await chat(page, u, m);
// The real chat trigger runs the sequence; only the odds are changed between the two runs so each branch shows
const setOdds = (chance) =>
  page.evaluate(
    async (id, c) => {
      const { useSequenceStore } = await import('/src/store/sequenceStore.ts');
      const store = useSequenceStore.getState();
      const duel = store.sequences.find((x) => x.id === id).steps[0];
      store.updateStep(id, duel.id, { duelChallengerWinChance: c });
    },
    seqId,
    chance,
  );
await setOdds(99);
await chat(page, 'zeen1th', '!duel @sara_gg');
await waitForText(page, 'مبروك', 8000);
await sleep(400);
const cbox = await mainBox(page);
await page.screenshot({ path: `${OUT}-2-win.png`, clip: cbox });
const win = await rowsFor(page, ['مبروك']);
console.log('mabrouk rows:', await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.includes('مبروك')).length));

await sleep(1500); // let the first run finish
await setOdds(1);
await chat(page, 'sara_gg', '!duel @zeen1th');
await waitForText(page, 'حظ أوفر', 8000);
await sleep(400);
await page.screenshot({ path: `${OUT}-3-lose.png`, clip: cbox });
const lose = await rowsFor(page, ['حظ أوفر']);
console.log('rows at shot 3:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && e.textContent.includes('مبروك')).map((e) => e.closest('[class*=group]')?.outerHTML.length + ' ' + e.textContent))));

const sends = await page.evaluate(() => globalThis.__sent.filter((x) => /مبروك/.test(x.msg)));
console.log('mabrouk sends:', sends.length);
console.log('store copies:', JSON.stringify(await page.evaluate(async () => { const { useObsChatStore } = await import('/src/store/obsChatStore.ts'); return useObsChatStore.getState().messages.filter((m) => /مبروك/.test(m.message)).map((m) => ({ id: m.id, self: m.isSelf, user: m.username, uid: m.userId, ts: m.timestamp, text: m.message })); })));
sends.forEach((x) => console.log(new Date(x.at).toISOString(), x.stack));
const layout = { studio, win: win['مبروك'], lose: lose['حظ أوفر'] };
writeFileSync(`${OUT}-layout.json`, JSON.stringify(layout, null, 2));
console.log(JSON.stringify(layout));
await browser.close();
