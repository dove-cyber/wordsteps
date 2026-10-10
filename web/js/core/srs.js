/* 阶段式学习引擎 —— 基于 ts-fsrs(FSRS v6 间隔重复算法)
 * 依赖:web/js/vendor/fsrs.umd.js(全局 window.FSRS)
 *
 * 对业务层暴露「阶段(stage)」概念用于阶段式可视化与筛选:
 *   0 新词 → 1 一阶(学习中) → 2/3/4 复习阶 → 5 已掌握
 * 实际复习时机由 FSRS 的 due / stability / state 决定。
 */
(function () {
  const WS = (window.WS = window.WS || {});
  const F = window.FSRS;

  const MAX_STAGE = 5;
  const scheduler = F && F.fsrs ? F.fsrs() : null;

  // 由 FSRS 卡片状态推导展示用阶段
  function stageOf(fsrsCard) {
    if (!F || !fsrsCard) return 0;
    if (fsrsCard.state === F.State.New) return 0;
    if (fsrsCard.state === F.State.Learning || fsrsCard.state === F.State.Relearning) return 1;
    // Review:按记忆稳定性(stability,单位:天)划分阶段
    const stability = Number(fsrsCard.stability) || 0;
    if (stability < 7) return 2;
    if (stability < 30) return 3;
    if (stability < 90) return 4;
    return 5;
  }

  function statusOf(stage) {
    if (stage <= 0) return 'new';
    if (stage >= MAX_STAGE) return 'mastered';
    return stage <= 2 ? 'learning' : 'reviewing';
  }

  function normalize(fsrsCard) {
    if (!fsrsCard) return F ? F.createEmptyCard() : {};
    if (fsrsCard.due) fsrsCard.due = new Date(fsrsCard.due);
    if (fsrsCard.last_review) fsrsCard.last_review = new Date(fsrsCard.last_review);
    return fsrsCard;
  }

  const SRS = {
    MAX_STAGE,

    get Rating() { return F.Rating; },
    get State() { return F.State; },
    get ready() { return !!scheduler; },

    initCard(card) {
      card.fsrs = F ? F.createEmptyCard() : {};
      card.stage = 0;
      card.correct = 0;
      card.wrong = 0;
      card.lastReview = 0;
      return card;
    },

    stageOf,
    statusOf,

    // 到期判定:只有进入过学习(阶段>0)且 due 已到的卡片才算「待复习」
    isDue(card, now) {
      if (!card || !card.fsrs || card.stage <= 0) return false;
      const due = new Date(card.fsrs.due).getTime();
      if (isNaN(due) || due === 0) return false;
      return due <= (now || Date.now());
    },

    dueTime(card) {
      if (!card || !card.fsrs) return 0;
      const t = new Date(card.fsrs.due).getTime();
      return isNaN(t) ? 0 : t;
    },

    // rating:FSRS 四档评分(Rating.Again/Hard/Good/Easy),或传 boolean(对/错)
    grade(card, rating, now) {
      now = now || new Date();
      card = card || {};
      let r = rating;
      if (typeof rating === 'boolean') r = rating ? F.Rating.Good : F.Rating.Again;
      if (scheduler && F) {
        const fsrsCard = normalize(card.fsrs || F.createEmptyCard());
        const res = scheduler.next(fsrsCard, now, r);
        card.fsrs = res.card;
      }
      if (r === F.Rating.Again) card.wrong = (card.wrong || 0) + 1;
      else card.correct = (card.correct || 0) + 1;
      card.stage = stageOf(card.fsrs);
      card.lastReview = Date.now();
      return card;
    },

    // 汇总一次会话中某卡片的多题表现,合并成一次结算
    gradeBySession(card, session) {
      const total = (session.correct || 0) + (session.wrong || 0);
      const ok = total === 0 ? false : session.correct >= session.wrong;
      return SRS.grade(card, ok);
    },
  };

  WS.SRS = SRS;
})();
