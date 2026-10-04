// 公開用の軽量版をつくる：index.html の base64 音源を audio/*.mp3 に書き出し、
// HTML 側は相対URLだけにする（Snd._decodeAll が URL を fetch して読む）。
//   node tools/build-lite.cjs [出力先ディレクトリ=dist-lite]
// 出力：dist-lite/index.html（約0.3MB）＋ dist-lite/audio/*.mp3
// ※ OGG にしたい場合は ffmpeg で変換し、拡張子を .ogg にしてここの ext を変えるだけでよい
//   （iPhone Safari は iOS17 未満だと OGG を再生できないので MP3 のままが無難）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-lite'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('const AUDIO_PACK = {'), end = html.indexOf('\n};', start);
if (start < 0 || end < 0) throw new Error('AUDIO_PACK が見つかりません');
const body = html.slice(start, end);
fs.mkdirSync(path.join(out, 'audio'), { recursive: true });
let total = 0;
const lite = body.replace(/^(\s*)(\w+): '([A-Za-z0-9+/=]+)',?$/mg, (m, sp, key, b64) => {
  const buf = Buffer.from(b64, 'base64'), file = `audio/${key}.mp3`;
  fs.writeFileSync(path.join(out, file), buf); total += buf.length;
  return `${sp}${key}: '${file}',`;
});
fs.writeFileSync(path.join(out, 'index.html'), html.slice(0, start) + lite + html.slice(end));
console.log(`index.html ${(fs.statSync(path.join(out, 'index.html')).size / 1024).toFixed(0)}KB + audio ${(total / 1024).toFixed(0)}KB → ${out}`);
