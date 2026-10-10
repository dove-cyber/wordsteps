/* 导入页:拖拽/选择文档 → 解析预览 → 选语言 → 确认导入 */
(function () {
  const WS = (window.WS = window.WS || {});
  const state = { entries: [], fileName: '' };
  const PREVIEW = 20;

  async function handleFile(file) {
    const t = WS.I18N.t.bind(WS.I18N);
    if (WS.Parser.isLegacyDoc(file)) {
      WS.toast('⚠️ 请先在 Word 中「另存为 .docx」再导入(暂不支持旧版 .doc)');
      return;
    }
    if (!/\.(txt|md|csv|docx)$/i.test(file.name)) {
      WS.toast(t('import.support'));
      return;
    }
    try {
      const entries = await WS.Parser.parseFile(file);
      state.entries = entries;
      state.fileName = file.name;
      const base = file.name.replace(/\.[^.]+$/, '');
      const nameInput = document.getElementById('import-bank-name');
      if (nameInput) nameInput.value = base;
      renderPreview();
    } catch (e) {
      console.error(e);
      WS.toast(t('import.error'));
    }
  }

  function renderPreview() {
    const t = WS.I18N.t.bind(WS.I18N);
    const box = document.getElementById('import-preview');
    if (!box) return;
    box.innerHTML = '';
    const entries = state.entries;
    if (!entries.length) {
      box.appendChild(WS.el('div', { class: 'muted', text: t('import.empty') }));
      return;
    }
    const words = entries.filter((e) => e.type === 'word').length;
    const sentences = entries.length - words;

    box.appendChild(WS.el('div', { class: 'preview-head' }, [
      WS.el('div', { class: 'preview-file', text: '📄 ' + state.fileName }),
      WS.el('div', { class: 'preview-stats' }, [
        WS.el('span', { class: 'chip', text: t('import.parsed', { n: entries.length }) }),
        WS.el('span', { class: 'chip chip-word', text: t('import.words', { n: words }) }),
        WS.el('span', { class: 'chip chip-sent', text: t('import.sentences', { n: sentences }) }),
      ]),
    ]));

    const table = WS.el('div', { class: 'preview-table' }, [
      WS.el('div', { class: 'preview-row preview-header' }, [
        WS.el('div', { text: t('import.termHeader') }),
        WS.el('div', { text: t('import.meaningHeader') }),
        WS.el('div', { text: t('import.phoneticHeader') }),
        WS.el('div', { text: t('import.type') }),
      ]),
    ]);
    entries.slice(0, PREVIEW).forEach((e) => {
      const phonetic = (e.type === 'word' && WS.Phonetics) ? WS.Phonetics.lookup(e.term) : '';
      table.appendChild(WS.el('div', { class: 'preview-row' }, [
        WS.el('div', { class: 'term', text: e.term }),
        WS.el('div', { class: 'meaning', text: e.meaning || '—' }),
        WS.el('div', { class: 'phonetic', text: phonetic ? '/' + phonetic + '/' : '—' }),
        WS.el('div', { class: 'type', text: e.type === 'sentence' ? t('import.type.sentence') : t('import.type.word') }),
      ]));
    });
    box.appendChild(table);
    if (entries.length > PREVIEW) {
      box.appendChild(WS.el('div', { class: 'muted preview-more', text: t('import.onlyFirst', { n: PREVIEW }) }));
    }
  }

  async function importSample() {
    const entries = WS.SAMPLE.entries();
    await WS.WordBank.createBank({ name: WS.SAMPLE.name, contentLang: WS.Langs.getCurrent(), entries });
    WS.toast(WS.I18N.t('import.success'));
    WS.App.go('banks');
  }

  async function confirmImport() {
    const t = WS.I18N.t.bind(WS.I18N);
    if (!state.entries.length) { WS.toast(t('import.empty')); return; }
    const lang = document.getElementById('import-lang').value;
    const name = (document.getElementById('import-bank-name').value || '').trim() || state.fileName.replace(/\.[^.]+$/, '');
    await WS.WordBank.createBank({ name, contentLang: lang, entries: state.entries });
    state.entries = [];
    state.fileName = '';
    WS.toast(t('import.success'));
    WS.App.go('banks');
  }

  function render() {
    const t = WS.I18N.t.bind(WS.I18N);
    const view = document.getElementById('view-import');
    view.innerHTML = '';

    const fileInput = WS.el('input', {
      type: 'file', accept: '.txt,.md,.csv,.docx', style: { display: 'none' },
      onchange: (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; },
    });

    const dropzone = WS.el('div', { class: 'dropzone' }, [
      WS.el('div', { class: 'drop-ico', text: '📥' }),
      WS.el('div', { class: 'drop-text' }, [
        WS.el('span', { text: t('import.drop') }),
        WS.el('span', { class: 'link', text: t('import.browse') }),
      ]),
      WS.el('div', { class: 'muted', text: t('import.support') }),
    ]);

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault(); dropzone.classList.remove('drag');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    const langSel = WS.el('select', { id: 'import-lang', class: 'select' });
    WS.Langs.list().forEach((l) => langSel.appendChild(WS.el('option', { value: l.code, text: l.name })));
    langSel.value = WS.Langs.getCurrent();

    const nameInput = WS.el('input', { id: 'import-bank-name', class: 'input', placeholder: t('import.bankNamePh') });
    const preview = WS.el('div', { id: 'import-preview', class: 'card import-preview' });

    view.appendChild(WS.el('div', { class: 'page' }, [
      WS.el('h2', { class: 'page-title', text: t('import.title') }),
      WS.el('div', { class: 'card' }, [
        dropzone, fileInput,
        WS.el('div', { class: 'form-row' }, [
          WS.el('label', { class: 'form-label', text: t('import.contentLang') }),
          langSel,
        ]),
        WS.el('div', { class: 'form-row' }, [
          WS.el('label', { class: 'form-label', text: t('import.bankName') }),
          nameInput,
        ]),
        WS.el('div', { class: 'sample-row' }, [
          WS.el('button', { class: 'btn btn-ghost btn-sm', text: t('import.sample'), onclick: importSample }),
        ]),
      ]),
      WS.el('h3', { class: 'section-title', text: t('import.parsePreview') }),
      preview,
      WS.el('div', { class: 'form-actions' }, [
        WS.el('button', { class: 'btn btn-primary', text: t('import.confirm'), onclick: confirmImport }),
        WS.el('button', { class: 'btn btn-ghost', text: t('import.cancel'), onclick: () => { state.entries = []; state.fileName = ''; render(); } }),
      ]),
    ]));

    if (state.entries.length) renderPreview();
  }

  WS.Import = { render };
})();
