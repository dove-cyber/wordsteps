/* 英语内容语言配置(默认)。复制本文件改为 ja.js / es.js 即可扩展多语言。 */
window.WS.Langs.register({
  code: 'en',
  name: '英语',
  nativeName: 'English',
  direction: 'ltr',        // 书写方向:ltr / rtl(阿拉伯语等)
  tts: 'en-US',            // Web Speech API 语音代码
  // 示例词条,仅用于导入页展示「英语文档长什么样」
  sample: [
    ['apple', '苹果'],
    ['perseverance', '毅力;坚持不懈'],
    ['Good morning, everyone.', '大家早上好。'],
    ['Practice makes perfect.', '熟能生巧。'],
  ],
});

/*
 * 多语言扩展示例(未来启用时取消注释并新建对应 js 文件):
 *
 * window.WS.Langs.register({
 *   code: 'ja', name: '日语', nativeName: '日本語',
 *   direction: 'ltr', tts: 'ja-JP',
 *   sample: [['りんご', '苹果'], ['おはよう', '早上好']],
 * });
 *
 * window.WS.Langs.register({
 *   code: 'es', name: '西班牙语', nativeName: 'Español',
 *   direction: 'ltr', tts: 'es-ES',
 *   sample: [['manzana', '苹果'], ['buenos días', '早上好']],
 * });
 */
