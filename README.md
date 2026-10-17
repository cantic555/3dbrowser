# 3D Browser

ブラウザの中に、厚みのある 3D のブラウザを表示する Web アプリです。
やたら縦に長いケノン脱毛(未購入)のサイトからひらめいて作りました。

**▶ https://3dbrowser.cantic.org/**

A web app that shows a thick, rotatable 3D browser inside your browser.

## できること

- 箱の形をしたブラウザを、ドラッグや画面下の操作パネルで回す・拡大縮小する
- 前面だけでなく、側面・背面もクリックでブラウザにできる（タブはドラッグで別の面へ移動）
- 検索語は Wikipedia を検索、URL はそのサイトを表示（iframe）
- 「透過」で反対側の面を透かして見る
- 日本語 / English の切り替え

### 内蔵ページ

| アドレス | 内容 |
|---|---|
| `about:this` | この 3D Browser 自身（ブラウザの中のブラウザの中の…） |
| `about:draw` | お絵描き。描いた線を蝶のように飛ばせる |
| `about:horror` | ちょっと怖い？（Esc でスキップ） |
| `about:kobito` | 小人（Tiny Folks）が暮らしている。回すとあたふたする |
| `about:info` | 操作方法などの説明 |

## 注意

iframe を使っているため、埋め込みを拒否している多くのサイト（Google、X など）は中に表示されません。

## 動かし方

`index.html` 1 ファイルだけで動きます。ビルドも外部ライブラリも不要なので、ブラウザで直接開くか、好きな静的サーバーで配信してください。

## デプロイ (Cloudflare)

```
node deploy.mjs            # 公開する
node deploy.mjs --dry-run  # アップロードせずに確認だけ
```

`index.html` と `LICENSE` を `dist/` に集めて、`wrangler deploy` で Cloudflare Workers に配信します（設定は `wrangler.toml`）。

## ライセンス

[MIT License](LICENSE)

2026 made by cantik with [Claude Code](https://claude.com/claude-code)
