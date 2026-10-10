// 在 Node 中实测 sherpa-onnx WASM 能否加载模型并合成语音(验证 .data 改名的修复)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = process.argv[2]; // 末尾带 /
if (!dir) { console.error('用法: node test-sherpa-wasm.cjs <dir>/'); process.exit(1); }

function saveWav(file, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

global.self = global;
global.require = require; // glue 的 Node 分支用 require("fs") 读 .data
global.__dirname = __dirname;
global.Module = {
  locateFile: (p) => dir + p,
  setStatus: (s) => { if (/Download|Loading/i.test(s)) console.log('[status]', s); },
  onRuntimeInitialized: () => {
    console.log('=== runtime initialized ===');
    try {
      const tts = global.createOfflineTts(global.Module);
      console.log('numSpeakers:', tts.numSpeakers);
      const audio = tts.generate({ text: 'Hello world. This is a test.', sid: 0, speed: 1.0 });
      const samples = audio.samples;
      console.log('samples:', samples.length, 'sampleRate:', audio.sampleRate);
      if (samples.length > 0) {
        let peak = 0;
        for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
        console.log('peak amplitude:', peak.toFixed(4));
        const out = path.join(dir, 'node-test-output.wav');
        saveWav(out, samples, audio.sampleRate);
        console.log('>>> 成功! 已保存:', out);
        process.exit(peak > 0.001 ? 0 : 2);
      } else {
        console.log('>>> 失败: 采样数为 0');
        process.exit(3);
      }
    } catch (e) {
      console.error('>>> TTS 失败:', e && e.message);
      process.exit(4);
    }
  },
};

const glue = fs.readFileSync(path.join(dir, 'sherpa-onnx-wasm-main-tts.js'), 'utf8');
vm.runInThisContext(glue, { filename: 'glue.js' });

const wrapper = fs.readFileSync(path.join(dir, 'sherpa-onnx-tts.js'), 'utf8');
global.module = { exports: {} };
vm.runInThisContext(wrapper, { filename: 'wrapper.js' });

setTimeout(() => { console.error('>>> 超时: 5 分钟未完成'); process.exit(5); }, 300000);
