/* 音标查询 —— 基于内置 IPA 词典(window.EN_IPA,由 scripts/build-phonetics.mjs 生成)
 * 多语言扩展:为其它语言生成对应的 xx-ipa.js 并在 index.html 引入即可,lookup 按内容语言选择词典。
 */
(function () {
  const WS = (window.WS = window.WS || {});

  const Phonetics = {
    ready() {
      return !!(window.EN_IPA && typeof window.EN_IPA === 'object');
    },

    // 查单词的 IPA 音标(找不到返回空字符串)
    lookup(word) {
      if (!word || !window.EN_IPA) return '';
      const w = String(word).toLowerCase().replace(/[^a-z']/g, '');
      return window.EN_IPA[w] || '';
    },
  };

  WS.Phonetics = Phonetics;
})();
