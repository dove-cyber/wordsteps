/* 词库 + 存储(localStorage 回退)+ 统计/打卡 冒烟测试 */
global.window = global;
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
};

const root = "C:/Users/g67/Documents/deepseek-harness/default-workspace/wordsteps/web";
global.FSRS = require(root + "/js/vendor/fsrs.umd.js");
require(root + "/js/util.js");
require(root + "/js/i18n/index.js");
require(root + "/js/i18n/zh.js");
require(root + "/js/i18n/en.js");
require(root + "/js/langs/index.js");
require(root + "/js/langs/en.js");
require(root + "/js/core/tts.js");
require(root + "/js/core/storage.js");
require(root + "/js/core/parser.js");
require(root + "/js/core/srs.js");
require(root + "/js/core/wordbank.js");

const WS = global.WS;

(async () => {
  const engine = await WS.DB.init();
  console.log("engine:", engine);

  const entries = WS.Parser.parseText("apple - 苹果\nbanana - 香蕉\nGood morning - 早上好\n", {});
  const { bank, count } = await WS.WordBank.createBank({ name: "测试", contentLang: "en", entries });
  console.log("created bank, count =", count);

  const banks = await WS.WordBank.listBanks();
  console.log("banks:", banks.length, "counts:", JSON.stringify(banks[0].counts));

  const stats = await WS.WordBank.getStats();
  console.log("stats:", stats.total, "new", stats.new);

  const newCards = await WS.WordBank.getNewCards(10);
  console.log("newCards:", newCards.length);

  let c = newCards[0];
  WS.SRS.grade(c, true);
  await WS.WordBank.saveCard(c);
  console.log("due right after grade (应=0,未到期):", (await WS.WordBank.getDueCards()).length);

  await WS.WordBank.recordActivity('learn', 3, 2);
  const prog = await WS.WordBank.getProgress();
  console.log("progress: streak", prog.streak, "xp", prog.xp, "todayLearned", prog.todayLearned);

  await WS.WordBank.deleteBank(bank.id);
  console.log("after delete banks:", (await WS.WordBank.listBanks()).length, "cards:", (await WS.DB.getAllCards()).length);

  console.log("✓ wordbank smoke ok");
})();
