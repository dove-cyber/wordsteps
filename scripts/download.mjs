// 通用下载器:流式写盘 + 断点续传 + 卡死超时 + 重试(应对不稳定网络)
// 用法: node scripts/download.mjs <url> <outfile>
import { createWriteStream, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) { console.error('用法: node scripts/download.mjs <url> <outfile>'); process.exit(1); }

const target = resolve(out);
mkdirSync(dirname(target), { recursive: true });
console.log('下载:', url);

const STALL_MS = 30000; // 30 秒无数据即视为卡死

for (let attempt = 1; attempt <= 10; attempt++) {
  const start = existsSync(target) ? statSync(target).size : 0;
  const headers = start > 0 ? { Range: `bytes=${start}-` } : {};
  let err = null;
  try {
    const ac = new AbortController();
    let timer = setTimeout(() => ac.abort(new Error('stalled')), STALL_MS);
    const r = await fetch(url, { redirect: 'follow', headers, signal: ac.signal });
    if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
    const append = start > 0 && r.status === 206;
    const ws = createWriteStream(target, { flags: append ? 'a' : 'w' });
    const src = Readable.fromWeb(r.body);
    src.on('data', () => { clearTimeout(timer); timer = setTimeout(() => ac.abort(new Error('stalled')), STALL_MS); });
    await pipeline(src, ws);
    clearTimeout(timer);
    const size = statSync(target).size;
    console.log('完成:', out, (size / 1024 / 1024).toFixed(1) + 'MB');
    process.exit(0);
  } catch (e) {
    err = e;
  }
  const cur = existsSync(target) ? statSync(target).size : 0;
  console.log(`第 ${attempt} 次中断(${err && err.message}),已下 ${(cur / 1024 / 1024).toFixed(1)}MB,续传…`);
}
console.error('下载失败(重试耗尽):', url);
process.exit(1);
