// 把 CMU 发音词典(cmusphinx/cmudict)转换为「单词 → IPA 音标」的 JS 文件
// 输入: toolchain/cmudict.dict(需先运行 scripts/download.mjs 下载)
// 输出: web/js/vendor/en-ipa.js  (window.EN_IPA = { "about": "əˈbaʊt", ... })
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ARPAbet → IPA 对照表(标准对应关系,含重音符号)
const VOWELS = {
  AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ',
  EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
};
const CONS = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k',
  L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's', SH: 'ʃ', T: 't', TH: 'θ',
  V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};

function arpaToIpa(arpa) {
  let out = '';
  let buffer = ''; // 当前音节起始辅音(重音符号要放在音节开头)
  for (const s of arpa.trim().split(/\s+/)) {
    const m = s.match(/^([A-Z]+)([012])?$/);
    if (!m) continue;
    const phone = m[1];
    const stress = m[2] || '';
    if (!(phone in VOWELS)) { buffer += CONS[phone] || ''; continue; }
    const mark = stress === '1' ? 'ˈ' : stress === '2' ? 'ˌ' : '';
    let ipa;
    if (phone === 'ER') ipa = stress === '0' ? 'ɚ' : 'ɝ';
    else if (phone === 'AH') ipa = stress === '0' ? 'ə' : 'ʌ';
    else ipa = VOWELS[phone];
    out += mark + buffer + ipa;
    buffer = '';
  }
  return out + buffer;
}

const raw = readFileSync(join(root, '..', 'toolchain', 'cmudict.dict'), 'utf8');
const dict = {};
let skipped = 0;
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.startsWith(';;;')) continue; // 注释行
  const idx = line.indexOf(' ');
  if (idx <= 0) { skipped++; continue; }
  let word = line.slice(0, idx).trim().toLowerCase().replace(/\(\d+\)$/, '').replace(/[^a-z']/g, '');
  const arpa = line.slice(idx + 1).trim();
  if (!word || dict[word]) continue; // 空词或已存在(只取第一发音)
  const ipa = arpaToIpa(arpa);
  if (!ipa) { skipped++; continue; }
  dict[word] = ipa;
}

const out = 'window.EN_IPA=' + JSON.stringify(dict) + ';\n';
writeFileSync(join(root, 'web', 'js', 'vendor', 'en-ipa.js'), out);
console.log('词条数:', Object.keys(dict).length, '| 跳过:', skipped, '| 输出:', (out.length / 1024 / 1024).toFixed(2) + 'MB');
