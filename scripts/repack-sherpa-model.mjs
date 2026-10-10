// 重打包 sherpa-onnx WASM 的 .data + glue 元数据,用于换自定义 Piper 模型
//
// 背景(重要 bug 修复):
//   sherpa-onnx-tts.js 的 createOfflineTts 固定使用 './model.onnx' / './tokens.txt' / './espeak-ng-data',
//   而官方 wasm 包里的 .data 元数据把模型命名为 '/en_US-libritts_r-medium.onnx',
//   两者对不上 => 模型加载失败,神经 TTS 静默失效。
//   本脚本会把 .onnx 条目统一改名为 '/model.onnx',从而修复 + 支持任意自定义模型。
//
// 用法:
//   node scripts/repack-sherpa-model.mjs <glue.js> <data> [new-model.onnx] <outDir>
//   (省略 new-model.onnx 时仅做重命名修复,模型字节保持原样)
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('用法: node scripts/repack-sherpa-model.mjs <glue.js> <data> [new-model.onnx] <outDir>');
  process.exit(1);
}
const outDir = args[args.length - 1];
const gluePath = args[0];
const dataPath = args[1];
const modelPath = args.length >= 4 ? args[2] : null;

const MODEL_TARGET = '/model.onnx';

const glue = fs.readFileSync(gluePath, 'utf8');
const data = fs.readFileSync(dataPath);
const newModel = modelPath ? fs.readFileSync(modelPath) : null;

const m = glue.match(/loadPackage\(\{files:\[(.*?)\],remote_package_size:(\d+)\}\)/s);
if (!m) {
  console.error('未能在 glue 中找到 loadPackage 元数据');
  process.exit(1);
}

const entries = [...m[1].matchAll(/\{filename:"([^"]+)",start:(\d+),end:(\d+)\}/g)]
  .map((x) => ({ filename: x[1], start: Number(x[2]), end: Number(x[3]) }));

console.log(`原元数据: ${entries.length} 个文件, .data=${(data.length / 1024 / 1024).toFixed(1)}MB`);
const onnxEntries = entries.filter((e) => e.filename.endsWith('.onnx'));
console.log('原 .onnx 条目:', onnxEntries.map((e) => e.filename).join(', ') || '(无)');
if (modelPath) console.log(`替换为: ${modelPath} (${(newModel.length / 1024 / 1024).toFixed(2)}MB) -> ${MODEL_TARGET}`);

// 收集输出文件:替换 .onnx 字节 + 统一改名为 /model.onnx
const outFiles = [];
let renamed = 0;
let replaced = 0;
for (const e of entries) {
  let filename = e.filename;
  let bytes = data.subarray(e.start, e.end);
  if (e.filename.endsWith('.onnx')) {
    if (newModel) {
      bytes = newModel;
      replaced++;
    }
    if (filename !== MODEL_TARGET) {
      filename = MODEL_TARGET;
      renamed++;
    }
  }
  outFiles.push({ filename, bytes });
}
if (replaced === 0 && renamed === 0) {
  console.error('未做任何改动');
  process.exit(1);
}

// 重新拼接 + 新元数据
let offset = 0;
const meta = [];
const parts = [];
for (const f of outFiles) {
  meta.push({ filename: f.filename, start: offset, end: offset + f.bytes.length });
  parts.push(f.bytes);
  offset += f.bytes.length;
}
const newData = Buffer.concat(parts);
const metaStr = 'loadPackage({files:[' +
  meta.map((x) => `{filename:"${x.filename}",start:${x.start},end:${x.end}}`).join(',') +
  `],remote_package_size:${offset}})`;
const newGlue = glue.replace(/loadPackage\(\{files:\[.*?\],remote_package_size:\d+\}\)/s, metaStr);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sherpa-onnx-wasm-main-tts.data'), newData);
fs.writeFileSync(path.join(outDir, 'sherpa-onnx-wasm-main-tts.js'), newGlue);

console.log(`重命名 ${renamed} 个, 替换 ${replaced} 个`);
console.log(`新 .data: ${(newData.length / 1024 / 1024).toFixed(1)}MB`);
console.log(`输出: ${outDir}`);
