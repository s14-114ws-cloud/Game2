# FROG WOBBLE

カエルを交代で台に落とすバランス対戦ゲーム（1ファイル版 `index.html`）。

## 公開（Netlify）
リポジトリをそのまま Netlify に接続するだけで動きます（ビルド不要、`netlify.toml` 参照）。

## オンライン対戦（Extreme Speed の Firebase を流用）
新しい Firebase プロジェクトは作らず、Extreme Speed のプロジェクトの Realtime Database に
`frogwobble/` という別の場所を作って使います。Extreme Speed のデータには触れません。

1. **設定値を貼る**：Firebase コンソール → Extreme Speed のプロジェクト → ⚙ プロジェクトの設定 →
   「マイアプリ」のウェブアプリの `firebaseConfig` を、`index.html` の `FIREBASE_CONFIG`
   （`[MODULE: Online]` の先頭）に貼る。`databaseURL` も必ず入れる。
   - 同じプロジェクトの中で「アプリを追加（ウェブ）」して FROG WOBBLE 用の appId を作っても良い（プロジェクトは増えない）。
2. **匿名ログインを有効化**：Authentication → Sign-in method → 「匿名」を有効にする。
3. **ルールを追加**：Realtime Database → ルール で、既存の `"rules": { ... }` の中に
   `firebase-rules-frogwobble.json` の `"frogwobble": { ... }` ブロックを**追記**して公開。
   既存の Extreme Speed のルールは消さないこと。
   - 匿名ログインを使いたくない場合は `"auth != null"` を `true` にすれば動く（誰でも frogwobble/ 以下だけ読み書き可能）。
4. **API キーの制限**（設定している場合のみ）：Google Cloud コンソールで API キーに
   HTTP リファラー制限をかけているなら、Netlify のドメイン（`https://<サイト名>.netlify.app/*`）を追加する。
   Authentication → 設定 → 承認済みドメイン にも Netlify のドメインを追加しておくと確実。

遊び方：タイトルの **ONLINE** → 片方が「部屋をつくる」→ 表示された4けたの番号を相手に伝える →
相手が番号を入れて「入る」。どちらかが退出・切断すると部屋は自動で消えます。

しくみ：手番の人の端末が物理計算をして姿勢を約10回/秒で送り、相手はそれを再生します。
STABLE・負けの瞬間に全カエルの正確な状態を送るので、ブラウザの違いで盤面がズレません。

## 開発用
- 性能表示：PC は `F2`（または `` ` ``）、スマホは URL の末尾に `#debug`
- 物理テスト：`node tools/physics-test.cjs`
- CPU テスト：`node tools/cpu-test.cjs`
- ブラウザ通しテスト：`node tools/browser-smoke.cjs <three.min.js r128 のパス>`（Playwright）
- 音源を分けた軽量版：`node tools/build-lite.cjs` → `dist-lite/index.html` + `dist-lite/audio/*.mp3`
