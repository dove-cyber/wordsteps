/**
 * 界面语言 (UI locale) 扩展接口 —— i18n 第一层。
 * 新增一种界面语言:新建 js/i18n/xx.js,调用 WS.I18N.register('xx', {...}) 即可,
 * 无需改动任何业务代码。当前语言会持久化到本地。
 */
(function () {
  const WS = (window.WS = window.WS || {});
  const locales = {};
  let current = 'zh';

  const I18N = {
    register(code, dict) {
      locales[code] = dict;
    },

    setLocale(code) {
      if (!locales[code]) return;
      current = code;
      try { localStorage.setItem('ws.uiLocale', code); } catch (e) {}
      I18N.apply();
      WS.Events && WS.Events.emit('locale:change', code);
    },

    getLocale() { return current; },

    list() { return Object.keys(locales); },

    has(code) { return !!locales[code]; },

    // 取词:优先当前语言,其次中文,最后原样返回 key
    t(key, params) {
      let s = (locales[current] && locales[current][key]) != null
        ? locales[current][key]
        : (locales.zh && locales.zh[key]) != null
          ? locales.zh[key]
          : key;
      if (params) {
        for (const k in params) {
          s = s.split('{{' + k + '}}').join(String(params[k]));
        }
      }
      return s;
    },

    // 把页面上 data-i18n / data-i18n-ph / data-i18n-title 全部刷新
    apply() {
      document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = I18N.t(el.getAttribute('data-i18n'));
      });
      document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
        el.placeholder = I18N.t(el.getAttribute('data-i18n-ph'));
      });
      document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        el.title = I18N.t(el.getAttribute('data-i18n-title'));
      });
    },
  };

  try {
    const saved = localStorage.getItem('ws.uiLocale');
    if (saved && locales[saved]) current = saved;
  } catch (e) {}

  WS.I18N = I18N;
})();
