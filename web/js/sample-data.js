/* 内置示例词库:便于开箱即用、无需文件即可体验学习/考察流程 */
(function () {
  const WS = (window.WS = window.WS || {});

  const words = [
    ['apple', '苹果'],
    ['banana', '香蕉'],
    ['orange', '橙子;橘子'],
    ['grape', '葡萄'],
    ['strawberry', '草莓'],
    ['watermelon', '西瓜'],
    ['lemon', '柠檬'],
    ['peach', '桃子'],
    ['bread', '面包'],
    ['butter', '黄油'],
    ['cheese', '奶酪'],
    ['coffee', '咖啡'],
    ['breakfast', '早餐'],
    ['dinner', '晚餐;正餐'],
    ['kitchen', '厨房'],
    ['library', '图书馆'],
    ['airport', '机场'],
    ['umbrella', '雨伞'],
    ['bicycle', '自行车'],
    ['journey', '旅行;旅程'],
    ['weather', '天气'],
    ['temperature', '温度'],
    ['cloudy', '多云的'],
    ['sunny', '晴朗的'],
    ['rainy', '下雨的'],
    ['windy', '有风的'],
    ['autumn', '秋天'],
    ['spring', '春天;泉水'],
    ['summer', '夏天'],
    ['winter', '冬天'],
    ['family', '家庭;家人'],
    ['friend', '朋友'],
    ['teacher', '老师'],
    ['student', '学生'],
    ['hospital', '医院'],
    ['medicine', '药;医学'],
    ['healthy', '健康的'],
    ['delicious', '美味的'],
    ['beautiful', '美丽的'],
    ['important', '重要的'],
    ['different', '不同的'],
    ['difficult', '困难的'],
    ['interesting', '有趣的'],
    ['perseverance', '毅力;坚持不懈'],
    ['gratitude', '感激;感恩'],
    ['opportunity', '机会;机遇'],
    ['challenge', '挑战'],
    ['achieve', '实现;达成'],
    ['improve', '改善;提高'],
    ['remember', '记住;记得'],
  ];

  const sentences = [
    ['Good morning, everyone.', '大家早上好。'],
    ['How are you today?', '你今天好吗？'],
    ['Nice to meet you.', '很高兴认识你。'],
    ['Could you help me, please?', '能请你帮我一下吗？'],
    ['Practice makes perfect.', '熟能生巧。'],
    ['Where there is a will, there is a way.', '有志者事竟成。'],
    ['Actions speak louder than words.', '行动胜于言语。'],
    ['The early bird catches the worm.', '早起的鸟儿有虫吃。'],
    ['Time flies when you are having fun.', '快乐的时光总是过得飞快。'],
    ['A journey of a thousand miles begins with a single step.', '千里之行，始于足下。'],
    ['Rome was not built in a day.', '罗马不是一天建成的。'],
    ['Never give up on your dreams.', '永远不要放弃你的梦想。'],
  ];

  function build(list, type) {
    return list.map(([term, meaning]) => ({ term, meaning, type }));
  }

  WS.SAMPLE = {
    name: '示例词库(内置)',
    entries() { return build(words, 'word').concat(build(sentences, 'sentence')); },
  };
})();
