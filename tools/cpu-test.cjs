// CPU テスト：つよいCPUが相手の NEXT を考えた配置をするか（oppDef あり/なしで比較）
const { load } = require('./harness.cjs');
const M = load(process.env.SRC);
const DEG = Math.PI / 180;
const dropBase = (W) => { const P = W.platform, rim = P.topPoint()[1] + P.R * Math.sin(P.tilt); return Math.max(Math.max(W.maxTopY(), rim, 0) + 0.7, 1.0); };
const dy = (W) => (d) => dropBase(W) + d.com[1];
function settle(W, sec = 4) { for (let i = 0; i < sec * 120; i++) W.step(); W.events.length = 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ids = ['amagaeru', 'tonosama', 'hikigaeru', 'daruma', 'tsuno', 'numerin', 'ushigaeru', 'goliath'];
let oA = 0, oB = 0, ofA = 0, ofB = 0, sumA = 0, sumB = 0, tiltA = 0, tiltB = 0, fallA = 0, fallB = 0, n = 0, msA = 0;
for (let seed = 1; seed <= 14; seed++) {
  const r = rng(seed), W = new M.PhysicsWorld();
  const k = 2 + Math.floor(r() * 4);
  for (let i = 0; i < k; i++) { const d = M.def[ids[Math.floor(r() * ids.length)]]; const a = r() * 6.28, rr = r() * 1.1; W.createBody(d, [Math.cos(a) * rr, dropBase(W) + d.com[1], Math.sin(a) * rr], r() * 6.28); settle(W, 3); }
  const me = M.def[ids[Math.floor(r() * ids.length)]], opp = M.def[['tsuno', 'goliath', 'ushigaeru', 'tonosama'][seed % 4]];
  const evalMove = (pl) => {
    const t0 = Date.now(); pl.work(1e9); const ms = Date.now() - t0;
    const w = W.clone(); const b = w.createBody(me, [pl.best.x, dy(w)(me), pl.best.z], pl.best.yaw); settle(w, 4);
    const fell = w.bodies.some(o => w.platform.toLocal(...o.p)[1] < -0.5);
    const probe = new M.CpuPlanner(w, me, dy(w), 'hard', rng(99), opp);
    // 相手（ふつう相当・安全重視）が実際に NEXT を置いた結果
    const op = new M.CpuPlanner(w, opp, dy(w), 'normal', rng(5)); op.work(1e9);
    const w2 = w.clone(); w2.createBody(opp, [op.best.x, dy(w2)(opp), op.best.z], op.best.yaw); settle(w2, 4);
    const oppFell = w2.bodies.some(o => w2.platform.toLocal(...o.p)[1] < -0.5) || w2.platform.tilt > 35 * DEG;
    return { ease: probe._oppEase(w, opp), tilt: w.platform.tilt / DEG, fell, ms, oppTilt: oppFell ? 40 : w2.platform.tilt / DEG, oppFell };
  };
  const A = evalMove(new M.CpuPlanner(W, me, dy(W), 'hard', rng(seed * 7), opp));
  const B = evalMove(new M.CpuPlanner(W, me, dy(W), 'hard', rng(seed * 7)));
  oA += A.oppTilt; oB += B.oppTilt; ofA += A.oppFell; ofB += B.oppFell;
  sumA += A.ease; sumB += B.ease; tiltA += A.tilt; tiltB += B.tilt; fallA += A.fell; fallB += B.fell; msA += A.ms; n++;
  console.log(`seed${seed} ${me.short}→相手${opp.short}  相手の置きやすさ: NEXT考慮 ${A.ease.toFixed(2)} / 安全のみ ${B.ease.toFixed(2)}   自分の傾き ${A.tilt.toFixed(1)}° / ${B.tilt.toFixed(1)}°`);
}
console.log(`\n平均 相手の置きやすさ（低いほど嫌な盤面）: NEXT考慮 ${(sumA / n).toFixed(2)}  安全のみ ${(sumB / n).toFixed(2)}`);
console.log(`相手が置いた後の傾き(落下=40°扱い): NEXT考慮 ${(oA / n).toFixed(1)}°  安全のみ ${(oB / n).toFixed(1)}°   相手の落下/転覆: ${ofA} / ${ofB}`);
console.log(`平均 自分の傾き: ${(tiltA / n).toFixed(1)}° / ${(tiltB / n).toFixed(1)}°   落下: ${fallA} / ${fallB}   思考 ${(msA / n).toFixed(0)}ms/手 (node, 分割実行前の合計)`);
