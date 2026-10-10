// 将 node_modules 里的第三方浏览器库拷贝到 web 端 vendor 目录,保证 HTML 版可离线双击运行。
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'web', 'js', 'vendor');
mkdirSync(vendorDir, { recursive: true });

const files = [
  ['node_modules/jszip/dist/jszip.min.js', 'web/js/vendor/jszip.min.js'],
  ['node_modules/ts-fsrs/dist/index.umd.js', 'web/js/vendor/fsrs.umd.js'],
];

for (const [src, dst] of files) {
  const s = join(root, src);
  const d = join(root, dst);
  if (!existsSync(s)) throw new Error('缺少依赖文件: ' + s + ' (请先执行 pnpm install)');
  copyFileSync(s, d);
  console.log('✓ ' + dst);
}
console.log('vendor 完成');
