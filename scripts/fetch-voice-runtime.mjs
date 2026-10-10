// 获取内置离线神经 TTS 运行时(sherpa-onnx WASM + Piper 模型)
// 说明: 该运行时约 105MB(.data 92MB + .wasm 13MB),不进 Git 仓库,首次构建前运行本脚本获取。
// 另外会自动执行 scripts/repack-sherpa-model.mjs 修复模型名(sherpa-onnx 代码固定读取 ./model.onnx,
// 官方包的 .data 里却是 /en_US-xxx.onnx,不改名会导致朗读静默失效)。
//
// 用法: node scripts/fetch-voice-runtime.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TOOLCHAIN = path.resolve(ROOT, '..', 'toolchain');
const VENDOR = path.join(ROOT, 'web', 'js', 'vendor', 'sherpa');

const BUNDLE_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/' +
  'sherpa-onnx-wasm-simd-1.13.8-vits-piper-en_US-libritts_r-medium.tar.bz2';

function run(cmd, args) {
  console.log('>', cmd, args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit' });
}

async function main() {
  fs.mkdirSync(VENDOR, { recursive: true });

  const dataOk = fs.existsSync(path.join(VENDOR, 'sherpa-onnx-wasm-main-tts.data'));
  const wasmOk = fs.existsSync(path.join(VENDOR, 'sherpa-onnx-wasm-main-tts.wasm'));
  if (dataOk && wasmOk) {
    console.log('语音运行时已存在,跳过下载');
  } else {
    const bundle = path.join(TOOLCHAIN, 'sherpa-wasm-libritts.tar.bz2');
    if (!fs.existsSync(bundle)) {
      run(process.execPath, [path.join(HERE, 'download.mjs'), BUNDLE_URL, bundle]);
    }
    // tar.bz2 解压(Windows 10+ 自带 tar)
    const extractDir = path.join(TOOLCHAIN, 'sherpa-wasm-extract');
    fs.mkdirSync(extractDir, { recursive: true });
    run('tar', ['-xjf', bundle, '-C', extractDir]);

    // 找到解压出来的目录,复制 5 个文件
    const sub = fs.readdirSync(extractDir).find((d) =>
      fs.statSync(path.join(extractDir, d)).isDirectory());
    if (!sub) throw new Error('解压目录为空');
    const src = path.join(extractDir, sub);
    for (const f of ['sherpa-onnx-tts.js', 'sherpa-onnx-tts.worker.js',
                     'sherpa-onnx-wasm-main-tts.js', 'sherpa-onnx-wasm-main-tts.wasm',
                     'sherpa-onnx-wasm-main-tts.data']) {
      fs.copyFileSync(path.join(src, f), path.join(VENDOR, f));
    }
    console.log('已复制语音运行时到', VENDOR);
  }

  // 修复模型名(/en_US-xxx.onnx -> /model.onnx)
  const glue = path.join(VENDOR, 'sherpa-onnx-wasm-main-tts.js');
  const data = path.join(VENDOR, 'sherpa-onnx-wasm-main-tts.data');
  const glueText = fs.readFileSync(glue, 'utf8');
  if (glueText.includes('/model.onnx')) {
    console.log('模型名已正确(/model.onnx),无需修复');
  } else {
    const out = path.join(TOOLCHAIN, 'sherpa-fixed');
    run(process.execPath, [path.join(HERE, 'repack-sherpa-model.mjs'), glue, data, out]);
    fs.copyFileSync(path.join(out, 'sherpa-onnx-wasm-main-tts.js'), glue);
    fs.copyFileSync(path.join(out, 'sherpa-onnx-wasm-main-tts.data'), data);
    console.log('已修复模型名 -> /model.onnx');
  }
  console.log('完成。');
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
