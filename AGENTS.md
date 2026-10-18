# AGENTS.md

AI コーディングエージェント (Claude Code など) 向けの、このリポジトリの説明。
人向けの説明は [README.md](README.md)。

> **最初に:** リポジトリの直下に `LOCAL.md` があれば、作業を始める前に必ず読むこと。
> 手元専用のメモ (環境の設定、今の状態、やること) で、Git には含めていない。ないときは気にしなくてよい。

## 概要

- **3D Browser**: ブラウザの中に「厚みのある箱の形のブラウザ」を表示し、回したり、面をブラウザにしたりして遊ぶ Web アプリ。
- 公開: https://3dbrowser.cantic.org/ (Cloudflare Workers の静的配信)
- **`index.html` (本体) + `plugins/*.js` (内蔵ページ) で動く**。外部ライブラリなし (CSS 3D Transform + 素の JS)。ブラウザで直接開けば動く (`file://` でも動くよう、ES モジュールや fetch は使わず普通の `<script>` で読み込む)。
- ライセンス: MIT

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体 (CSS → HTML → JS の順。約 1,900 行) |
| `plugins/*.js` | 内蔵ページのプラグイン (`draw` お絵描き / `horror` ホラー / `kobito` 小人) |
| `build-plugins.mjs` | `plugins/` の中身を `index.html` の読み込み (`<!-- plugins:begin -->` 〜 `end`) に反映する |
| `README.md` / `docs/*.png` | 人向けの説明とスクリーンショット |
| `wrangler.toml` / `deploy.mjs` | Cloudflare へのデプロイ設定とスクリプト |
| `LICENSE` | MIT |

`LOCAL.md` (手元専用のメモ) はリポジトリに含めない (冒頭の「最初に」を参照)。

## `index.html` の構成

区切りコメント (`/* ---------- … ---------- */`、`// ---------- … ----------`) で検索できる。

### 3D の箱と回転
- 箱 `#box` と 6 面 `.face.front / .back / .side.right / .left / .top / .bottom`。箱の大きさは CSS 変数 `--W` / `--H`、厚みは `--D`。
- 回転の状態は `rx, ry, rz, zoom` (rz = 画面に平行な回転 = ロール、時計回りが +)。箱の変形は `ROT()` = `rotateZ rotateX rotateY`。`apply()` で反映、`turnTo(rx, ry, zoom, rz = 0)` で目標へなめらかに。`tick()` が毎フレーム。
- ドラッグ: 箱の面をつかむと傾ける (rx/ry)。箱の外の背景で、中心から `rollRadius()` より外をつかむとロール。スマホは 2 本指で拡大縮小とひねり (ロール)。
- 操作パネル (`#pad`): スティック、＋/−、⟲ ⟳。矢印キーでも回せる。それぞれロックできる (`stopLatches()` で全部外す):
  - ⟲ ⟳ と ＋/− は `holdGroup()` (`roll` / `zoomer`): 長押しで速さを 3 段階で選び、離すとその速さで続ける。＋/− のロックは `zoomLoop()` で極大 ↔ 極小をループする (範囲の外で `#scene` を薄くして出直す)。
  - スティックは倒したまま `STICK_WAIT + STICK_FILL` 秒ほぼ動かさずにいて離すと、その位置で固定 (`stickLatch`)。
- ブラウザの大きさ: `setSize(w, h, animate, d)` (`boxW / boxH / boxD`、厚みは `D0` = 56 〜 幅・高さの短いほう)。右下のつまみ (`addResizeGrip`、起動時にすべての面に付け、ブラウザにしていない面にも付く。面を閉じても残す。その面に見えている 2 辺を変える: 正面・背面は幅と高さ、左右は厚みと高さ、上下は幅と厚み)、黄/緑の丸 (最小化/最大化)、「サイズ」メニュー (`SIZE_PRESETS`)。リセットで厚みも戻る。見た目の倍率は元の大きさ (定数 `W, H` = 960×600) 基準。

