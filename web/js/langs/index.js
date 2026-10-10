/**
 * 学习内容语言 (content language) 扩展接口 —— 语言扩展第二层。
 * 与「界面语言」解耦:界面可以中文,而学习内容是英语/日语/西语等任意语言。
 * 新增一种内容语言:新建 js/langs/xx.js,调用 WS.Langs.register({...}) 即可,
 * 自动获得:发音(TTS 语音)、书写方向、文档解析、乱序考察等全部能力。
 */
(function () {
  const WS = (window.WS = window.WS || {});
  const langs = {};
  let current = 'en';

  const Langs = {
    register(cfg) {
      if (!cfg || !cfg.code) return;
      langs[cfg.code] = cfg;
    },

    setCurrent(code) {
      if (!langs[code]) return;
      current = code;
      try { localStorage.setItem('ws.contentLang', code); } catch (e) {}
      WS.Events.emit('contentlang:change', code);
    },

    getCurrent() { return current; },

    cur() { return langs[current] || langs.en; },

    get(code) { return langs[code]; },

    list() { return Object.values(langs); },

    has(code) { return !!langs[code]; },

    // 根据内容语言取 TTS 语音代码(发音引擎的核心钩子)
    ttsFor(code) {
      const c = langs[code || current];
      return (c && c.tts) || 'en-US';
    },
  };

  try {
    const saved = localStorage.getItem('ws.contentLang');
    if (saved && langs[saved]) current = saved;
  } catch (e) {}

  WS.Langs = Langs;
})();
