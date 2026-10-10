/* 学习/乱序考察流程:
 * 学习(learn):新词 → 认识环节 + 选择释义 + 拼写/选词(多邻国式多题型)
 * 复习(review):到期卡片 → 随机单一题型乱序考察,逐题 FSRS 结算
 */
(function () {
  const WS = (window.WS = window.WS || {});
  const SESSION_LIMIT = 10;

  let session = null;
  let pools = { terms: [], meanings: [] };

  const overlay = () => document.getElementById('study-overlay');
  const t = (k, p) => WS.I18N.t(k, p);

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[.,!?;:'"“”‘’«»¡¿()\[\]{}]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  async function buildPools() {
    const cards = await WS.DB.getAllCards();
    const terms = [], meanings = [];
    cards.forEach((c) => {
      terms.push(c.term);
      if (c.meaning && c.meaning.trim()) meanings.push(c.meaning);
    });
    pools = { terms, meanings };
  }

  // 生成选项:1 个正确项 + 若干干扰项
  function makeOptions(correct, pool, n) {
    const seen = new Set([norm(correct)]);
    const others = [];
    for (const x of WS.shuffle(pool)) {
      const k = norm(x);
      if (!x || seen.has(k)) continue;
      seen.add(k);
      others.push(x);
      if (others.length >= n - 1) break;
    }
    return WS.shuffle([correct].concat(others));
  }

  function planSteps(card, mode) {
    const hasM = card.meaning && card.meaning.trim();
    if (!hasM) return ['listen'];
    if (mode === 'learn') {
      return card.type === 'sentence'
        ? ['intro', 'meaning-choice', 'word-choice']
        : ['intro', 'meaning-choice', 'typing'];
    }
    const pool = card.type === 'sentence' ? ['meaning-choice', 'word-choice'] : ['meaning-choice', 'typing', 'listen'];
    return [WS.sample(pool, 1)[0]];
  }

  // ---------- 会话生命周期 ----------
  function show() { overlay().classList.remove('hidden'); }
  function exit() {
    WS.TTS.stop();
    session = null;
    overlay().classList.add('hidden');
    WS.App.go('home');
  }

  async function startLearn(bankId) {
    const cards = await WS.WordBank.getNewCards(SESSION_LIMIT, bankId);
    if (!cards.length) { WS.toast(t('study.emptyNew')); return; }
    await buildPools();
    session = { mode: 'learn', queue: cards, idx: 0, steps: [], stepIdx: 0, card: null,
      cardCorrect: 0, cardWrong: 0, total: cards.length, correct: 0, wrong: 0 };
    show();
    loadCard(0);
  }

  async function startReview(bankId) {
    const cards = await WS.WordBank.getDueCards(bankId);
    if (!cards.length) { WS.toast(t('quiz.noDue')); return; }
    await buildPools();
    session = { mode: 'review', queue: cards, idx: 0, steps: [], stepIdx: 0, card: null,
      cardCorrect: 0, cardWrong: 0, total: cards.length, correct: 0, wrong: 0 };
    show();
    loadCard(0);
  }

  function loadCard(idx) {
    if (idx >= session.queue.length) { finish(); return; }
    session.idx = idx;
    session.card = session.queue[idx];
    session.cardCorrect = 0;
    session.cardWrong = 0;
    session.steps = planSteps(session.card, session.mode);
    session.stepIdx = 0;
    renderStep();
  }

  async function finishCard() {
    const c = session.card;
    const graded = WS.SRS.gradeBySession(c, { correct: session.cardCorrect, wrong: session.cardWrong });
    await WS.WordBank.saveCard(graded);
    session.idx++;
    if (session.idx >= session.queue.length) finish();
    else loadCard(session.idx);
  }

  async function finish() {
    await WS.WordBank.recordActivity(session.mode === 'learn' ? 'learn' : 'review', session.total, session.correct);
    renderDone();
  }

  function record(isCorrect) {
    if (isCorrect) { session.cardCorrect++; session.correct++; }
    else { session.cardWrong++; session.wrong++; }
  }

  function advanceStep() {
    session.stepIdx++;
    if (session.stepIdx >= session.steps.length) finishCard();
    else renderStep();
  }

  // ---------- 渲染 ----------
  function renderStep() {
    const step = session.steps[session.stepIdx];
    if (step === 'intro') renderIntro();
    else if (step === 'meaning-choice') renderMeaningChoice();
    else if (step === 'word-choice') renderWordChoice();
    else if (step === 'typing') renderTyping(false);
    else if (step === 'listen') renderTyping(true);
  }

  function studyShell(title, body) {
    const speed = WS.TTS.getSpeed();
    const speedLabel = WS.el('span', { class: 'speed-label', text: speed.toFixed(2) + 'x' });
    const speedSlider = WS.el('input', {
      type: 'range', min: '0.5', max: '2', step: '0.05', value: String(speed),
      class: 'speed-slider', title: t('study.speed'),
      oninput: (e) => {
        const v = WS.TTS.setSpeed(parseFloat(e.target.value));
        speedLabel.textContent = v.toFixed(2) + 'x';
      },
    });
    return WS.el('div', { class: 'study' }, [
      WS.el('div', { class: 'study-top' }, [
        WS.el('button', { class: 'btn btn-ghost btn-sm btn-exit', text: '✕ ' + t('study.backHome'), onclick: exit }),
        WS.el('div', { class: 'study-title', text: title }),
        WS.el('div', { class: 'speed-control', title: t('study.speed') }, [
          WS.el('span', { class: 'speed-icon', text: '🐢' }),
          speedSlider,
          WS.el('span', { class: 'speed-icon', text: '🐇' }),
          speedLabel,
        ]),
        WS.el('div', { class: 'study-progress', text: t('study.progress', { done: session.idx + 1, total: session.queue.length }) }),
      ]),
      body,
    ]);
  }

  function renderIntro() {
    const c = session.card;
    const lang = WS.Langs.ttsFor(c.contentLang);
    overlay().innerHTML = '';
    overlay().appendChild(studyShell(t('study.intro.new'), WS.el('div', { class: 'study-body' }, [
      WS.el('div', { class: 'flashcard' }, [
        WS.el('div', { class: 'flash-term', text: c.term }),
        c.phonetic ? WS.el('div', { class: 'flash-phonetic', text: '/' + c.phonetic + '/' }) : null,
        WS.el('div', { class: 'flash-type', text: c.type === 'sentence' ? t('study.sentence') : t('study.word') }),
        WS.el('div', { class: 'flash-meaning hidden', text: c.meaning || '' }),
      ]),
      WS.el('div', { class: 'intro-actions' }, [
        WS.el('button', { class: 'btn btn-audio', text: t('study.play'), onclick: () => WS.TTS.speak(c.term, lang) }),
        WS.el('button', { class: 'btn btn-primary', text: t('study.know'), onclick: () => introDone(true) }),
        WS.el('button', { class: 'btn btn-ghost', text: t('study.dontKnow'), onclick: () => introDone(false) }),
      ]),
    ])));
  }

  function introDone(know) {
    const c = session.card;
    const lang = WS.Langs.ttsFor(c.contentLang);
    if (know) { advanceStep(); return; }
    record(false);
    const card = overlay().querySelector('.flashcard');
    card.querySelector('.flash-meaning').classList.remove('hidden');
    const actions = overlay().querySelector('.intro-actions');
    actions.innerHTML = '';
    actions.appendChild(WS.el('button', { class: 'btn btn-audio', text: t('study.playAgain'), onclick: () => WS.TTS.speak(c.term, lang) }));
    actions.appendChild(WS.el('button', { class: 'btn btn-primary', text: t('study.next'), onclick: advanceStep }));
  }

  function renderMeaningChoice() {
    const c = session.card;
    const lang = WS.Langs.ttsFor(c.contentLang);
    renderChoice(c.term, makeOptions(c.meaning, pools.meanings, 4), { promptIsTerm: true, speak: c.term, lang, answer: c.meaning });
  }

  function renderWordChoice() {
    const c = session.card;
    const lang = WS.Langs.ttsFor(c.contentLang);
    renderChoice(c.meaning, makeOptions(c.term, pools.terms, 4), { promptIsTerm: false, speak: c.term, lang, answer: c.term });
  }

  function renderChoice(prompt, options, cfg) {
    overlay().innerHTML = '';
    const body = WS.el('div', { class: 'study-body' }, [
      WS.el('div', { class: 'prompt-card' }, [
        WS.el('div', { class: 'prompt-label', text: cfg.promptIsTerm ? t('study.chooseMeaning') : t('study.chooseWord') }),
        WS.el('div', { class: 'prompt', text: prompt }),
        (cfg.promptIsTerm && session.card.phonetic) ? WS.el('div', { class: 'prompt-phonetic', text: '/' + session.card.phonetic + '/' }) : null,
        WS.el('button', { class: 'btn btn-audio btn-sm', text: t('study.play'), onclick: () => WS.TTS.speak(cfg.speak, cfg.lang) }),
      ]),
      WS.el('div', { class: 'options' }, options.map((text) => {
        const isCorrect = norm(text) === norm(cfg.answer);
        return WS.el('button', {
          class: 'option', text, dataset: { correct: isCorrect ? '1' : '0' },
          onclick: (e) => pickChoice(e, cfg.answer),
        });
      })),
      WS.el('div', { class: 'feedback' }),
    ]);
    overlay().appendChild(studyShell(cfg.promptIsTerm ? t('study.chooseMeaning') : t('study.chooseWord'), body));
  }

  function pickChoice(e, answer) {
    const btn = e.currentTarget;
    const opts = btn.parentElement.querySelectorAll('.option');
    opts.forEach((o) => { o.disabled = true; });
    const isCorrect = btn.dataset.correct === '1';
    if (isCorrect) btn.classList.add('correct');
    else {
      btn.classList.add('wrong');
      opts.forEach((o) => { if (o.dataset.correct === '1') o.classList.add('correct'); });
    }
    record(isCorrect);
    showFeedback(isCorrect, answer);
  }

  function renderTyping(listen) {
    const c = session.card;
    const lang = WS.Langs.ttsFor(c.contentLang);
    const hasM = c.meaning && c.meaning.trim();
    overlay().innerHTML = '';

    const input = WS.el('input', {
      class: 'input input-lg', placeholder: t('study.typePlaceholder'),
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    });

    const body = WS.el('div', { class: 'study-body' }, [
      WS.el('div', { class: 'prompt-card' }, [
        WS.el('div', { class: 'prompt-label', text: listen ? t('study.listenType') : t('study.typeAnswer') }),
        (listen || !hasM)
          ? WS.el('button', { class: 'btn btn-audio btn-lg', text: t('study.play'), onclick: () => WS.TTS.speak(c.term, lang) })
          : WS.el('div', { class: 'prompt', text: c.meaning }),
      ]),
      WS.el('div', { class: 'type-row' }, [
        input,
        WS.el('button', { class: 'btn btn-primary', text: t('study.check'), onclick: () => checkTyping(input) }),
      ]),
      WS.el('div', { class: 'feedback' }),
    ]);
    overlay().appendChild(studyShell(listen ? t('study.listenType') : t('study.typeAnswer'), body));
    input.focus();
    if (listen) WS.TTS.speak(c.term, lang);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkTyping(input); });
  }

  function checkTyping(input) {
    const c = session.card;
    const isCorrect = norm(input.value) === norm(c.term);
    record(isCorrect);
    input.disabled = true;
    input.classList.add(isCorrect ? 'correct' : 'wrong');
    showFeedback(isCorrect, c.term);
  }

  function showFeedback(isCorrect, answer) {
    const bar = overlay().querySelector('.feedback');
    if (!bar) return;
    bar.innerHTML = '';
    bar.classList.add(isCorrect ? 'ok' : 'no');
    bar.appendChild(WS.el('span', {
      class: 'fb-msg',
      text: isCorrect ? t('study.correct') : t('study.wrong') + ' · ' + t('study.answer') + ': ' + answer,
    }));
    bar.appendChild(WS.el('button', { class: 'btn btn-primary', text: t('study.next'), onclick: advanceStep }));
  }

  function renderDone() {
    const t2 = WS.I18N.t.bind(WS.I18N);
    const isLearn = session.mode === 'learn';
    const answered = session.correct + session.wrong;
    const acc = answered ? Math.round((session.correct / answered) * 100) : 0;
    overlay().innerHTML = '';
    overlay().appendChild(WS.el('div', { class: 'study study-done' }, [
      WS.el('div', { class: 'done-card' }, [
        WS.el('div', { class: 'done-ico', text: '🎉' }),
        WS.el('h2', { text: isLearn ? t('study.done.title') : t('quiz.done.title') }),
        WS.el('p', { class: 'done-desc', text: isLearn ? t('study.done.desc', { total: session.total, correct: session.correct }) : t('quiz.done.desc', { pct: acc }) }),
        WS.el('div', { class: 'done-stats' }, [
          WS.el('span', { class: 'chip', text: t('quiz.total', { n: session.total }) }),
          WS.el('span', { class: 'chip chip-word', text: '✓ ' + session.correct }),
          WS.el('span', { class: 'chip chip-wrong', text: '✗ ' + session.wrong }),
        ]),
        WS.el('div', { class: 'done-actions' }, [
          WS.el('button', { class: 'btn btn-primary', text: t('study.again'), onclick: () => { const m = session.mode; const bid = null; session = null; if (m === 'learn') startLearn(); else startReview(); } }),
          WS.el('button', { class: 'btn btn-ghost', text: t('study.backHome'), onclick: exit }),
        ]),
      ]),
    ]));
  }

  WS.Study = { startLearn, startReview, exit };
})();
