// 物理の最終テスト（ヘッドレス）。node tools/physics-test.cjs
const { load } = require('./harness.cjs');
const M = load();
const DEG = Math.PI / 180;
function world() { return new M.PhysicsWorld(); }
function dropBase(W) {
  const P = W.platform, rim = P.topPoint()[1] + P.R * Math.sin(P.tilt);
  return Math.max(Math.max(W.maxTopY(), rim, 0) + 0.7, 1.0);
}
// ゲームと同じ静止判定で 1 手ぶん進める
function drop(W, id, x, z, yaw = 0, opt = {}) {
  const def = M.def[id];
  const b = W.createBody(def, [x, dropBase(W) + def.com[1], z], yaw);
  const dt = W.cfg.dt; let t = 0, calm = 0, pos = null, fell = false, peak = W.platform.tilt, slideDist = 0, last = b.p.slice();
  while (t < (opt.maxT || 40)) {
    W.extraDamp = t > 10 ? Math.min(4, (t - 10) * 0.5) : 0;
    W.step(); t += dt;
    const P = W.platform; peak = Math.max(peak, P.tilt);
    slideDist += Math.hypot(b.p[0] - last[0], b.p[2] - last[2]); last = b.p.slice();
    for (const o of W.bodies) {
      if (o.removed || o.fallen) continue;
      const lc = P.toLocal(o.p[0], o.p[1], o.p[2]);
      if (lc[1] < -0.6 || Math.hypot(lc[0], lc[2]) > P.R + 1.4 || o.p[1] < -1.7) { o.fallen = true; o.removed = true; fell = true; }
    }
    if (fell) break;
    if (t < 0.4) continue;
    let ok = Math.hypot(P.w[0], P.w[2]) < 0.03; const live = [];
    if (ok) for (const o of W.bodies) { if (o.removed || o.fallen) continue; if (!o.touching || Math.hypot(...o.v) >= 0.05 || Math.hypot(...o.w) >= 0.05) { ok = false; break; } live.push(o); }
    if (!ok) { calm = 0; pos = null; continue; }
    if (!pos) pos = new Map(live.map(o => [o, o.p.slice()]));
    if (live.some(o => Math.hypot(o.p[0] - pos.get(o)[0], o.p[1] - pos.get(o)[1], o.p[2] - pos.get(o)[2]) > 0.03)) { calm = 0; pos = null; continue; }
    calm += dt; if (calm >= 1) break;
  }
  W.extraDamp = 0;
  return { b, t, fell, stable: calm >= 1, tilt: W.platform.tilt / DEG, peak: peak / DEG, slideDist, onTop: W.platform.toLocal(...b.p)[1] };
}
const res = [];
const ok = (name, cond, info) => { res.push([cond ? 'PASS' : 'FAIL', name, info]); };

// 1. アマガエルを中央付近に5匹
{ const W = world(); let r; const pts = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
  const rs = pts.map(([x, z]) => (r = drop(W, 'amagaeru', x, z)));
  ok('1 アマガエル×5 中央で安定', rs.every(r => r.stable && !r.fell), rs.map(r => r.t.toFixed(1) + 's/' + r.tilt.toFixed(1) + '°').join(' ')); }
// 2. ゴライアスを端に
{ const W = world(); const r = drop(W, 'goliath', 1.6, 0);
  ok('2 ゴライアス端で明確に傾く', !r.fell && r.tilt > 8, `tilt=${r.tilt.toFixed(1)}° stable=${r.stable}`); }
// 3. 中央に追加しても復元力が強くならない：同じ偏りトルクでの傾き比較
{ const W1 = world(); drop(W1, 'ushigaeru', 1.2, 0); const t1 = W1.platform.tilt / DEG;
  const W2 = world(); drop(W2, 'hikigaeru', 0, 0); drop(W2, 'hikigaeru', 0, 0.5); drop(W2, 'daruma', 0, -0.5); const tb = W2.platform.tilt / DEG; drop(W2, 'ushigaeru', 1.2, 0); const t2 = W2.platform.tilt / DEG;
  ok('3 中央の重量で復元力が増えない', t2 - tb >= t1 * 0.85, `単体:${t1.toFixed(2)}° / 中央に重り後の増分:${(t2 - tb).toFixed(2)}°`); }
// 3b. 台の復元トルクそのものが載っている重量で変わらない（同じ傾き・角速度0で比較）
{ const tq = (bodies) => { const P = world().platform, a = 10 * DEG; P.n = [Math.sin(a), Math.cos(a), 0]; P.w = [0, 0, 0]; P.applyTorques(1 / 120, bodies, -9.81); return P.w[2]; };
  const w0 = tq([]), w1 = tq([{ mass: 20, p: [0, 1.5, 0] }, { mass: 15, p: [0.1, 0.8, -0.1] }]);
  ok('3b 復元トルクが重量で増えない', Math.abs(w1 - w0) < 1e-12, `空:${w0.toExponential(4)} 重量35kg:${w1.toExponential(4)}`); }
