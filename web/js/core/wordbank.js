/* 词库与进度管理:整合存储 + SRS,提供学习/复习数据接口与学习进度(打卡/经验/每日日志) */
(function () {
  const WS = (window.WS = window.WS || {});

  function todayKey(ts) {
    const d = ts ? new Date(ts) : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  async function allCards() {
    return WS.DB.getAllCards();
  }

  const WordBank = {
    todayKey,

    countsOf(cards) {
      const c = { total: cards.length, new: 0, learning: 0, reviewing: 0, mastered: 0 };
      cards.forEach((x) => { c[WS.SRS.statusOf(x.stage)]++; });
      return c;
    },

    // 导入文档 → 建词库 + 写入卡片
    async createBank({ name, contentLang, entries }) {
      const bank = {
        id: WS.uid(), name, contentLang, source: 'import', createdAt: Date.now(),
      };
      await WS.DB.putBank(bank);
      const cards = entries.map((e) => {
        const type = e.type || 'word';
        const c = {
          id: WS.uid(), bankId: bank.id, term: e.term, meaning: e.meaning,
          type, contentLang, createdAt: Date.now(),
        };
        // 单词类词条自动附加 IPA 音标(供初学者练习发音)
        if (type === 'word') c.phonetic = (WS.Phonetics && WS.Phonetics.lookup(e.term)) || '';
        WS.SRS.initCard(c);
        return c;
      });
      await WS.DB.putCards(cards);
      return { bank, count: cards.length };
    },

    async listBanks() {
      const banks = await WS.DB.getAllBanks();
      const cards = await allCards();
      const byBank = {};
      cards.forEach((c) => { (byBank[c.bankId] = byBank[c.bankId] || []).push(c); });
      return banks.map((b) => ({ ...b, counts: WordBank.countsOf(byBank[b.id] || []) }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },

    async getBank(id) {
      const banks = await WS.DB.getAllBanks();
      return banks.find((b) => b.id === id);
    },

    async deleteBank(id) { await WS.DB.deleteBank(id); },

    async getCardsByBank(bankId) { return WS.DB.getCardsByBank(bankId); },

    async saveCard(card) { await WS.DB.putCard(card); },

    // 取新词(未进入任何阶段)用于「开始学习」
    async getNewCards(limit, bankId) {
      let cards = await allCards();
      if (bankId) cards = cards.filter((c) => c.bankId === bankId);
      return WS.shuffle(cards.filter((c) => (c.stage || 0) <= 0)).slice(0, limit || 10);
    },

    // 取到期卡片用于「乱序复习」
    async getDueCards(bankId) {
      const now = Date.now();
      let cards = await allCards();
      if (bankId) cards = cards.filter((c) => c.bankId === bankId);
      return WS.shuffle(cards.filter((c) => WS.SRS.isDue(c, now)));
    },

    // ---- 统计 ----
    async getStats() {
      const cards = await allCards();
      const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let correct = 0, wrong = 0;
      cards.forEach((c) => {
        dist[c.stage || 0]++;
        correct += c.correct || 0;
        wrong += c.wrong || 0;
      });
      const total = cards.length;
      return {
        total,
        new: dist[0],
        learning: dist[1] + dist[2],
        reviewing: dist[3] + dist[4],
        mastered: dist[5],
        dist,
        correct,
        wrong,
        accuracy: (correct + wrong) ? Math.round((correct / (correct + wrong)) * 100) : 0,
      };
    },

    // ---- 学习进度(打卡/经验/每日日志) ----
    async getProgress() {
      const goal = (await WS.DB.getMeta('dailyGoal')) || 20;
      const streak = (await WS.DB.getMeta('streak')) || { count: 0, last: '' };
      const xp = (await WS.DB.getMeta('xp')) || 0;
      const log = (await WS.DB.getMeta('dailyLog')) || {};
      const today = todayKey();
      const t = log[today] || { learned: 0, reviewed: 0, correct: 0 };
      return {
        dailyGoal: goal, streak: streak.count || 0, xp,
        todayLearned: t.learned || 0, todayReviewed: t.reviewed || 0, todayCorrect: t.correct || 0,
        log,
      };
    },

    // 记录一次学习/复习活动,更新每日日志、打卡、经验
    async recordActivity(kind, n, correct) {
      const today = todayKey();
      const yesterday = todayKey(Date.now() - 86400000);

      const log = (await WS.DB.getMeta('dailyLog')) || {};
      const t = log[today] || { learned: 0, reviewed: 0, correct: 0 };
      if (kind === 'learn') t.learned = (t.learned || 0) + (n || 0);
      if (kind === 'review') t.reviewed = (t.reviewed || 0) + (n || 0);
      t.correct = (t.correct || 0) + (correct || 0);
      log[today] = t;
      await WS.DB.setMeta('dailyLog', log);

      const streak = (await WS.DB.getMeta('streak')) || { count: 0, last: '' };
      if (streak.last === today) { /* 同日,不重复计 */ }
      else if (streak.last === yesterday) streak.count = (streak.count || 0) + 1;
      else streak.count = 1;
      streak.last = today;
      await WS.DB.setMeta('streak', streak);

      const xp = (await WS.DB.getMeta('xp')) || 0;
      await WS.DB.setMeta('xp', xp + (correct || 0) * 5 + (n || 0) * 1);

      // 每日目标进度(学习的新词数)
      WS.Events.emit('progress:change');
    },

    async setDailyGoal(n) { await WS.DB.setMeta('dailyGoal', n); },
  };

  WS.WordBank = WordBank;
})();
