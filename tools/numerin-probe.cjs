// ヌメリンの背中に各種を少しずらして落とし、「完全に背中に乗ったまま」かを数える
const M = require('./harness.cjs').load(process.env.SRC);
const base = new M.PhysicsWorld(); base.createBody(M.def.numerin, [0, 1, 0], 0); for (let i = 0; i < 300; i++) base.step();
const nb = base.bodies[0];
for (const id of (process.argv[2] || 'amagaeru,yadoku,daruma,hikigaeru,tonosama,tsuno,goliath').split(',')) {
  const row = [];
  for (const r of [0.0, 0.06, 0.12, 0.2]) {
    let stay = 0, n = 0;
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.283; const W = base.clone(); const def = M.def[id];
      const b = W.createBody(def, [nb.p[0] + Math.cos(a) * r, 2.0 + def.com[1], nb.p[2] + Math.sin(a) * r], a * 0.7);
      for (let i = 0; i < 1500; i++) W.step();
      // 一番下の球が台の上面より上＝ヌメリンだけで支えている
      let minY = Infinity; for (let j = 0; j < b.n; j++) minY = Math.min(minY, W.platform.toLocal(b.ws[j * 3], b.ws[j * 3 + 1], b.ws[j * 3 + 2])[1] - b.rad[j]);
      n++; if (minY > W.platform.h + 0.04 && !b.removed && b.p[1] > -1) stay++;
    }
    row.push(`r${r}:${stay}/${n}`);
  }
  console.log(id.padEnd(10), row.join('  '));
}
