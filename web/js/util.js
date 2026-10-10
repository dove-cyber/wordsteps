/* 全局工具与极简事件总线(所有模块共享) */
(function () {
  const WS = (window.WS = window.WS || {});

  // ---- 事件总线 ----
  const listeners = {};
  WS.Events = {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    off(evt, fn) {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter((f) => f !== fn);
    },
    emit(evt, payload) {
      (listeners[evt] || []).forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
    },
  };

  // ---- 基础工具 ----
  WS.uid = function () {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  };

  WS.shuffle = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  WS.sample = function (arr, n) {
    return WS.shuffle(arr).slice(0, n);
  };

  WS.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // DOM 构建器: el('div', {class:'x', html:'..', onclick:fn}, [children])
  WS.el = function (tag, props, children) {
    const node = document.createElement(tag);
    props = props || {};
    for (const k in props) {
      const v = props[k];
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') { for (const dk in v) node.dataset[dk] = v[dk]; }
      else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) node.style[sk] = v[sk]; }
      else if (v != null) node.setAttribute(k, v);
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  WS.fmtDate = function (ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  WS.relativeTime = function (ts) {
    const diff = Date.now() - ts;
    const day = 24 * 3600 * 1000;
    if (diff < day) return WS.I18N.t('common.today');
    const n = Math.floor(diff / day);
    return WS.I18N.t('common.daysAgo', { n });
  };

  WS.pct = function (a, b) {
    if (!b) return 0;
    return Math.round((a / b) * 100);
  };

  let toastTimer = null;
  WS.toast = function (msg) {
    let t = document.getElementById('ws-toast');
    if (!t) {
      t = WS.el('div', { id: 'ws-toast', class: 'ws-toast' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // 简单确认框
  WS.confirmDialog = function (message, onYes) {
    const overlay = WS.el('div', { class: 'ws-overlay' });
    const box = WS.el('div', { class: 'ws-dialog' }, [
      WS.el('div', { class: 'ws-dialog-body', text: message }),
      WS.el('div', { class: 'ws-dialog-actions' }, [
        WS.el('button', { class: 'btn btn-ghost', text: WS.I18N.t('common.cancel'), onclick: () => overlay.remove() }),
        WS.el('button', {
          class: 'btn btn-danger', text: WS.I18N.t('common.delete'),
          onclick: () => { overlay.remove(); onYes && onYes(); },
        }),
      ]),
    ]);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  };
})();
