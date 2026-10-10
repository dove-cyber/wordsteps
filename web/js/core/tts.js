/* 发音引擎 —— 三层:
 * 1) 内置离线神经 TTS(sherpa-onnx + Piper,保证出声、不依赖系统/网络)—— 首选
 * 2) 原生系统 TTS(@capacitor-community/text-to-speech,自然音质)
 * 3) Web Speech API(浏览器 / Electron 桌面版)
 * 支持语速调节(0.5x ~ 2x,默认 1.0x)。
 */
(function () {
  const WS = (window.WS = window.WS || {});

  let _native = null;
  let _nativeChecked = false;
  let _warned = false;

  function native() {
    if (_nativeChecked) return _native;
    _nativeChecked = true;
    try {
      const C = window.Capacitor;
      if (C && C.registerPlugin && C.isNativePlatform && C.isNativePlatform()) {
        _native = C.registerPlugin('TextToSpeech', {});
        return _native;
      }
    } catch (e) { console.warn('[TTS] 原生插件初始化失败:', e && e.message); }
    _native = null;
    return null;
  }

  function webSpeech() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  function warnOnce(msg) {
    if (_warned) return;
    _warned = true;
    console.warn('[TTS]', msg);
    try { if (WS.toast) WS.toast('⚠️ ' + msg); } catch (e) {}
  }

  const TTS = {
    supported() {
      return !!(WS.OfflineTTS || native() || webSpeech());
    },

    prime() {
      if (WS.OfflineTTS && WS.OfflineTTS.load) WS.OfflineTTS.load();
      if (webSpeech()) window.speechSynthesis.getVoices();
    },

    // 语速:0.5x ~ 2x,默认 1.0x,持久化到本地
    getSpeed() {
      try {
        const v = parseFloat(localStorage.getItem('ws.speed'));
        return (v >= 0.5 && v <= 2) ? v : 1.0;
      } catch (e) { return 1.0; }
    },

    setSpeed(n) {
      const v = Math.min(2, Math.max(0.5, parseFloat(n) || 1.0));
      try { localStorage.setItem('ws.speed', String(v)); } catch (e) {}
      return v;
    },

    speak(text, code) {
      if (!text) return false;
      const lang = code || (WS.Langs && WS.Langs.ttsFor()) || 'en-US';
      const t = String(text);
      const speed = TTS.getSpeed();

      // 1) 内置离线神经 TTS(首选,保证出声)
      if (WS.OfflineTTS) {
        if (!WS.OfflineTTS.isReady()) WS.OfflineTTS.load();
        else if (WS.OfflineTTS.speak(t, speed)) return true;
      }

      // 2) 原生系统 TTS(自然音质)
      const n = native();
      if (n) {
        n.speak({ text: t, lang: lang, rate: speed, pitch: 1.0, volume: 1.0 })
          .catch((e) => { console.warn('[TTS] 系统 TTS 失败:', e); });
        return true;
      }

      // 3) Web Speech
      if (webSpeech()) {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = lang;
        u.rate = speed;
        const voices = window.speechSynthesis.getVoices() || [];
        const want = String(lang).toLowerCase();
        const exact = voices.find((v) => (v.lang || '').toLowerCase() === want);
        const prefix = voices.find((v) => (v.lang || '').toLowerCase().slice(0, 2) === want.slice(0, 2));
        if (exact) u.voice = exact;
        else if (prefix) u.voice = prefix;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
      }

      warnOnce('当前设备不支持发音');
      return false;
    },

    stop() {
      const n = native();
      if (n) { n.stop().catch(() => {}); return; }
      if (webSpeech()) window.speechSynthesis.cancel();
    },
  };

  if (webSpeech() && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  WS.TTS = TTS;
})();
