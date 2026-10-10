// 把 web/ 目录同步到目标目录(EXE 打包到 desktop/www,APK 打包到 mobile/www)
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (!target) { console.error('用法: node scripts/sync-web.mjs <目标目录(相对仓库根)>'); process.exit(1); }

const src = join(root, 'web');
const dst = resolve(root, target);
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log('✓ 已同步 web → ' + target);
