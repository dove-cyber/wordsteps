// 用 sherpa-onnx WASM 运行时合成试听片段(训练后的自定义音色)
// 用法: node scripts/tts-preview.cjs <运行时目录>/ <输出wav>
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = process.argv[2];
const outFile = process.argv[3];
const textsFile = process.argv[4];
if (!dir || !outFile) { console.error('用法: node scripts/tts-preview.cjs <dir>/ <out.wav> [texts.txt]'); process.exit(1); }

const DEFAULT_TEXTS = [
  'Hello! Welcome to WordSteps.',
  'apple, banana, orange, strawberry.',
  'The quick brown fox jumps over the lazy dog.',
  'Practice makes perfect. Keep going every day!',
];
const TEXTS = textsFile
  ? fs.readFileSync(textsFile, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_TEXTS;

function saveWav(file, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

let tts = null;
const all = [];

global.self = global;
global.require = require;
global.__dirname = __dirname;
global.Module = {
  locateFile: (p) => dir + p,
  setStatus: () => {},
  onRuntimeInitialized: () => {
    console.log('运行时就绪,开始合成…');
    try {
      tts = global.createOfflineTts(global.Module);
      console.log('说话人数:', tts.numSpeakers);
      let sr = 22050;
      for (const t of TEXTS) {
        const audio = tts.generate({ text: t, sid: 0, speed: 1.0 });
        sr = audio.sampleRate;
        console.log('  合成:', t, '->', audio.samples.length, '采样');
        all.push(audio.samples);
        all.push(new Float32Array(Math.round(sr * 0.5))); // 句间停顿
      }
      const total = all.reduce((s, a) => s + a.length, 0);
      const merged = new Float32Array(total);
      let off = 0;
      for (const a of all) { merged.set(a, off); off += a.length; }
      let peak = 0;
      for (let i = 0; i < merged.length; i++) peak = Math.max(peak, Math.abs(merged[i]));
      console.log('总采样:', total, ' 峰值:', peak.toFixed(4));
      saveWav(outFile, merged, sr);
      console.log('>>> 试听文件:', outFile, '(' + (total / sr).toFixed(1) + ' 秒)');
      process.exit(0);
    } catch (e) {
      console.error('>>> 合成失败:', e && e.message);
      process.exit(4);
    }
  },
};

vm.runInThisContext(fs.readFileSync(path.join(dir, 'sherpa-onnx-wasm-main-tts.js'), 'utf8'), { filename: 'glue.js' });
global.module = { exports: {} };
vm.runInThisContext(fs.readFileSync(path.join(dir, 'sherpa-onnx-tts.js'), 'utf8'), { filename: 'wrapper.js' });
setTimeout(() => { console.error('>>> 超时'); process.exit(5); }, 300000);
