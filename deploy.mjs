// 3dbrowser.cantic.org へ公開する。
// 使い方: node deploy.mjs           (公開する)
//         node deploy.mjs --dry-run (アップロードせずに確認だけ)
// 初回は `npx wrangler login` で Cloudflare にログインしておく
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const FILES = ['index.html', 'LICENSE'];  // 公開するのはこれだけ (snapshot/ などは含めない)

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const f of FILES) cpSync(join(root, f), join(dist, f));
console.log(`dist/ に ${FILES.join(', ')} を集めました`);

const args = process.argv.slice(2).join(' ');
execSync(`npx --yes wrangler@4 deploy ${args}`, { cwd: root, stdio: 'inherit' });