// 4. ヌメリン自身は台の上で滑りにくい（台を傾けて置く）
{ const W = world(); drop(W, 'goliath', 1.5, 0); const before = W.platform.tilt / DEG; const r = drop(W, 'numerin', -0.6, 0.9);
  ok('4 ヌメリン自身は傾いた台でも滑りにくい', !r.fell && r.stable && r.slideDist < 0.35, `台${before.toFixed(1)}° 滑走${r.slideDist.toFixed(2)}m`); }
// 4b. 他のカエルの上（ダルマの背中）でも滑りにくい
{ const W = world(); drop(W, 'daruma', 0, 0); const r = drop(W, 'numerin', 0.05, 0);
  ok('4b ヌメリンはダルマの上でも乗る', !r.fell && r.onTop > 0.2, `高さ${r.onTop.toFixed(2)} 滑走${r.slideDist.toFixed(2)}m stable=${r.stable}`); }
// 5. ヌメリンの背中に雑に置くと滑る
{ let slid = 0, n = 0; const offs = [[0.25, 0.1], [-0.2, 0.2], [0.3, -0.15], [0.15, 0.3], [-0.3, -0.1], [0.22, -0.25]];
  for (const [x, z] of offs) { const W = world(); drop(W, 'numerin', 0, 0); const r = drop(W, 'tonosama', x, z, 0.3); n++; if (r.fell || r.onTop < 0.25 || r.slideDist > 0.3) slid++; }
  ok('5 ヌメリンの背中（雑な位置）は滑りやすい', slid >= 4, `${slid}/${n} で滑り落ち/ずれ`); }
// 6. 背中中央の良い位置なら乗る場合もある
{ const outs = [];
  for (const [id, yaw] of [['amagaeru', 0], ['daruma', 0], ['amagaeru', Math.PI / 2], ['hikigaeru', 0]]) { const W = world(); const nb = drop(W, 'numerin', 0, 0).b; const r = drop(W, id, nb.p[0], nb.p[2] - 0.02, yaw); outs.push(id + ':' + (r.fell ? '落' : r.onTop > 0.25 ? '乗' : 'ずれ')); }
  ok('6 背中中央なら乗せられる場合がある', outs.some(o => o.endsWith('乗')), outs.join(' ')); }
// 7/8. じわじわ滑りは STABLE にならない／完全静止なら約1秒後に STABLE
{ const W = world(); const r = drop(W, 'amagaeru', 0.3, 0.2);
  ok('8 静止後 約1秒で STABLE', r.stable && r.t < 4, `t=${r.t.toFixed(2)}s`); }
{ const W = world(); drop(W, 'goliath', 1.6, 0); drop(W, 'numerin', 1.0, 0.3); const r = drop(W, 'tsuno', 1.1, 0.3, 0, { maxT: 40 });
  ok('7 （参考）傾いたヌメリン上のツノガエル', true, `fell=${r.fell} stable=${r.stable} t=${r.t.toFixed(1)}s 滑走${r.slideDist.toFixed(2)}m`); }
// 9. 低FPS でも結果が変わらない：物理は固定ステップなのでフレーム分割に依存しない（同一入力 → 同一結果）
{ const run = () => { const W = world(); drop(W, 'tonosama', 0.8, 0.3); drop(W, 'hikigaeru', -0.5, 0.2); return W.platform.tilt; };
  const a = run(), b = run(); ok('9 固定ステップで決定的', Math.abs(a - b) < 1e-12, `${(a / DEG).toFixed(4)}° vs ${(b / DEG).toFixed(4)}°`); }
// 各種カエルが平らな台の中央で安定するか（Collider 削減の退行チェック）
{ const outs = []; let all = true;
  for (const d of M.FROG_DATA) { const W = world(); const r = drop(W, d.id, 0, 0, 0.4); if (!r.stable || r.fell) all = false; outs.push(`${d.short}:${r.stable ? r.t.toFixed(1) + 's' : 'NG'}`); }
  ok('全種 単体で中央に安定', all, outs.join(' ')); }
// 20匹積み：所要時間（参考性能）
{ const W = world(); const ids = M.FROG_DATA.map(d => d.id); let n = 0, steps = 0; const t0 = Date.now();
  for (let i = 0; i < 40 && n < 20; i++) { const a = i * 2.4, rr = 0.5 + (i % 3) * 0.35; const r = drop(W, ids[i % ids.length === 9 ? 0 : i % 9], Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.6, a, { maxT: 15 }); steps += r.t / W.cfg.dt; if (r.fell) break; n++; }
  const ms = (Date.now() - t0) / steps; const sph = W.bodies.filter(b => !b.removed).reduce((s, b) => s + b.n, 0);
  ok('参考: 積み上げ', true, `${n}匹 ${sph}球 物理1step平均 ${ms.toFixed(3)}ms (node)`); }
for (const r of res) console.log(r[0], r[1], '|', r[2]);
process.exitCode = res.some(r => r[0] === 'FAIL') ? 1 : 0;
