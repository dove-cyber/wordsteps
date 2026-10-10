/* 无头端到端测试:用 jsdom 真实加载页面并模拟点击,验证核心交互(需先启动 scripts/serve.mjs)
 * 直接运行: node scripts/e2e-test.cjs
 */
const path = require('path');
const fs = require('fs');

// pnpm 在 Windows 下用 junction 链接依赖,Node 有时不解析;把 jsdom 的虚拟存储加入 NODE_PATH 兜底
(function fixPnpmPaths() {
  const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
  const extra = [];
  if (fs.existsSync(pnpmDir)) {
    for (const d of fs.readdirSync(pnpmDir)) {
      if (d.startsWith('jsdom@')) {
        const p = path.join(pnpmDir, d, 'node_modules');
        if (fs.existsSync(p)) extra.push(p);
      }
    }
  }
  if (extra.length) {
    process.env.NODE_PATH = extra.join(path.delimiter) + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : '');
    require('module').Module._initPaths();
  }
})();

const { JSDOM, VirtualConsole } = require('jsdom');

async function main() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('[jsdomError] ' + e.message));
  vc.on('error', (...a) => errors.push('[console.error] ' + a.join(' ')));

  const dom = await JSDOM.fromURL('http://localhost:4173/index.html', {
    resources: 'usable',
    runScripts: 'dangerously',
    virtualConsole: vc,
  });
  const { window } = dom;
  const doc = window.document;

  const waitFor = (fn, label, ms = 10000) => new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      let r = false;
      try { r = !!fn(); } catch (e) {}
      if (r) { clearInterval(timer); resolve(); }
      else if (Date.now() - t0 > ms) { clearInterval(timer); reject(new Error('timeout: ' + label)); }
    }, 50);
  });

  // 1. 首页渲染
  await waitFor(() => doc.querySelector('#view-home .action-learn'), '首页渲染');
  console.log('✓ 首页渲染完成(出现「开始学习」按钮)');

  // 2. 顶部标签切换 → 导入页
  doc.querySelector('.tab[data-view="import"]').click();
  await waitFor(() => !doc.querySelector('#view-import').classList.contains('hidden') && doc.querySelector('#import-preview'), '导入页');
  console.log('✓ 顶部「导入」标签切换正常');

  // 3. 一键导入内置示例词库
  const sampleBtn = [...doc.querySelectorAll('#view-import button')].find((b) => b.textContent.includes('示例'));
  if (!sampleBtn) throw new Error('未找到示例导入按钮');
  sampleBtn.click();
  await waitFor(() => !doc.querySelector('#view-banks').classList.contains('hidden') && doc.querySelector('.bank-card'), '词库页卡片');
  console.log('✓ 示例词库导入成功,词库页出现卡片');

  // 4. 回到首页,点「开始学习」
  doc.querySelector('.tab[data-view="home"]').click();
  await waitFor(() => doc.querySelector('#view-home .action-learn'), '回首页');
  doc.querySelector('#view-home .action-learn').click();
  await waitFor(() => !doc.querySelector('#study-overlay').classList.contains('hidden') && doc.querySelector('#study-overlay .flashcard'), '学习覆盖层');
  console.log('✓ 「开始学习」进入覆盖层,出现单词卡');

  // 5. 点「认识」走到下一题
  doc.querySelector('#study-overlay .intro-actions .btn-primary').click();
  await waitFor(() => doc.querySelector('#study-overlay .options') || doc.querySelector('#study-overlay .type-row'), '进入选择题/拼写');
  console.log('✓ 认识环节通过,进入选择题/拼写');

  // 6. 统计标签
  doc.querySelector('#study-overlay .btn-exit').click();
  await waitFor(() => doc.querySelector('#study-overlay').classList.contains('hidden'), '退出学习');
  doc.querySelector('.tab[data-view="stats"]').click();
  await waitFor(() => !doc.querySelector('#view-stats').classList.contains('hidden') && doc.querySelector('#view-stats .stage-bar'), '统计页');
  console.log('✓ 统计页渲染(阶段分布条存在)');

  console.log('\n== 页面脚本错误 ==');
  console.log(errors.length ? errors.join('\n') : '(无)');
  if (errors.length) process.exitCode = 2;
  window.close();
}

main().catch((e) => { console.error('E2E FAIL:', e.message); process.exit(1); });
