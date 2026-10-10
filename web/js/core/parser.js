/* 文档解析器:把用户上传的 txt/md/csv/docx 解析成 {term, meaning, type} 词条 */
(function () {
  const WS = (window.WS = window.WS || {});

  function stripListMarker(line) {
    return line.replace(/^\s*(?:[-*•·●○◦▪]+|(?:\d{1,3}[.)、]))\s+/, '');
  }

  // 判断原文是单词还是语句:含空白即为语句
  function detectType(term) {
    return /\s/.test(term) ? 'sentence' : 'word';
  }

  function hasContent(s) {
    return /[A-Za-z\u00C0-\u024F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(s);
  }

  // 把一行拆成 [term, meaning],失败返回 null
  function splitPair(line, csv) {
    // 1) Tab
    if (line.indexOf('\t') >= 0) {
      const i = line.indexOf('\t');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }
    // 2) 宽分隔符(优先级最高,避免和连字符/冒号冲突)
    const wide = ['—', '–', '｜', '|', '＝', '='];
    for (const sep of wide) {
      const i = line.indexOf(sep);
      if (i > 0) return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }
    // 3) 冒号
    for (const sep of ['：', ':']) {
      const i = line.indexOf(sep);
      if (i > 0) return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }
    // 4) " word - meaning "(连字符两侧有空格)
    const m = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) return [m[1].trim(), m[2].trim()];
    // 5) CSV 逗号
    if (csv && line.indexOf(',') >= 0) {
      const i = line.indexOf(',');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }
    // 6) 两个及以上空格(双栏)
    const m2 = line.match(/^(.+?)\s{2,}(.+)$/);
    if (m2) return [m2[1].trim(), m2[2].trim()];
    // 7) 紧凑连字符/冒号:apple-苹果 / apple:苹果
    const m3 = line.match(/^([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*)\s*[-—–:：]\s*([\u4e00-\u9fff].*)$/);
    if (m3) return [m3[1].trim(), m3[2].trim()];
    // 8) 单空格两栏:apple 苹果 / Good morning 早上好
    const m4 = line.match(/^([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)*)\s+([\u4e00-\u9fff].*)$/);
    if (m4) return [m4[1].trim(), m4[2].trim()];
    return null;
  }

  function parseText(text, opts) {
    opts = opts || {};
    const lines = String(text).split(/\r\n|\n|\r/);
    const entries = [];
    const seen = new Set();
    for (let raw of lines) {
      let line = raw.trim();
      if (!line) continue;
      if (/^(#|\/\/|<!--)/.test(line)) continue; // 注释行
      line = stripListMarker(line);
      if (!line) continue;

      let term, meaning;
      const pair = splitPair(line, opts.csv);
      if (pair) { term = pair[0]; meaning = pair[1]; }
      else { term = line; meaning = ''; }

      term = term.replace(/\s+/g, ' ').trim();
      meaning = meaning.replace(/\s+/g, ' ').trim();
      if (!term || !hasContent(term)) continue;
      // 无分隔符且中英混排,疑似标题/页眉,跳过
      if (!meaning && /[\u4e00-\u9fff]/.test(term) && /[A-Za-z]/.test(term)) continue;

      const type = detectType(term);
      const key = term.toLowerCase();
      if (seen.has(key)) continue; // 去重
      seen.add(key);
      entries.push({ term, meaning, type });
    }
    return entries;
  }

  // ---- docx:解压并提取 word/document.xml 文本 ----
  function decodeEntities(s) {
    return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === '#') {
        const code = (e[1] === 'x' || e[1] === 'X') ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isNaN(code) ? m : String.fromCodePoint(code);
      }
      const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
      return map[e] != null ? map[e] : m;
    });
  }

  async function extractDocxText(arrayBuffer) {
    if (!window.JSZip) throw new Error('JSZip 未加载');
    const zip = await JSZip.loadAsync(arrayBuffer);
    const doc = zip.file('word/document.xml');
    if (!doc) throw new Error('不是有效的 .docx 文件(word/document.xml 缺失)');
    let xml = await doc.async('string');
    // 段落 → 换行,换行/制表符保留,再剥离标签
    xml = xml.replace(/<w:p[^>]*>/g, '\n')
             .replace(/<w:br[^>]*\/>/g, '\n')
             .replace(/<w:tab[^>]*\/>/g, '\t');
    xml = xml.replace(/<[^>]+>/g, '');
    return decodeEntities(xml);
  }

  async function parseFile(file) {
    const name = String(file.name || '').toLowerCase();
    let text;
    if (name.endsWith('.docx')) {
      const buf = await file.arrayBuffer();
      text = await extractDocxText(buf);
    } else {
      text = await file.text();
    }
    if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 去 BOM
    return parseText(text, { csv: name.endsWith('.csv') });
  }

  WS.Parser = { parseText, parseFile, detectType, isDocx: (f) => /\.docx$/i.test(f.name || ''), isLegacyDoc: (f) => /\.doc$/i.test(f.name || '') };
})();
