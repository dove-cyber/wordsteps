/* 词库列表页 */
(function () {
  const WS = (window.WS = window.WS || {});

  async function render() {
    const t = WS.I18N.t.bind(WS.I18N);
    const view = document.getElementById('view-banks');
    view.innerHTML = '';
    view.appendChild(WS.el('div', { class: 'loading', text: t('common.loading') }));

    const banks = await WS.WordBank.listBanks();
    view.innerHTML = '';

    view.appendChild(WS.el('div', { class: 'page' }, [
      WS.el('h2', { class: 'page-title', text: t('banks.title') }),
      banks.length === 0
        ? WS.el('div', { class: 'card empty-hint' }, [
            WS.el('p', { text: t('banks.empty') }),
            WS.el('button', { class: 'btn btn-primary', text: t('nav.import'), onclick: () => WS.App.go('import') }),
          ])
        : WS.el('div', { class: 'bank-list' }, banks.map((b) => bankCard(b, t))),
    ]));
  }

  function bankCard(b, t) {
    const langName = (WS.Langs.get(b.contentLang) || {}).name || b.contentLang;
    const c = b.counts || { total: 0, new: 0, learning: 0, reviewing: 0, mastered: 0 };
    const pct = c.total ? Math.round((c.mastered / c.total) * 100) : 0;

    return WS.el('div', { class: 'card bank-card' }, [
      WS.el('div', { class: 'bank-head' }, [
        WS.el('div', { class: 'bank-title' }, [
          WS.el('span', { class: 'bank-name', text: b.name }),
          WS.el('span', { class: 'chip chip-lang', text: langName }),
        ]),
        WS.el('div', { class: 'bank-actions' }, [
          WS.el('button', { class: 'btn btn-sm btn-primary', text: t('banks.learnNow'), onclick: () => WS.Study.startLearn(b.id) }),
          WS.el('button', {
            class: 'btn btn-sm btn-ghost', text: t('banks.delete'),
            onclick: () => WS.confirmDialog(t('banks.deleteConfirm', { name: b.name, n: c.total }), async () => {
              await WS.WordBank.deleteBank(b.id);
              WS.toast('✓ ' + t('banks.delete'));
              render();
            }),
          }),
        ]),
      ]),
      WS.el('div', { class: 'bank-meta' }, [
        WS.el('span', { text: t('banks.total', { n: c.total }) }),
        WS.el('span', { text: '· ' + t('banks.mastered', { n: c.mastered }) }),
        WS.el('span', { text: '· ' + t('banks.learning', { n: c.learning + c.reviewing }) }),
        WS.el('span', { text: '· ' + t('banks.new', { n: c.new }) }),
      ]),
      WS.el('div', { class: 'progress' }, [
        WS.el('div', { class: 'progress-fill', style: { width: pct + '%' } }),
      ]),
      WS.el('div', { class: 'muted bank-updated', text: t('banks.updatedAt', { date: WS.fmtDate(b.createdAt) }) }),
    ]);
  }

  WS.Banks = { render };
})();
