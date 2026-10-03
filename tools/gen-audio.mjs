// Gom mọi câu đọc (tiếng Việt + tiếng Anh) của app và lập danh mục file mp3.
//   node tools/gen-audio.mjs collect  -> tools/phrases.json (danh sách câu cần thu)
//   python tools/gen_audio.py         -> audio/<vi|en>/<mã>.mp3 (chỉ tạo file còn thiếu)
//   node tools/gen-audio.mjs index    -> js/audio.js (danh mục file đang có)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\n;globalThis.__d = { SUBJECTS, SAY, SAY_EN, audioKey };', ctx);
const { SUBJECTS, SAY, SAY_EN, audioKey } = ctx.__d;
const LANGS = ['vi', 'en'];

// Câu hỏi sinh ngẫu nhiên, nên chạy mỗi bài nhiều lần để vét hết các biến thể.
function collect(runs = 1500) {
  const texts = { vi: new Set(Object.values(SAY).flat()), en: new Set(Object.values(SAY_EN).flat()) };
  for (const s of SUBJECTS) for (const l of s.lessons) {
    for (let k = 0; k < runs; k++) for (const item of l.make()) {
      for (const [t, lang] of [...(item.say || []), ...(item.after || [])]) texts[lang].add(t);
    }
  }
  return LANGS.flatMap(l => [...texts[l]].sort((a, b) => a.localeCompare(b, l)).map(t => ({ l, k: audioKey(t), t })));
}

const mode = process.argv[2];
if (mode === 'collect') {
  const list = collect();
  if (new Set(list.map(x => x.l + x.k)).size !== list.length) throw new Error('Trùng mã băm giữa hai câu khác nhau');
  fs.writeFileSync(path.join(root, 'tools/phrases.json'), JSON.stringify(list, null, 1));
  console.log(LANGS.map(l => `${l}: ${list.filter(x => x.l === l).length} câu`).join(', '), '-> tools/phrases.json');
} else if (mode === 'index') {
  const have = {};
  for (const l of LANGS) {
    const dir = path.join(root, 'audio', l);
    have[l] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.mp3') && fs.statSync(path.join(dir, f)).size > 0).map(f => f.slice(0, -4)).sort() : [];
  }
  fs.writeFileSync(path.join(root, 'js/audio.js'), [
    '// Tự sinh bởi tools/gen-audio.mjs — danh mục câu đã có file mp3 trong audio/<vi|en>/',
    'const AUDIO = {',
    LANGS.map(l => `  ${l}: new Set(${JSON.stringify(have[l])})`).join(',\n'),
    '};', ''
  ].join('\n'));
  const want = JSON.parse(fs.readFileSync(path.join(root, 'tools/phrases.json'), 'utf8'));
  const missing = want.filter(x => !have[x.l].includes(x.k));
  console.log(LANGS.map(l => `${l}: ${have[l].length} file`).join(', '), `-> js/audio.js; còn thiếu ${missing.length} câu`);
  missing.slice(0, 10).forEach(x => console.log('  thiếu:', x.l, x.t));
} else {
  console.log('Dùng: node tools/gen-audio.mjs collect | index');
}
