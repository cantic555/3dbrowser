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
| `plugins/*.js` | 内蔵ページのプラグイン (`draw` お絵描き / `horror` ホラー / `kobito` 小人 / `phones` スマホ (lPhone。角・ステータスバー・ホーム画面・バッテリーアプリ・自動回転は機種によらず共通で、ほかの機種は別のプラグインから `B3D.addPhone` で足せる) / `shogi` ナガ将棋 (縦に長い 9 × 27 の盤。本将棋のルール、CPU どうしのオート、人 / CPU の切り替え)) |
| `build-plugins.mjs` | `plugins/` の中身を `index.html` の読み込み (`<!-- plugins:begin -->` 〜 `end`) に反映する |
| `README.md` / `docs/*.png` | 人向けの説明とスクリーンショット |
| `wrangler.toml` / `deploy.mjs` | Cloudflare へのデプロイ設定とスクリプト |
| `LICENSE` | MIT |

`LOCAL.md` (手元専用のメモ) はリポジトリに含めない (冒頭の「最初に」を参照)。

## `index.html` の構成

区切りコメント (`/* ---------- … ---------- */`、`// ---------- … ----------`) で検索できる。

### 3D の箱と回転
- 箱 `#box` と 6 面 `.face.front / .back / .side.right / .left / .top / .bottom`。箱の大きさは CSS 変数 `--W` / `--H`、厚みは `--D`。
- 回転の状態は `rx, ry, rz, zoom` (rz = 画面に平行な回転 = ロール、時計回りが +)。箱の変形は `ROT()` = `rotateZ rotateX rotateY`。`apply()` で反映、`turnTo(rx, ry, zoom, rz = 0)` で目標へなめらかに。ドラッグ・スティック・矢印キー・惰性で傾けるときは `tiltScreen(dax, day)` で画面から見た向きに回す (今の向きの手前に回転を掛けてから rz・rx・ry に分け直す。逆さまやロール中でも、右へ動かせば見えている箱が右へ回る)。`tick()` が毎フレーム。
- 視点のずれ (パン): `panU` (拡大率で割った値。画面上のずれは `panPx()` = `panU * zoom`)。`setPan(px, py)` で設定 (箱が画面から出きらないよう制限)、`zoomAt(z, x, y)` は画面の点を基準に拡大。箱の中心は `boxCenter()`。遠近の中心 (`perspective-origin`) も一緒にずらす。Shift + ドラッグ・右ドラッグは捕まえる段階で受けるので、ページの上でも動かせる。拡大率も決める `turnTo` (リセットなど) で真ん中に戻る。ドラッグや 2 本指のパンははじくと惰性で少し動き続ける (`pvx / pvy`、`flingV()` で速さを見積もる。端に当たったらその向きは止める)。
- 全体マップ (`#minimap`): 箱がはみ出したときだけ左上に出す (いつも左上で、操作パネルの配置では動かさない)。`boxOutline()` で箱の 8 つの角を今の向きで投影した輪郭と、見えている範囲を描く。
- ドラッグ: 拡大中 (`zoomedIn()`: 箱が画面の短い辺の `ZOOMED_OVER` 倍より多くはみ出している。判定はドラッグの始めだけ) は、背景や枠のドラッグはパン。PC のカーソルは、パンになる所で手のひら (`body.pan-zone`)、ロールになる所 (玉の縁より外の背景) で回転の矢印 (`body.roll-zone`)。それ以外はトラックボール方式。動きを箱の中心のまわりの接線の向きとそれ以外に分け、接線の分を中心からの距離 (玉の半径 `ballR` = 画面に映る箱がすっぽり入る大きさ。箱が小さければ `rollRadius()`) に応じてロールにし、残りで傾ける (rx/ry)。玉の半径の `ROLL_FROM` 倍までは傾くだけ、玉の縁より外はほぼロール。動き始め (`AXIS_DECIDE` px) でロールの分と傾ける分を比べ、そのドラッグを「ロールだけ」か「傾けるだけ」に決める (混ぜない。`axisLock`)。傾けるときは、真横・真上から `AXIS_SNAP` 度以内なら左右だけ・上下だけ。回転のレバーも `STICK_SNAP` 度以内なら軸にそろえる (`snapAxis`)。スマホは 2 本指で拡大縮小・パン・ひねり (ロール。`TWIST_START` 度を超えてから回る)。2 本目の指が来たら、1 本目で回してしまった分は `touchStartRot` に戻す。
- 操作パネル (`#pad`): ふだんは右下に縦一列、高さが足りない画面 (横持ちのスマホ) では画面の両端に分ける。両端のときは左下 `.pad-l` に回転のスティック (`.rot-stick`) と平行回転のレバー (`.roll-stick`。左右にだけ動き、右で時計回り・左で反時計回り。両端に ⟲ ⟳ の印)、右下 `.pad-r` に拡大縮小のレバー (`.zoom-stick`。つまみに印なし。上下にだけ動き、下に引くと拡大・上に押すと縮小) とその右にパンのレバー (`.pan-stick`。倒している間だけ動く) (`.pan-row` で横に並べる。`layoutPad()` で右下のボタンの列の上に置く)。`PAD_DIM` 秒触らないと薄くする (`.dim`)。縦一列 (`padColumn` = `(min-height: 560px)`) は CSS で (上から 拡大縮小とパン、回転、平行回転。回転と平行回転はパンの真下にそろえる。`.pad-l/.pad-r` を `display: contents` にして `order` で並べる)。矢印キーでも回せる。回転レバーのダブルクリック (ダブルタップ) で**回転禁止** (`noRotate` / `setNoRotate()`。`#pad.no-rotate`、つまみ (🌐) のすぐ下に 🔒): 背景のドラッグはパンになり、レバー・平行回転のレバー・矢印キー・はじき・ひねり・惰性で回らない (`tiltScreen` などの入り口で止める)。もう一度ダブルクリック、レバーのドラッグ、🔒 で解除。パンのレバーも同じく、ダブルクリックで**パン禁止** (`noPan` / `setNoPan()`。`#pad.no-pan`): 背景のドラッグ・レバー・Shift + 矢印・2 本指・惰性で視点が動かず、拡大縮小のレバー (ロックも) で拡大縮小もしない (レバーは薄くする。ホイール・ピンチの拡大縮小の寄せやリセットはそのまま)。印はどちらも `.stick-ban` (つまみのすぐ下の 🔒)。レバーの固定 (下の「ロック」) とは別のもの。それぞれロックできる (`stopLatches()` で全部外す):
  - 平行回転と拡大縮小のレバーは、1 本の向きにだけ動くレバー `axisLever()` (`roll` / `zoomer`)。深く倒すほど速い (`leverRate()`。いっぱいで `ROLL_RATE` / `ZOOM_RATE`)。回転のスティックと同じく、倒したままじっとして輪が一周してから離すとその位置で固定 (`latch` / `setLatch()`。溜めは `charge()` を共用)。拡大縮小の固定中は `zoomLoop()` で極大 ↔ 極小をループする (範囲の外で `#scene` を薄くして出直す)。
  - スティックは倒したまま `STICK_WAIT + STICK_FILL` 秒ほぼ動かさずにいて離すと、その位置で固定 (`stickLatch`)。
  - 回転のスティックを端近く (`FLICK_REACH`) まで `FLICK_TIME` 秒以内にはじくと (上下左右の軸の向きだけ)、その軸で `FLICK_DEG` 度回す (`flickSpin()` → `spin` を `padTick` で回す。はじいている間に回った分は差し引く。回っている途中に同じ向きにはじくと残りに足す。背景のドラッグや `stopStickLatch()` (リセットなど) で止まる)。
