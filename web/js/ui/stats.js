/* 统计页:阶段分布、正确率、打卡、近 7 天学习量 */
(function () {
  const WS = (window.WS = window.WS || {});
  const STAGE_COLORS = ['#9aa4b2', '#38bdf8', '#818cf8', '#a78bfa', '#f472b6', '#34d399'];

  async function render() {
    const t = WS.I18N.t.bind(WS.I18N);
    const view = document.getElementById('view-stats');
    view.innerHTML = '';
    view.appendChild(WS.el('div', { class: 'loading', text: t('common.loading') }));

    const stats = await WS.WordBank.getStats();
    const prog = await WS.WordBank.getProgress();
    view.innerHTML = '';

    const page = WS.el('div', { class: 'page' }, [WS.el('h2', { class: 'page-title', text: t('stats.title') })]);

    if (stats.total === 0) {
      page.appendChild(WS.el('div', { class: 'card empty-hint' }, [
        WS.el('p', { text: t('stats.needMore') }),
        WS.el('button', { class: 'btn btn-primary', text: t('nav.import'), onclick: () => WS.App.go('import') }),
      ]));
      view.appendChild(page);
      return;
    }

    // 概览
    page.appendChild(WS.el('div', { class: 'stat-grid' }, [
      statTile('📚', t('stats.total'), stats.total),
      statTile('🏆', t('stats.mastered'), stats.mastered),
      statTile('🎯', t('stats.accuracy'), stats.accuracy + '%'),
      statTile('🔥', t('stats.streak'), t('home.streak.days', { n: prog.streak })),
    ]));

    // 阶段分布
    const distCard = WS.el('div', { class: 'card' }, [
      WS.el('h3', { class: 'section-title', text: t('stats.stages') }),
    ]);
    const bar = WS.el('div', { class: 'stage-bar' });
    const legend = WS.el('div', { class: 'stage-legend' });
    for (let s = 0; s <= 5; s++) {
      const n = stats.dist[s] || 0;
      const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
      bar.appendChild(WS.el('div', {
        class: 'stage-seg', style: { width: pct + '%', background: STAGE_COLORS[s] },
        title: t('stats.stage.' + s) + ': ' + n,
      }));
      legend.appendChild(WS.el('div', { class: 'legend-item' }, [
        WS.el('span', { class: 'legend-dot', style: { background: STAGE_COLORS[s] } }),
        WS.el('span', { text: t('stats.stage.' + s) + ' ' + n }),
      ]));
    }
    distCard.appendChild(bar);
    distCard.appendChild(legend);
    page.appendChild(distCard);

    // 近 7 天
    page.appendChild(WS.el('div', { class: 'card' }, [
      WS.el('h3', { class: 'section-title', text: t('stats.daily') }),
      dailyChart(prog.log, t),
    ]));

    view.appendChild(page);
  }

  function statTile(ico, label, value) {
    return WS.el('div', { class: 'card stat-tile' }, [
      WS.el('div', { class: 'stat-ico', text: ico }),
      WS.el('div', { class: 'stat-num', text: String(value) }),
      WS.el('div', { class: 'stat-label', text: label }),
    ]);
  }

  function dailyChart(log, t) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = WS.WordBank.todayKey(d);
      const rec = log[key] || { learned: 0, reviewed: 0 };
      const label = i === 0 ? t('common.today') : (d.getMonth() + 1) + '/' + d.getDate();
      days.push({ label, learned: rec.learned || 0, reviewed: rec.reviewed || 0 });
    }
    const max = Math.max(1, ...days.map((d) => d.learned + d.reviewed));
    const chart = WS.el('div', { class: 'daily-chart' });
    days.forEach((d) => {
      const total = d.learned + d.reviewed;
      chart.appendChild(WS.el('div', { class: 'daily-col' }, [
        WS.el('div', { class: 'daily-bars' }, [
          WS.el('div', { class: 'daily-bar daily-learned', style: { height: (d.learned / max) * 100 + '%' } }),
          WS.el('div', { class: 'daily-bar daily-reviewed', style: { height: (d.reviewed / max) * 100 + '%' } }),
        ]),
        WS.el('div', { class: 'daily-val', text: total ? String(total) : '' }),
        WS.el('div', { class: 'daily-label', text: d.label }),
      ]));
    });
    return chart;
  }

  WS.Stats = { render };
})();
