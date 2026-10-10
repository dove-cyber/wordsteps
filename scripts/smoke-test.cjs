/* 核心逻辑冒烟测试(无浏览器):验证解析器 + FSRS 阶段引擎 */
global.window = global;
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; },
};

const root = "C:/Users/g67/Documents/deepseek-harness/default-workspace/wordsteps/web";
global.FSRS = require(root + "/js/vendor/fsrs.umd.js"); // Node 下 UMD 走 exports,手动挂到 global 模拟浏览器
require(root + "/js/util.js");
require(root + "/js/i18n/index.js");
require(root + "/js/i18n/zh.js");
require(root + "/js/i18n/en.js");
require(root + "/js/langs/index.js");
require(root + "/js/langs/en.js");
require(root + "/js/core/parser.js");
require(root + "/js/core/srs.js");

const WS = global.WS;

// ---- 解析器 ----
const txt = [
  "apple - 苹果",
  "banana: 香蕉",
  "perseverance\t毅力;坚持不懈",
  "Good morning, everyone. - 大家早上好。",
  "- cherry — 樱桃",
  "1. date = 日期",
  "elderly | 年长的",
  "duplicate line",
  "duplicate line",
].join("\n");
const entries = WS.Parser.parseText(txt, {});
console.log("parsed:", entries.length, "条");
entries.forEach((e) => console.log("  ", JSON.stringify(e)));

// ---- FSRS 阶段引擎 ----
const card = {};
WS.SRS.initCard(card);
console.log("\ninit: stage=", card.stage, "state=", card.fsrs.state, "isDue=", WS.SRS.isDue(card));
let c = card;
for (let i = 0; i < 4; i++) {
  c = WS.SRS.grade(c, true);
  console.log("grade Good -> stage", c.stage, "state", c.fsrs.state, "stability", Number(c.fsrs.stability).toFixed(2), "due", c.fsrs.due);
}
c = WS.SRS.grade(c, false);
console.log("grade Again -> stage", c.stage, "state", c.fsrs.state);

console.log("\nstatusOf:", [0, 1, 2, 3, 4, 5].map((s) => s + "=" + WS.SRS.statusOf(s)).join("  "));
console.log("\n✓ smoke test done");