### ブラウザ・タブ・ページ
- `createBrowser(face)` で面をブラウザにする (`openFace` / `closeFace`)。側面は中身を `.squash` で縮めて表示する。
- タブ = 履歴付きの表示領域。`navigate()` → `render()` で中身を描く。
- 検索語は Wikipedia API (言語に合わせて ja/en)、URL は iframe で表示。
- 外のサイトは `createView()` (今は `createIframeView`) で表示する。`element / open / resize / destroy` の形にそろえてある。
- `about:tall` は `navigate()` の中で特別に扱う (ブラウザを超縦長にしてケノンを開く)。

### 内蔵ページ (プラグイン)
- `about:<id>` のページは `registerPage(def)` で `PAGES` に登録する。本体にあるのは `about:this` (自分自身を `?depth=N` で入れ子に) と `about:info`。お絵描き・ホラー・小人は `plugins/*.js` から `B3D.registerPage` で登録する。
- `def`: `id` / `title` (STR のキー) / `info` (説明ページの一覧の説明) / `menu` (スタートページと説明ページに並べる) / `featured` (スタートページの先頭に並べる) / `langRerender` / `glass` (透過モードで中身の背景を透明にする。面に `.glass` が付く。ページ側も白い背景を描かない) / `strings` (`STR` に足す) / `css` / `render(tab, api)`
- ページは本体の中身 (`rx`、`ROT()` など) を直接さわらず、`render` に渡される `api` (`pageApi`) だけを使う: `t` / `pick` / `face()` / `onFrame` / `onCleanup` / `add3d` / `place3d` / `offsetInFace` / `faceGravity` / `faceFacing` / `shake` / `seeThrough` / `giveItem` / `acceptItem` など。
- ページを離れる (別のページへ移る・タブを閉じる・面を閉じる) と、`onFrame` の処理、`add3d` の要素、`acceptItem` の受け取り口は自動で片付く。それ以外は `onCleanup` で登録する。
- ページ間の受け渡しは `giveItem(kind, html, titleKey)` / `acceptItem(kind, el, fn)` (例: ホラーの花 → 小人)。片方のプラグインがなくても壊れない。
- 面の外 (3D 空間) に要素を出すときは `api.add3d(el)` で箱に入れ、`api.place3d(el, face, x, y, z, extra)` で置く。ページ内の座標 → 面の座標は `offsetInFace()`。
- 小人の重力は `faceGravity(face)` で、箱の向きから面の中での「下」を求める。
- プラグインを追加・削除・変更したら `node build-plugins.mjs` を実行する (`index.html` の読み込みと `?v=` を更新)。スタートページはプラグインの読み込みが終わってから (`DOMContentLoaded`) 作る。

### 言語 (日本語 / English)
- 画面に出る文字は**すべて**辞書 `STR` に `[日本語, English]` で入れ、`t(key)` で取り出す (`pick(key)` は配列からランダム)。プラグインの文字は `def.strings` に書く (登録で `STR` に足される)。
- 静的な要素は `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` を付けると `applyLang()` で切り替わる。

### localStorage のキー
`3d-browser-lang` / `3d-browser-pad-hidden` / `3d-browser-pad-used` / `3d-browser-drag-hinted` / `3d-browser-kobito-flowers` / `3d-browser-kobito-lines` / `3d-browser-see-through` (透過の不透明度)

## 作業のルール

- **変更の多い機能を始める前に、今の状態をコミットしておく** (うまくいかなかったら Git で戻せるように)。push とデプロイは頼まれたときだけ。
- コードのコメントは日本語。まわりのコードの書き方 (命名、コメントの量) に合わせる。
- 文字を追加・変更したら、日本語と英語の両方を用意する。
- `about:info` (説明ページ) は、パソコンの画面では 1 画面に収まるようにする (日本語・英語とも)。
- iframe で表示するサイトを追加するときは、実際に中で表示されるか確かめる (下の「ハマりどころ」)。
- README の機能一覧も更新する。
- 新しい内蔵ページは `plugins/` にプラグインとして作り、本体の機能は `api` 経由で使う。`api` に足りない機能は、本体の `pageApi` に足す。

