// plugins/ の中の .js を index.html に読み込ませる (<!-- plugins:begin --> から <!-- plugins:end --> を書き換える)。
// プラグインを追加・削除・変更したら実行する。deploy.mjs も公開の前に実行する
// 使い方: node build-plugins.mjs
//
// ブラウザはフォルダの中身を一覧できないので、読み込むファイルを index.html に書いておく。
// ?v= はファイルの中身から作る (変更したらブラウザの古いキャッシュを使わないように)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const html = join(root, 'index.html');
const files = readdirSync(join(root, 'plugins')).filter((f) => f.endsWith('.js')).sort();
const tags = files.map((f) => {
  const v = createHash('sha1').update(readFileSync(join(root, 'plugins', f))).digest('hex').slice(0, 8);
  return `<script src="plugins/${f}?v=${v}"></script>`;
});

const src = readFileSync(html, 'utf8');
const re = /(<!-- plugins:begin -->)[\s\S]*?(<!-- plugins:end -->)/;
if (!re.test(src)) throw new Error('index.html に <!-- plugins:begin --> <!-- plugins:end --> がありません');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const out = src.replace(re, (_, a, b) => [a, ...tags, b].join(nl));
if (out !== src) writeFileSync(html, out);
console.log(`plugins: ${files.join(', ') || '(なし)'}${out === src ? ' (変更なし)' : ' → index.html を更新しました'}`);
