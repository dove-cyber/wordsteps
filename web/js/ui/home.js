/* 首页/仪表盘:打卡、每日目标、经验等级、开始学习与乱序复习入口 */
(function () {
  const WS = (window.WS = window.WS || {});

  function xpInfo(xp) {
    const per = 200;
    const level = Math.floor(xp / per) + 1;
    return { level, cur: xp % per, need: per };
  }

  async function render() {
    const view = document.getElementById('view-home');
    const t = WS.I18N.t.bind(WS.I18N);
    view.innerHTML = '';
    view.appendChild(WS.el('div', { class: 'loading', text: t('common.loading') }));

    const stats = await WS.WordBank.getStats();
    const prog = await WS.WordBank.getProgress();
    const dueCards = await WS.WordBank.getDueCards();
    const xp = xpInfo(prog.xp);
    const goalPct = Math.min(100, Math.round((prog.todayLearned / prog.dailyGoal) * 100));

    view.innerHTML = '';

    // ---- 顶部横幅 ----
    const hero = WS.el('div', { class: 'card hero' }, [
      WS.el('div', { class: 'hero-left' }, [
        WS.el('h1', { text: t('home.greeting') }),
        WS.el('p', { class: 'slogan', text: t('home.slogan') }),
        WS.el('div', { class: 'badges' }, [
          WS.el('span', { class: 'badge badge-streak', text: '🔥 ' + t('home.streak') + ' ' + t('home.streak.days', { n: prog.streak }) }),
          WS.el('span', { class: 'badge badge-level', text: t('home.level', { n: xp.level }) }),
        ]),
      ]),
      WS.el('div', { class: 'hero-right' }, [
        WS.el('div', { class: 'goal-label', text: t('home.dailyGoal') }),
        WS.el('div', { class: 'goal-big', text: t('home.dailyProgress', { done: prog.todayLearned, goal: prog.dailyGoal }) }),
        WS.el('div', { class: 'progress' }, [
          WS.el('div', { class: 'progress-fill', style: { width: goalPct + '%' } }),
        ]),
        WS.el('div', { class: 'xp-line', text: t('home.stat.xp') + ' ' + prog.xp + ' · ' + t('home.todayLearned', { n: prog.todayLearned }) }),
      ]),
    ]);

    // ---- 主操作按钮 ----
    const learnBtn = WS.el('button', {
      class: 'action action-learn',
      onclick: () => WS.Study.startLearn(),
    }, [
      WS.el('span', { class: 'action-ico', text: '📖' }),
      WS.el('span', { class: 'action-label', text: t('home.startLearn') }),
      WS.el('span', { class: 'action-sub', text: t('stats.new') + ' ' + stats.new }),
    ]);

    const reviewBtn = WS.el('button', {
      class: 'action action-review',
      onclick: () => WS.Study.startReview(),
    }, [
      WS.el('span', { class: 'action-ico', text: '🔀' }),
      WS.el('span', { class: 'action-label', text: t('home.startReview') }),
      WS.el('span', {
        class: 'action-sub',
        text: dueCards.length ? t('home.dueCount', { n: dueCards.length }) : t('home.noDue'),
      }),
    ]);

    // ---- 统计卡片 ----
    const statTiles = WS.el('div', { class: 'stat-grid' }, [
      statTile('📚', t('home.stat.total'), stats.total),
      statTile('🏆', t('home.stat.mastered'), stats.mastered),
      statTile('🎯', t('home.stat.accuracy'), stats.accuracy + '%'),
    ]);

    view.appendChild(WS.el('div', { class: 'home' }, [
      hero,
      WS.el('div', { class: 'action-grid' }, [learnBtn, reviewBtn]),
      statTiles,
      stats.total === 0 ? WS.el('div', { class: 'card empty-hint' }, [
        WS.el('p', { text: t('home.empty') }),
        WS.el('button', { class: 'btn btn-primary', text: t('nav.import'), onclick: () => WS.App.go('import') }),
      ]) : null,
    ]));
  }

  function statTile(ico, label, value) {
    return WS.el('div', { class: 'card stat-tile' }, [
      WS.el('div', { class: 'stat-ico', text: ico }),
      WS.el('div', { class: 'stat-num', text: String(value) }),
      WS.el('div', { class: 'stat-label', text: label }),
    ]);
  }

  WS.Home = { render };
})();
