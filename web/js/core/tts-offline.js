/* 内置离线发音引擎 —— 基于 sherpa-onnx(WASM) + Piper en_US-libritts_r 神经音色(真人录音合成)
 * 完全离线、三端通用。复用官方 Worker 模式:sherpa-onnx-tts.worker.js 负责加载模型并合成。
 */
(function () {
  const WS = (window.WS = window.WS || {});

  let BASE = 'js/vendor/sherpa/';
  try {
    if (document.currentScript && document.currentScript.src) {
      BASE = new URL('../vendor/sherpa/', document.currentScript.src).href;
    }
  } catch (e) { /* 保持兜底 */ }

  let _worker = null;
  let _ready = false;
  let _loading = null;

  function load() {
    if (_ready) return Promise.resolve(true);
    if (_loading) return _loading;
    _loading = new Promise((resolve) => {
      try {
        _worker = new Worker(BASE + 'sherpa-onnx-tts.worker.js');
        _worker.onmessage = (e) => {
          const d = e.data || {};
          if (d.type === 'sherpa-onnx-tts-ready') {
            _ready = true;
            console.log('[TTS] 神经 TTS 就绪, 说话人数:', d.numSpeakers);
            resolve(true);
          } else if (d.type === 'sherpa-onnx-tts-result') {
            playSamples(d.samples, d.sampleRate);
          } else if (d.type === 'error') {
            console.warn('[TTS] 生成失败:', d.message);
          }
        };
        _worker.onerror = (e) => {
          console.warn('[TTS] 引擎 worker 错误:', e && e.message);
          resolve(false);
        };
      } catch (e) {
        console.warn('[TTS] 引擎加载失败:', e && e.message);
        resolve(false);
      }
    });
    return _loading;
  }

  // Float32Array → 16bit PCM WAV
  function floatToWav(samples, sampleRate) {
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (s > 1) s = 1; else if (s < -1) s = -1;
      int16[i] = s * 32767;
    }
    const buf = new ArrayBuffer(44 + int16.length * 2);
    const v = new DataView(buf);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + int16.length * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, int16.length * 2, true);
    for (let i = 0; i < int16.length; i++) v.setInt16(44 + i * 2, int16[i], true);
    return buf;
  }

  function playSamples(samples, sampleRate) {
    try {
      const wav = floatToWav(samples, sampleRate);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { try { URL.revokeObjectURL(url); } catch (e) {} };
      audio.play().catch((e) => console.warn('[TTS] 播放失败:', e && e.message));
    } catch (e) { console.warn('[TTS] 播放异常:', e); }
  }

  const OfflineTTS = {
    load,

    isReady() {
      return _ready;
    },

    speak(text, speed) {
      if (!_ready || !_worker) return false;
      const sp = (speed >= 0.5 && speed <= 2) ? speed : 1.0;
      _worker.postMessage({ type: 'generate', text: String(text), sid: 0, speed: sp });
      return true;
    },
  };

  WS.OfflineTTS = OfflineTTS;
})();