- ブラウザの大きさ: `setSize(w, h, animate, d)` (`boxW / boxH / boxD`、厚みは `D0` = 56 〜 幅・高さの短いほう)。右下のつまみ (`addResizeGrip`、起動時にすべての面に付け、ブラウザにしていない面にも付く。面を閉じても残す。その面に見えている 2 辺を変える: 正面・背面は幅と高さ、左右は厚みと高さ、上下は幅と厚み)、黄/緑の丸 (最小化/最大化)、「サイズ」メニュー (`SIZE_PRESETS`)。リセットで厚みも戻る。見た目の倍率は元の大きさ (定数 `W, H` = 960×600) 基準。

### ブラウザ・タブ・ページ
- `createBrowser(face)` で面をブラウザにする (`openFace` / `closeFace`)。側面は中身を `.squash` で縮めて表示する。
- タブ = 履歴付きの表示領域。`navigate()` → `render()` で中身を描く。
- 検索語は Wikipedia API (言語に合わせて ja/en)、URL は iframe で表示。
- 外のサイトは `createView()` (今は `createIframeView`) で表示する。`element / open / resize / destroy` の形にそろえてある。
- `about:tall` は `navigate()` の中で特別に扱う (ブラウザを超縦長にしてケノンを開く)。

### 内蔵ページ (プラグイン)
- `about:<id>` のページは `registerPage(def)` で `PAGES` に登録する。本体にあるのは `about:this` (自分自身を `?depth=N` で入れ子に) と `about:info`。`?url=about:<id>` で開くと、最初にそのページを開く (`startPage`。内蔵ページだけ。外のサイトは悪用されないよう開かない。初回の揺れとヒントも出さない。`instantStart` の間は、箱の形と向きをアニメーションせずにいきなり変える)。お絵描き・ホラー・小人は `plugins/*.js` から `B3D.registerPage` で登録する。
- `def`: `id` / `title` (STR のキー) / `info` (説明ページの一覧の説明) / `menu` (スタートページと説明ページに並べる) / `icon` (絵文字。まとめのページやスマホのフォルダに出す) / `phoneTitle` (スマホのホーム画面に出す名前の STR のキー。なければ `title`。3D ブラウザの上とスマホの中で名前を変えたいとき) / `featured` (スタートページの先頭に並べる) / `group` (`{ id, icon, title, info }`。同じ group のページは、スタートページと説明ページでは 1 つにまとめ、本体が作る `about:<id>` のまとめのページ (パソコンのフォルダの窓のようなアイコン表示) に並べる。スマホのホーム画面では `api.groups()` を使ってフォルダにする。今は `future` (スマホ) と `arcade` (ゲーム)。中のページが 1 つだけでもフォルダにする) / `langRerender` / `glass` (透過モードで中身の背景を透明にする。面に `.glass` が付く。ページ側も白い背景を描かない。`'look'` なら、ガラスの見た目 (`setLook` の `glass`) の中でだけ) / `strings` (`STR` に足す) / `css` / `render(tab, api)`
- ページは本体の中身 (`rx`、`ROT()` など) を直接さわらず、`render` に渡される `api` (`pageApi`) だけを使う: `t` / `pick` / `face()` / `onFrame` / `onCleanup` / `add3d` / `place3d` / `offsetInFace` / `faceGravity` / `faceFacing` / `shake` / `seeThrough` / `roll()` (箱のロールの角度 0〜360) / `faceNormal(face)` (面の表の向き `{ x, y, z }`。画面の右・下・手前が +。傾きに合わせて照り返しを動かすなど。`faceFacing` はその z) / `floatPanel(el, { icon, closed })` (操作パネルを箱の外、画面の右の縦の真ん中に飛び出させる。`closed: true` なら最初は出さず、広い画面でも右の縁のつまみだけ。つまみか `floatOpen(true)` で出したあとはふつう。ホログラム風で、箱の右の縁から光の線でつなぐ。箱の横に空きがない画面では右の縁のつまみ (icon) で出し入れし、箱を触るとしまう。ページを離れると消え、タブが裏に回ると隠れる。返る要素の `floatOpen(true)` でページからも出せる。つまみで出したときは、返る要素に `floatopen` イベントが来る) / `floatOver(el, anchor)` (要素を箱の手前、画面の上で anchor (省略なら面) の見えている部分の真ん中に重ねる。箱の向きや大きさで縮まないので、縦長の盤を小さく見せているときでも読める。勝敗の表示など。出す / 消すは `el.hidden` で。タブが裏に回ると隠れ、ページを離れると消える) / `noRotate(on)` (回転禁止。操作パネルの回転レバーのダブルクリックと同じ。縦長の箱を回したくないページ向け。ページを離れると解除) / `noPan(on)` (パン禁止。パンのレバーのダブルクリックと同じ。ページを離れると解除) / `lookGlass()` (このタブがガラスの見た目 (`setLook` の `glass`) に変えているか。透過モードは含めない) / `fitView()` (「全体」ボタンと同じ) / `debug()` (URL に `?debug` があれば true。開発用の機能を出すのに使う。ほかのパラメータと一緒に使える) / `magnify(el, fx, fy, [ax, ay], fitWidth)` (el の中の点へ、いますぐ虫めがねと同じように拡大する。`[ax, ay]` を渡すと、その点を画面のその割合の所へ置く。`fitWidth` (px) を渡すと、el が画面でその幅に見える決まった倍率にする (画面の幅の 9 割まで。遠近を入れない元の幅から決めるので、画面では少し大きく見える)。何度押しても同じ表示になるので「ここを見る」ボタン向き) / `pageInfo(id)` (ほかのページの `{ icon, title, appBg }`。`appBg` は def に書けるスマホのホーム画面のアイコンの背景) / `giveItem` / `acceptItem` など。タブの表示領域 (`.viewport`) には、表示しているものの種類が `data-kind` (page / url / search / start) で付く (スマホの自動回転で、サイトだけを横向きにするのに使う)。
- ページを離れる (別のページへ移る・タブを閉じる・面を閉じる) と、`onFrame` の処理、`add3d` の要素、`acceptItem` の受け取り口は自動で片付く。それ以外は `onCleanup` で登録する。
- **箱の見た目 (look)**: `api.setLook(name, { w, h, d, minD, maxD, pushBack, glass })` (`maxD`: 厚みの上限を幅・高さより大きくする。`pushBack`: 箱を厚みの半分だけ奥へずらし、とても厚くても正面がいつもの位置に来るようにする (`depthBack()`)。`glass`: その見た目の中では、ガラスのページの背景をいつも透明にする。`body.look-glass`。ページ側は `api.glassMode()` で確かめる。) で箱全体の形と見た目を変えられる (about:lphone)。そのタブに付き、タブの中で別のページへ移っても続く。`body` に `look` と `look-<name>` が付くので、プラグインの CSS で面の見た目を変える。拡大していて、指した場所などが画面の外なら `api.focusPoint(el, x, y, [ax, ay])` でそこへ視点を動かす (面がほぼ正面を向いているときだけ。行き先は画面の真ん中、`[ax, ay]` で画面の割合を指定もできる)。ゲームなどでキーボードを使うときは `api.captureKeys()` (そのページを表示している間、矢印キーで箱を回さない。今借りているかを返す関数を返す)。大きさだけ変えるなら `api.setBoxSize(w, h, fill)` (「サイズ」メニューと同じ。見た目を変えている間は何もしない。`fill` は正面を向けて全体を見せるとき画面の高さのどれだけまで使うか。省略なら 0.85 で拡大は 1 倍まで。指定すると `ZOOM_MAX` まで拡大してよい (スマホでも画面いっぱいに)。縦長の盤を大きめに見せたいときに 0.96 など。大きさを触ると省略時に戻る)。今の大きさは `api.boxSize()` (角で変えられた幅はそのままに、高さだけ足すときなど)。そのあと `api.zoomToSpot(el, fx, fy)` で、回転と大きさの変化が済んでから el の中の点 (幅・高さに対する割合) へ虫めがねと同じように拡大して始められる (縦長の箱の端をアップで見せるなど。`?url=` で開いたときはいきなり。リセットの 1 回目もこの表示に戻る)。飾りは `api.lookDecorate(el, 'box' | 面の名前)`、後片付けは `api.onLookEnd(fn)`。リセットは段階的 (`resetAll`): 前のリセット (または見た目の開始) から何か触っていたら (`resetFresh` が外れる)、アプリを開いていれば `resetViewOnly()` で表示位置だけ、ホーム画面なら `resetLook()` で始めたページを開き直して最初の表示に。触っていなければ 1 段先 (アプリ → ホーム画面、ホーム画面 → `endLook()` で元に戻す)。`setBoxSize` で大きさを決めたページ (縦長のゲームなど) を表示中は、1 回目でそのページが決めた大きさと最初の表示に戻し (角やサイズのメニューで変えていても。`sizedBy` に覚えておく)、何も触らずにもう一度押すとトップ画面と標準の大きさにする (`resetStep = 'page'`)。向きと大きさを戻したあと (`resetStep = 'full'`) 何も触らずにもう一度押すと、正面のブラウザをトップ画面 (スタートページ) にする。タブを閉じる・タブを移す・面を閉じても `endLook()` で元に戻る。見た目を変えている間は、大きさの操作・ほかの面を開く・タブのドラッグはできず、ほかの面のブラウザは隠れる。
- 背景のダブルクリック (スマホはダブルタップ。`onDoubleClick`) はリセット。
- リセットの横の「全体」(`fitView()` = `zoomOutWhole(ZOOM_MAX)`。向きはそのままで箱全体を画面に収める。小さければ大きくする) と「軸合わせ」(`alignView()`。`nearestStraight()` で一番近いまっすぐな向き (24 通り) を求め、四元数 (`quatOf` / `slerp` / `rowsOf`) で一番近い道すじを `alignTick()` で回す。大きさと位置はそのまま)。キーは F / A。幅の狭い画面 (560px 以下) では 2 つをアイコン (`.ic`) にする。回転の行列から rz・rx・ry に分け直すのは `setRotFrom(m)`。
- 左上 (`#topLeft`) に、全体マップのオン・オフ (`#mapToggle`。オフなら拡大しても全体マップを出さない。`mapOff`) と虫めがねを並べる。
- 虫めがね (`#magnifier`、左上): ドラッグして箱の上 (`onBox()`) に落とすと、そこが画面の真ん中に来るよう拡大する (`zoomToPoint()`。向きはそのまま。縦長の箱は幅いっぱい、ほかは今の 2 倍。箱が画面より大きい向きは、箱の端が画面の中に入らないよう寄せ、小さい向きは真ん中に置く)。箱の外に落としたら何もしない。押しただけのときは、拡大中 (`boxOver`。全体マップが出る状態。虫めがねに「−」の印) なら向きはそのまま全体表示に戻し (`zoomOutWhole()`)、そうでなければ使い方を案内する。全体マップはその下に出す。
- ページの中のドラッグはふつうページが受ける (`interactive()`)。ページが `.pass-drag` を付けた所 (スマホのホーム画面の空いた所) は本体が受けて箱を回す・パンする。その中の `.no-pass-drag` はページが受ける。タップで操作する所 (ゲームの盤など) に `.pass-drag` を付けるときは、ページはタップ (押してほとんど動かさずに離す) だけを受け、`.no-dblclick-reset` を付けてダブルクリック (ダブルタップ) のリセットを止める (ドラッグ中は本体が指をつかまえるので、離したことは window で受ける)。
- ページ間の受け渡しは `giveItem(kind, html, titleKey)` / `acceptItem(kind, el, fn)` (例: ホラーの花 → 小人)。片方のプラグインがなくても壊れない。
- 面の外 (3D 空間) に要素を出すときは `api.add3d(el)` で箱に入れ、`api.place3d(el, face, x, y, z, extra)` で置く。ページ内の座標 → 面の座標は `offsetInFace()`。
- 小人の重力は `faceGravity(face)` で、箱の向きから面の中での「下」を求める。
- プラグインを追加・削除・変更したら `node build-plugins.mjs` を実行する (`index.html` の読み込みと `?v=` を更新)。スタートページはプラグインの読み込みが終わってから (`DOMContentLoaded`) 作る。

