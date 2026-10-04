// ヘッドレス検証用：index.html から物理・カエルデータ・CPU 部分だけを取り出して Node で動かす
const fs = require('fs'), path = require('path');
function load(file) {
  const html = fs.readFileSync(file || path.join(__dirname, '..', 'index.html'), 'utf8');
  const cut = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('marker ' + a + ' / ' + b); return html.slice(i, j); };
  const src = [
    cut('const E = (c, s', '[MODULE: FrogModels]'),
    cut('const CPU_LEVELS = {', '[MODULE: Tutorial]'),
  ].join('\n').replace(/^if \(typeof module.*$/mg, '').replace(/^\/\/ =+$/mg, '');
  const fn = new Function(src + '\nreturn { cpuDropY, partSpheres, expandParts, FROG_DATA, prepareFrogDefs, PhysicsWorld, PHYS_CFG, CpuPlanner, CPU_LEVELS, quatFromYaw };');
  const M = fn();
  M.prepareFrogDefs();
  M.def = Object.fromEntries(M.FROG_DATA.map(d => [d.id, d]));
  return M;
}
module.exports = { load };
