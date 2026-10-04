// ブラウザでの通し確認（Playwright + Chromium）。node tools/browser-smoke.cjs [three.min.js のパス]
//   ・CDN の three.js はローカルファイルに差し替え、Google Fonts は読まない
//   ・Firebase はメモリ上のモック（Node 側に1つのDB）で2ページをつないでオンライン対戦を確認
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.join(__dirname, '..');
const THREE = process.argv[2] || process.env.THREE_JS;
if (!THREE || !fs.existsSync(THREE)) { console.error('three.min.js (r128) のパスを指定してください'); process.exit(2); }

// ---------- メモリ上の Firebase RTDB モック（Node 側） ----------
const DB = { root: {} }; let pushN = 0; const pages = [];
const split = (p) => p.split('/').filter(Boolean);
function get(p) { let o = DB.root; for (const k of split(p)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : JSON.parse(JSON.stringify(o)); }
function set(p, v) {
  const ks = split(p); let o = DB.root;
  for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || o[ks[i]] === null) o[ks[i]] = {}; o = o[ks[i]]; }
  const last = ks[ks.length - 1];
  if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
  for (const pg of pages) pg.evaluate(([p]) => window.__fbChanged && window.__fbChanged(p), [p]).catch(() => null);
}
async function fbOp(op, p, v) {
  if (op === 'get') return get(p);
  if (op === 'set') { set(p, v); return null; }
  if (op === 'push') { const k = 'k' + String(++pushN).padStart(8, '0'); set(p + '/' + k, v); return k; }
}
const MOCK = () => {
  const listeners = []; const disc = [];
  const snap = (v, key) => ({ val: () => v, exists: () => v !== null && v !== undefined, key });
  const ref = (p) => ({
    child: (k) => ref(p + '/' + k),
    set: (v) => window.__fb('set', p, v),
    remove: () => window.__fb('set', p, null),
    push: async (v) => { const k = await window.__fb('push', p, v); return ref(p + '/' + k); },
    transaction: async (fn) => { const cur = await window.__fb('get', p); const nv = fn(cur); if (nv === undefined) return { committed: false, snapshot: snap(cur) }; await window.__fb('set', p, nv); return { committed: true, snapshot: snap(nv) }; },
    on: (ev, cb) => {
      const L = { p, ev, cb, seen: new Set() }; listeners.push(L);
      window.__fb('get', p).then(v => { if (ev === 'value') cb(snap(v)); else if (v) for (const k of Object.keys(v).sort()) { L.seen.add(k); cb(snap(v[k], k)); } });
    },
    off: () => { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].p === p) listeners.splice(i, 1); },
    onDisconnect: () => ({ remove: () => { disc.push(p); return Promise.resolve(); }, cancel: () => Promise.resolve() }),
  });
  window.__fbDisc = disc;
  window.__fbChanged = async (wp) => {
    for (const L of listeners.slice()) {
      if (!(wp.startsWith(L.p) || L.p.startsWith(wp))) continue;
      const v = await window.__fb('get', L.p);
      if (L.ev === 'value') L.cb(snap(v));
      else if (v) for (const k of Object.keys(v).sort()) if (!L.seen.has(k)) { L.seen.add(k); L.cb(snap(v[k], k)); }
    }
  };
  const app = { name: 'frogwobble', auth: () => ({ signInAnonymously: async () => ({ user: { uid: 'u' + Math.random().toString(36).slice(2, 8) } }) }), database: () => ({ ref }) };
  window.firebase = { apps: [], initializeApp: () => { window.firebase.apps.push(app); return app; }, database: {} };
};

