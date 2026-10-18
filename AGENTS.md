# AGENTS.md

AI コーディングエージェント (Claude Code など) 向けの、このリポジトリの説明。
人向けの説明は [README.md](README.md)。

> **最初に:** リポジトリの直下に `LOCAL.md` があれば、作業を始める前に必ず読むこと。
> 手元専用のメモ (環境の設定、今の状態、やること) で、Git には含めていない。ないときは気にしなくてよい。

## 概要

- **3D Browser**: ブラウザの中に「厚みのある箱の形のブラウザ」を表示し、回したり、面をブラウザにしたりして遊ぶ Web アプリ。
- 公開: https://3dbrowser.cantic.org/ (Cloudflare Workers の静的配信)
- **`index.html` 1 ファイルだけで動く**。ビルドなし、外部ライブラリなし (CSS 3D Transform + 素の JS)。ブラウザで直接開けば動く。
- ライセンス: MIT

## ファイル

| ファイル | 役割 |
|---|---|
| `index.html` | アプリ本体 (CSS → HTML → JS の順。約 3,000 行) |
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
- 操作パネル (`#pad`): スティック、＋/−、⟲ ⟳。⟲ ⟳ は長押しで速さを 3 段階で選び、離すとその速さで回り続ける (`ROLL_STAGES`、`rollLatch`)。矢印キーでも回せる。
- ブラウザの大きさ: `setSize(w, h)`。右下のつまみ、黄/緑の丸 (最小化/最大化)、「サイズ」メニュー (`SIZE_PRESETS`)。見た目の倍率は元の大きさ (定数 `W, H` = 960×600) 基準。

### ブラウザ・タブ・ページ
- `createBrowser(face)` で面をブラウザにする (`openFace` / `closeFace`)。側面は中身を `.squash` で縮めて表示する。
- タブ = 履歴付きの表示領域。`navigate()` → `render()` で中身を描く。
- 検索語は Wikipedia API (言語に合わせて ja/en)、URL は iframe で表示。
- 内蔵ページは `INTERNAL` に登録する: `about:this` (自分自身を `?depth=N` で入れ子に) / `about:draw` / `about:horror` / `about:kobito` / `about:info` / `about:tall`
- 面の外 (3D 空間) に要素を出すときは `place3d(el, face, x, y, z, extra)`、ページ内の座標 → 面の座標は `offsetInFace()`。
- 小人 (`about:kobito`) の重力は `faceGravity(face)` で、箱の向きから面の中での「下」を求める。

### 言語 (日本語 / English)
- 画面に出る文字は**すべて**辞書 `STR` に `[日本語, English]` で入れ、`t(key)` で取り出す (`pick(key)` は配列からランダム)。
- 静的な要素は `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` を付けると `applyLang()` で切り替わる。

### localStorage のキー
`3d-browser-lang` / `3d-browser-pad-hidden` / `3d-browser-pad-used` / `3d-browser-drag-hinted` / `3d-browser-kobito-flowers`

## 作業のルール

- **変更の多い機能を始める前に、今の状態をコミットしておく** (うまくいかなかったら Git で戻せるように)。push とデプロイは頼まれたときだけ。
- コードのコメントは日本語。まわりのコードの書き方 (命名、コメントの量) に合わせる。
- 文字を追加・変更したら、日本語と英語の両方を用意する。
- `about:info` (説明ページ) は、パソコンの画面では 1 画面に収まるようにする (日本語・英語とも)。
- iframe で表示するサイトを追加するときは、実際に中で表示されるか確かめる (下の「ハマりどころ」)。
- README の機能一覧も更新する。

## ハマりどころ

- **iframe の埋め込み拒否**: 多くのサイト (Google, X など) は `X-Frame-Options` / CSP で拒否する。ヘッダーが OK でも、JS で iframe を検知して真っ白になるサイトがある (WindowSwap 等)。
  - 中で表示できると確認済み: Wikipedia、ケノン.com、zoomquilt.org、WebGL Aquarium (webglsamples.org)、cantic.org、earthcam.com
  - X は個別ポストの埋め込み (`platform.twitter.com/embed/Tweet.html?id=…`) なら表示できる。
- **YouTube 埋め込み**: iframe に `referrerPolicy="no-referrer"` を付けているので「エラー 153」になる。
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

`index.html` と `LICENSE` を `dist/` に集めて `npx wrangler@4 deploy` する (Worker 名 `3d-browser`、カスタムドメイン `3dbrowser.cantic.org`)。
反映の流れ: 変更 → コミット → `git push` → `node deploy.mjs`