### 言語 (日本語 / English)
- 画面に出る文字は**すべて**辞書 `STR` に `[日本語, English]` で入れ、`t(key)` で取り出す (`pick(key)` は配列からランダム)。プラグインの文字は `def.strings` に書く (登録で `STR` に足される)。
- 静的な要素は `data-i18n` / `data-i18n-title` / `data-i18n-placeholder` を付けると `applyLang()` で切り替わる。

### localStorage のキー
`3d-browser-lang` / `3d-browser-pad-hidden` / `3d-browser-pad-used` / `3d-browser-drag-hinted` / `3d-browser-kobito-flowers` / `3d-browser-kobito-lines` / `3d-browser-see-through` (透過の不透明度) / `3d-browser-minimap-off` (全体マップをオフにしている) / `3d-browser-ns-sound` (将棋の音をなしにしている) / `3d-browser-sg-trails` (将棋の残像をなしにしている) / `3d-browser-sg-caps` (将棋の取ったコマ数の表をなしにしている) / `3d-browser-sg-cpu` (将棋の CPU の強さを「先手,後手」で。`easy` / `normal` / `strong`。どちらもふつうなら消す)

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
  - 中で表示できると確認済み: Wikipedia、ケノン.com、zoomquilt.org、WebGL Aquarium (webglsamples.org)、cantic.org、earthcam.com、Asterank 3D (asterank.com/3d/)
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
コミットしていない変更があるときと、`main` 以外のブランチのときは止まる (`--dry-run` は警告だけ)。
反映の流れ: 変更 → コミット → `git push` → `node deploy.mjs`

### バージョン
- `index.html` の `const VERSION = 'v0.1'` を手で上げる。機能を足したり大きく変えたりしたら v0.2、v0.3… (細かい修正だけなら上げなくてよい)。
- `deploy.mjs` が公開用の `dist/index.html` にだけ、デプロイした日付を `BUILD` に書き込む。説明ページの見出しの横に小さく「v0.1 (2026.10.18)」と出る (手元で開くと「v0.1 (dev)」)。
- 公開したら、そのコミットにローカルのタグ `v0.1-2026.10.18` を自動で付ける (同じ日の 2 回目は `-2`)。GitHub に送るのは push のとき (`git push origin <タグ名>`)。作業用の `before-…` タグは送らない。
