// RTDB ルールの確認（Firebase エミュレータ上で実行）
//   cd <firebase-tools と firebase を入れたディレクトリ> &&
//   npx firebase emulators:exec --project extreme-speed-e4665 --only database,auth "node /path/to/tools/rules-test.cjs"
const base = process.env.FB_DIR || process.cwd();
const firebase = require(base + '/node_modules/firebase/compat/app').default;
require(base + '/node_modules/firebase/compat/auth'); require(base + '/node_modules/firebase/compat/database');
const cfg = { apiKey: 'test', projectId: 'extreme-speed-e4665', databaseURL: 'https://extreme-speed-e4665-default-rtdb.asia-southeast1.firebasedatabase.app' };
const mk = async (name, login = true) => {
  const app = firebase.initializeApp(cfg, name); app.auth().useEmulator('http://127.0.0.1:9099'); app.database().useEmulator('127.0.0.1', 9000);
  if (login) await app.auth().signInAnonymously();
  return { app, uid: login ? app.auth().currentUser.uid : null, db: app.database() };
};
const R = 'frogwobble/v1/rooms/';
const res = []; const t = async (name, expectOk, fn) => { let okv; try { await fn(); okv = true; } catch (e) { okv = false; } res.push([okv === expectOk ? 'PASS' : 'FAIL', name, okv ? '許可' : '拒否']); };
(async () => {
  const H = await mk('host'), G = await mk('guest'), X = await mk('other'), N = await mk('anon', false);
  await t('ホストが部屋を作れる', true, () => H.db.ref(R + '1234').set({ v: 1, created: Date.now(), seed: 1, timer: '15', host: H.uid }));
  await t('他人の uid で部屋を作れない', false, () => X.db.ref(R + '5555').set({ v: 1, created: Date.now(), host: H.uid }));
  await t('未ログインは読めない', false, () => N.db.ref(R + '1234').once('value'));
  await t('未ログインは書けない', false, () => N.db.ref(R + '9999').set({ v: 1, created: Date.now(), host: 'x' }));
  await t('ゲストが参加できる', true, () => G.db.ref(R + '1234/guest').set(G.uid));
  await t('3人目は参加を上書きできない', false, () => X.db.ref(R + '1234/guest').set(X.uid));
  await t('3人目はイベントを書けない', false, () => X.db.ref(R + '1234/ev').push({ t: 'drop' }));
  await t('3人目は読むことはできる(観戦)', true, () => X.db.ref(R + '1234').once('value'));
  await t('ホストはイベントを書ける', true, () => H.db.ref(R + '1234/ev').push({ by: 0, t: 'hold' }));
  await t('ゲストは姿勢を書ける', true, () => G.db.ref(R + '1234/snap').set({ by: 1, s: 1 }));
  await t('部屋番号が4けた数字以外は不可', false, () => H.db.ref(R + 'ABCD').set({ v: 1, created: Date.now(), host: H.uid }));
  await t('3人目は部屋を消せない', false, () => X.db.ref(R + '1234').remove());
  await t('ゲストは部屋を消せる(退出)', true, () => G.db.ref(R + '1234').remove());
  await H.db.ref(R + '7777').set({ v: 1, created: Date.now() - 3 * 3600e3, host: H.uid });
  await t('2時間以上前の放置部屋は別の人が作り直せる', true, () => X.db.ref(R + '7777').set({ v: 1, created: Date.now(), host: X.uid }));
  await t('Extreme Speed 側(rooms)は従来どおり：直下一覧は読めない', false, () => H.db.ref('rooms').once('value'));
  await t('ルート直下の他の場所には書けない', false, () => H.db.ref('other').set(1));
  for (const r of res) console.log(r.join(' '));
  process.exit(res.some(r => r[0] === 'FAIL') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