(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const results = []; const ok = (n, c, info = '') => { results.push([c ? 'PASS' : 'FAIL', n, info]); console.log(c ? 'PASS' : 'FAIL', n, info); };
  async function open(viewport = { width: 390, height: 844 }) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', e => page.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::/.test(m.text())) page.errors.push(m.text()); });
    await page.route(/cdnjs\.cloudflare\.com\/.*three\.min\.js/, r => r.fulfill({ path: THREE, contentType: 'application/javascript' }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.exposeFunction('__fb', fbOp);
    await page.addInitScript(MOCK);
    pages.push(page);
    await page.goto(url);
    await page.waitForFunction(() => typeof Game !== 'undefined' && Game.state === 'title', null, { timeout: 120000 });
    return page;
  }
  const S = (page, fn, arg) => page.evaluate(fn, arg);
  const waitState = (page, st, t = 60000) => page.waitForFunction((s) => Game.state === s || (Array.isArray(s) && s.includes(Game.state)), st, { timeout: t });

  const p1 = await open();
  if (!process.env.ONLY_ONLINE) {
  ok('起動〜タイトル', true, await S(p1, () => `quality=${Stage.quality}`));
  // 図鑑・設定
  await p1.click('#btnHow'); ok('図鑑を開く', await S(p1, () => document.querySelectorAll('#zukan .zk').length === 10 && !!document.querySelector('#zukan .trait.slick')), 'ヌメリンに💧アイコン');
  await p1.click('#howClose');
  await p1.click('#btnSet'); ok('設定（環境音スライダー）', await S(p1, () => !!$id('sAmb') && !$id('settings').classList.contains('hidden')));
  await S(p1, () => { const a = $id('sAmb'); a.value = 20; a.dispatchEvent(new Event('input')); });
  ok('環境音の音量が独立して保存', await S(p1, () => Settings.amb === 0.2 && Settings.se !== 0.2 && JSON.parse(localStorage.getItem('frogwobble.settings')).amb === 0.2));
  await p1.click('#setClose');

  // VS CPU（つよい）を数ターン
  await p1.click('#tLvl button[data-v="hard"]');
  await p1.click('#btnCpu');
  await waitState(p1, 'aim');
  let turns = 0, cpuOpp = null;
  for (let i = 0; i < 6 && (await S(p1, () => Game.state)) !== 'over'; i++) {
    const st = await S(p1, () => ({ cpu: Game.isCpu(), state: Game.state }));
    if (st.state === 'aim' && !st.cpu) {
      if (i === 0) { await p1.click('#nextCard'); ok('NEXT タップで入れ替え', await S(p1, () => Game.holds[0] === 1)); }
      await S(p1, () => Game.setAim((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6));
      await p1.click('#dropBtn');
    } else if (st.state === 'aim' && st.cpu) {
      // CPU が planner に相手の NEXT（入れ替え後の queue[1]）を渡しているか
      await p1.waitForFunction(() => Game.state !== 'aim' || (Game.cpuJob && Game.cpuJob.planner), null, { timeout: 30000 });
      const r = await S(p1, () => Game.cpuJob && Game.cpuJob.planner ? { opp: Game.cpuJob.planner.oppDef && Game.cpuJob.planner.oppDef.id, q1: Game.queue[1].id } : null);
      if (r) cpuOpp = r;
    }
    await p1.waitForFunction(() => Game.state === 'stable' || Game.state === 'over', null, { timeout: 90000 }).catch(() => null);
    await p1.waitForFunction(() => Game.state === 'aim' || Game.state === 'over', null, { timeout: 30000 }).catch(() => null);
    turns++;
  }
  ok('CPU に相手の NEXT(oppDef) が渡る', cpuOpp && cpuOpp.opp === cpuOpp.q1, JSON.stringify(cpuOpp));
  ok('VS CPU を数ターン進行', turns >= 3, `${turns}ターン state=${await S(p1, () => Game.state)} count=${await S(p1, () => Game.count)}`);
  // デバッグ表示
  await p1.keyboard.press('F2');
  await p1.waitForTimeout(800);
  const perf = await S(p1, () => $id('perf').textContent);
  ok('隠しデバッグ表示 (F2)', /FPS: \d+/.test(perf) && /Spheres: \d+/.test(perf) && /Contacts/.test(perf), perf.replace(/\n/g, ' | '));
  await p1.keyboard.press('F2');

  // タイトル→チュートリアル（NEXT 入れ替えの章まで）
  await S(p1, () => Game.goTitle());
  await p1.click('#btnTut');
  await waitState(p1, 'aim');
  const tutChapters = await S(p1, () => Tutorial.list.length);
  // 入れ替えの章へジャンプして、実際にタップで進むか
  const holdCh = await S(p1, () => Tutorial.list.findIndex(c => c.steps.some(s => s.until === 'held')));
  await S(p1, (i) => Tutorial.chapter(i, false), holdCh);
  await p1.waitForTimeout(400);
  await p1.click('#nextCard');
  ok('チュートリアル：NEXT 入れ替えを実際に使う', await S(p1, () => Game.def.id === 'amagaeru' && Tutorial.step && Tutorial.step.until === 'ok'), `章数=${tutChapters}`);

  // デイリー・2P の起動
  await S(p1, () => { Tutorial.end(); Game.goTitle(); });
  await p1.click('#btnDaily'); await waitState(p1, 'aim'); ok('DAILY CHALLENGE 開始', await S(p1, () => Game.mode === 'solo'));
  await S(p1, () => Game.goTitle());
  await p1.click('#btn2p'); await waitState(p1, 'aim'); ok('2 PLAYERS 開始', await S(p1, () => Game.mode === 'pvp' && !!$id('timer') && Game.turnTotal === 15));
  await S(p1, () => Game.goTitle());

  // オンライン：設定が空なら案内を表示
  await p1.click('#btnOnline');
  ok('ONLINE：未設定なら案内', await S(p1, () => !$id('onErr').classList.contains('hidden') && /設定/.test($id('onErr').textContent)));
  await p1.click('#onClose');

  }
  // オンライン（モックDB）：2ページで対戦
  const p2 = await open();
  for (const pg of [p1, p2]) await S(pg, () => { FIREBASE_CONFIG.apiKey = 'test'; FIREBASE_CONFIG.databaseURL = 'https://mock'; });
  await p1.click('#btnOnline'); await p1.click('#onCreate');
  await p1.waitForFunction(() => /^\d{4}$/.test($id('onRoom').textContent), null, { timeout: 10000 });
  const code = await S(p1, () => $id('onRoom').textContent);
  await p2.click('#btnOnline'); await p2.fill('#onCode', code); await p2.click('#onJoin');
  await waitState(p1, 'aim'); await waitState(p2, 'aim');
  const qa = await S(p1, () => Game.queue.map(d => d.id).join()), qb = await S(p2, () => Game.queue.map(d => d.id).join());
  ok('ONLINE：部屋作成→参加→同じ順番で開始', qa === qb, `room=${code} queue=${qa}`);
  let match = true, played = 0;
  for (let t = 0; t < 4; t++) {
    const act = (await S(p1, () => Online.myTurn())) ? p1 : p2, other = act === p1 ? p2 : p1;
    if (t === 1) { await act.click('#nextCard'); await other.waitForFunction(() => Game.holds[Game.cur] === 1, null, { timeout: 5000 }).catch(() => null); }
    await S(act, () => Game.setAim(0.3 * Math.cos(Game.count * 2.1), 0.3 * Math.sin(Game.count * 2.1)));
    await act.waitForTimeout(300);
    await act.click('#dropBtn');
    await other.waitForFunction(() => Game.state === 'drop' && Game.remoteDrop, null, { timeout: 10000 });
    await act.waitForFunction(() => Game.state === 'stable' || Game.state === 'over', null, { timeout: 90000 });
    await other.waitForFunction(() => Game.state === 'stable' || Game.state === 'over', null, { timeout: 20000 });
    const a = await S(act, () => JSON.stringify(Online.packState())), b = await S(other, () => JSON.stringify(Online.packState()));
    if (a !== b) {
      match = false; const A = JSON.parse(a), B = JSON.parse(b);
      for (const k of Object.keys(A)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) console.log('  差分', k, JSON.stringify(A[k]).slice(0, 160), '<>', JSON.stringify(B[k]).slice(0, 160));
    }
    played++;
    if ((await S(act, () => Game.state)) === 'over') break;
    await act.waitForFunction(() => Game.state === 'aim', null, { timeout: 10000 }); await other.waitForFunction(() => Game.state === 'aim', null, { timeout: 10000 });
  }
  ok('ONLINE：毎手のあと両者の盤面が完全一致', match, `${played}手`);
  ok('ONLINE：手番が交互', await S(p1, () => Game.count) === played || (await S(p1, () => Game.state)) === 'over');
  // 退出
  await S(p2, () => Game.goTitle());
  await p1.waitForFunction(() => Game.state === 'title', null, { timeout: 8000 }).catch(() => null);
  ok('ONLINE：相手の退出でタイトルへ', await S(p1, () => Game.state === 'title'));

  for (const pg of pages) for (const e of pg.errors) results.push(['FAIL', 'JS エラー', e]);
  const errs = pages.flatMap(p => p.errors);
  ok('JS エラーなし', errs.length === 0, errs.slice(0, 5).join(' / '));
  await browser.close(); srv.close();
  process.exitCode = results.some(r => r[0] === 'FAIL') ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