## ハマりどころ

- **iframe の埋め込み拒否**: 多くのサイト (Google, X など) は `X-Frame-Options` / CSP で拒否する。ヘッダーが OK でも、JS で iframe を検知して真っ白になるサイトがある (WindowSwap 等)。
  - 中で表示できると確認済み: Wikipedia、ケノン.com、zoomquilt.org、WebGL Aquarium (webglsamples.org)、cantic.org、earthcam.com
  - X は個別ポストの埋め込み (`platform.twitter.com/embed/Tweet.html?id=…`) なら表示できる。
- **YouTube**: 動画ページ (`watch?v=` など) は iframe での表示を拒否される。`youtubeEmbed()` で埋め込み用の URL (`/embed/…`) に変え、そのときだけリファラー (サイト名) を送る (ほかのサイトは `no-referrer`)。リファラーが無いと「エラー 153」になるので、`file://` で開いたときは表示できない (確認はローカルのサーバー経由で)。
- **クラス名の衝突**: 面が `.left` / `.right` などの汎用クラス名を使っているので、ほかの UI で同じ名前を使うと面のスタイルが当たる (`a-left` のように別名にする)。
- **CSS の `scale()` は z を拡大しない**: 3D 座標を画面に投影する計算で注意。
- **透明な入れ物もクリックを奪う**: `transform-style: preserve-3d` の入れ物は見えない板としてクリックを受ける。必要なら `pointer-events: none` にして面だけ `auto` に。
- **面の CSS トランジションは使わない**: 大きさを変えたときに遅れて追従する。なめらかにしたいときは JS で動かす。
- 改行コード: Git が LF → CRLF の警告を出すが問題なし。

## 確認のしかた

自動テストはない。Playwright (ヘッドレス Chrome / Edge) のスクリプトで操作してスクリーンショットを撮って確認する。

- `index.html` は `file:///…/index.html` で開ける (サーバー不要)。
- 動画コーデックが必要なもの (YouTube など) は `chromium.launch({ channel: 'msedge' })`。
- 3D 変形が重なった要素は Playwright のクリック位置計算がずれるので、`getBoundingClientRect()` の中心を `page.mouse.click()` するほうが確実。
- スマホは `devices['iPhone 13']` などで、パソコンは 1400×900 などで確認する。
- 初回の揺れやパネルの表示は `localStorage` に左右されるので、テストでは必要に応じて `3d-browser-drag-hinted` などを先に入れておく。

## デプロイ

```
node deploy.mjs            # 公開
node deploy.mjs --dry-run  # 確認だけ
```

`node build-plugins.mjs` を実行してから、`index.html`・`plugins/`・`LICENSE` を `dist/` に集めて `npx wrangler@4 deploy` する (Worker 名 `3d-browser`、カスタムドメイン `3dbrowser.cantic.org`)。
コミットしていない変更があると止まる (`--dry-run` は警告だけ)。
反映の流れ: 変更 → コミット → `git push` → `node deploy.mjs`

### バージョン
- `index.html` の `const VERSION = 'v0.1'` を手で上げる。機能を足したり大きく変えたりしたら v0.2、v0.3… (細かい修正だけなら上げなくてよい)。
- `deploy.mjs` が公開用の `dist/index.html` にだけ、デプロイした日付を `BUILD` に書き込む。説明ページの一番下に「v0.1 (2026.10.18)」と出る (手元で開くと「v0.1 (dev)」)。
- 公開したら、そのコミットにローカルのタグ `v0.1-2026.10.18` を自動で付ける (同じ日の 2 回目は `-2`)。GitHub に送るのは push のとき (`git push origin <タグ名>`)。作業用の `before-…` タグは送らない。
