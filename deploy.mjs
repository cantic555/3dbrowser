// 3dbrowser.cantic.org へ公開する。
// 使い方: node deploy.mjs           (公開する)
//         node deploy.mjs --dry-run (アップロードせずに確認だけ)
// 初回は `npx wrangler login` で Cloudflare にログインしておく
//
// バージョン: index.html の VERSION (手で上げる) に、公開用のファイルにだけデプロイした日付を書き込む
// (説明ページに「v0.1 (2026.10.18)」と出る)。公開したら、そのコミットにローカルのタグ v0.1-2026.10.18 を付ける
// (同じ日に 2 回目なら -2)。タグを GitHub に送るのは push のとき (git push origin <タグ名>)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const FILES = ['index.html', 'LICENSE', 'plugins'];  // 公開するのはこれだけ (snapshot/ などは含めない)
const dryRun = process.argv.includes('--dry-run');
const git = (cmd) => execSync(`git ${cmd}`, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// plugins/ の中身を index.html の読み込みに反映しておく
execSync('node build-plugins.mjs', { cwd: root, stdio: 'inherit' });

// 公開するのは公開用のブランチ (main) からだけ。ほかのブランチで作業中のものを間違えて公開しないように (確認だけなら続ける)
const branch = git('rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`公開できるのは main ブランチからだけです (今は ${branch})`);
  if (!dryRun) process.exit(1);
}

// コミットしていない変更があると、公開する中身とタグのコミットが食い違うので止める (確認だけなら続ける)
const dirty = git('status --porcelain');
if (dirty) {
  console.error(`コミットしていない変更があります:\n${dirty}`);
  if (!dryRun) { console.error('コミットしてから、もう一度実行してください'); process.exit(1); }
}

// バージョンとデプロイした日付
const html = readFileSync(join(root, 'index.html'), 'utf8');
const version = html.match(/const VERSION = '([^']+)';/)?.[1];
if (!version || !html.includes(`const BUILD = 'dev';`)) throw new Error('index.html に VERSION / BUILD が見つかりません');
const d = new Date();
const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const f of FILES) cpSync(join(root, f), join(dist, f), { recursive: true });
writeFileSync(join(dist, 'index.html'), html.replace(`const BUILD = 'dev';`, `const BUILD = '${date}';`));
console.log(`dist/ に ${FILES.join(', ')} を集めました (${version} (${date}))`);

const args = process.argv.slice(2).join(' ');
execSync(`npx --yes wrangler@4 deploy ${args}`, { cwd: root, stdio: 'inherit' });

// 公開したコミットにタグを付ける。今のコミットにもう付いていれば何もしない
if (!dryRun) {
  const head = git('rev-parse HEAD');
  const base = `${version}-${date}`;
  for (let n = 1; ; n++) {
    const tag = n === 1 ? base : `${base}-${n}`;
    let at = null;
    try { at = git(`rev-list -n 1 refs/tags/${tag}`); } catch {}  // タグが無ければエラー (^{commit} は Windows の cmd.exe で ^ が消えるので使わない)
    if (at === head) { console.log(`タグ ${tag} はこのコミットに付いています`); break; }
    if (!at) { git(`tag ${tag}`); console.log(`タグ ${tag} を付けました (GitHub に送るのは push のとき)`); break; }
  }
}
