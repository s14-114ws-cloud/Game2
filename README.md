# FROG WOBBLE

カエルを交代で台に落とすバランス対戦ゲーム（1ファイル版 `index.html`）。

## 公開（Netlify）
リポジトリをそのまま Netlify に接続するだけで動きます（ビルド不要、`netlify.toml` 参照）。

## オンライン対戦（Extreme Speed の Firebase を流用）
新しい Firebase プロジェクトは作らず、Extreme Speed（`extreme-speed-e4665`）の Realtime Database に
`frogwobble/` という別の場所を作って使います。Extreme Speed のデータ（`rooms/`）には触れません。

- `index.html` の `FIREBASE_CONFIG` には Extreme Speed の Web 設定を入れ済みです。
- 匿名ログインは Extreme Speed で既に有効なので、追加の設定は不要です。

### やること：ルールの更新（コピペ1回）
1. Firebase コンソール → `extreme-speed-e4665` → 構築 → **Realtime Database** → **ルール** タブ
2. エディタの中身を**全部消して**、このリポジトリの **`database.rules.json`** の中身を丸ごと貼り付ける
   （Extreme Speed の今のルール＋`frogwobble` の追記が入った完成版です）
3. **公開** を押す

> ⚠ Extreme Speed（game1 リポジトリ）の `database.rules.json` を今後更新してコンソールに貼り直すときは、
> 末尾の `"frogwobble": { ... }` ブロックも一緒に入れてください。入れ忘れると FROG WOBBLE のオンラインが
> 「サーバーに拒否されました」になります（game1 側の `database.rules.json` にも同じブロックを足しておくのがおすすめ）。

ルールの中身：ログイン済み（匿名）の人だけが読める／書けるのは「部屋を作った人」と「参加した人」だけ／
部屋番号は4けたの数字だけ／2時間以上放置された部屋は作り直せる。

### 遊び方
タイトルの **ONLINE** → 片方が「部屋をつくる」→ 表示された4けたの番号を相手に伝える →
相手が番号を入れて「入る」。どちらかが退出・切断すると部屋は自動で消えます。

しくみ：手番の人の端末が物理計算をして姿勢を約10回/秒で送り、相手はそれを再生します。
STABLE・負けの瞬間に全カエルの正確な状態を送るので、ブラウザの違いで盤面がズレません。

## 開発用
- 性能表示：PC は `F2`（または `` ` ``）、スマホは URL の末尾に `#debug`
- 物理テスト：`node tools/physics-test.cjs`
- CPU テスト：`node tools/cpu-test.cjs`
- ブラウザ通しテスト：`node tools/browser-smoke.cjs <three.min.js r128 のパス>`（Playwright。Firebase はモック）
- Firebase エミュレータでの確認（本物の SDK・ルール）：`npm i firebase-tools firebase` したフォルダに `database.rules.json` と
  `firebase.json` を置き、`npx firebase emulators:exec --project extreme-speed-e4665 --only database,auth "node tools/rules-test.cjs"`
  （ブラウザ通しテストは `FB_EMU=<そのフォルダ>` を付けるとエミュレータ接続になる）
- 音源を分けた軽量版：`node tools/build-lite.cjs` → `dist-lite/index.html` + `dist-lite/audio/*.mp3`
