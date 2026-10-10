/* 应用入口:初始化 + 视图路由 + 界面/内容语言切换 */
(function () {
  const WS = (window.WS = window.WS || {});

  const views = { home: WS.Home, import: WS.Import, banks: WS.Banks, stats: WS.Stats };

  function setTab(viewName) {
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.getAttribute('data-view') === viewName);
    });
    document.querySelectorAll('main .view').forEach((v) => {
      v.classList.toggle('hidden', v.id !== 'view-' + viewName);
    });
  }

  const App = {
    go(viewName) {
      setTab(viewName);
      const v = views[viewName];
      if (v && v.render) v.render();
    },

    refresh() {
      const active = document.querySelector('.tab.active');
      if (active) App.go(active.getAttribute('data-view'));
    },
  };

  function buildLangSelectors() {
    const uiSel = document.getElementById('ui-lang-select');
    const uiNames = { zh: '中文', en: 'English' };
    WS.I18N.list().forEach((code) => {
      uiSel.appendChild(WS.el('option', { value: code, text: uiNames[code] || code }));
    });
    uiSel.value = WS.I18N.getLocale();
    uiSel.addEventListener('change', () => {
      WS.I18N.setLocale(uiSel.value);
      WS.I18N.apply();
      App.refresh();
    });

    const cSel = document.getElementById('content-lang-select');
    WS.Langs.list().forEach((l) => {
      cSel.appendChild(WS.el('option', { value: l.code, text: l.name }));
    });
    cSel.value = WS.Langs.getCurrent();
    cSel.addEventListener('change', () => {
      WS.Langs.setCurrent(cSel.value);
      App.refresh();
    });
  }

  // 绑定顶部导航标签点击
  function bindNav() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => App.go(tab.getAttribute('data-view')));
    });
  }

  async function init() {
    try {
      await WS.DB.init();
      buildLangSelectors();
      bindNav();
      WS.I18N.apply();
      WS.TTS.prime();
      App.go('home');
    } catch (e) {
      console.error('[WordSteps] 初始化失败:', e);
      WS.toast('初始化失败: ' + (e && e.message ? e.message : e));
    }
  }

  WS.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
