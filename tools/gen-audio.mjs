// Gom mọi câu đọc tiếng Việt của app và lập danh mục file mp3.
//   node tools/gen-audio.mjs collect  -> tools/phrases.json (danh sách câu cần thu)
//   python tools/gen_audio.py         -> audio/vi/<mã>.mp3 (chỉ tạo file còn thiếu)
//   node tools/gen-audio.mjs index    -> js/audio.js (danh mục file đang có)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\n;globalThis.__d = { SUBJECTS, SAY, audioKey };', ctx);
const { SUBJECTS, SAY, audioKey } = ctx.__d;

// Câu hỏi sinh ngẫu nhiên, nên chạy mỗi bài nhiều lần để vét hết các biến thể.
function collect(runs = 1500) {
  const texts = new Set(Object.values(SAY).flat());
  for (const s of SUBJECTS) for (const l of s.lessons) {
    for (let k = 0; k < runs; k++) for (const item of l.make()) {
      for (const [t, lang] of [...(item.say || []), ...(item.after || [])]) if (lang === 'vi') texts.add(t);
    }
  }
  return [...texts].sort((a, b) => a.localeCompare(b, 'vi'));
}

const mode = process.argv[2];
if (mode === 'collect') {
  const list = collect().map(t => ({ k: audioKey(t), t }));
  const keys = new Set(list.map(x => x.k));
  if (keys.size !== list.length) throw new Error('Trùng mã băm giữa hai câu khác nhau');
  fs.writeFileSync(path.join(root, 'tools/phrases.json'), JSON.stringify(list, null, 1));
  console.log(`${list.length} câu -> tools/phrases.json`);
} else if (mode === 'index') {
  const dir = path.join(root, 'audio/vi');
  const have = fs.readdirSync(dir).filter(f => f.endsWith('.mp3') && fs.statSync(path.join(dir, f)).size > 0).map(f => f.slice(0, -4)).sort();
  fs.writeFileSync(path.join(root, 'js/audio.js'),
    `// Tự sinh bởi tools/gen-audio.mjs — danh mục câu tiếng Việt đã có file mp3 trong audio/vi/\nconst AUDIO_VI = new Set(${JSON.stringify(have)});\n`);
  const want = JSON.parse(fs.readFileSync(path.join(root, 'tools/phrases.json'), 'utf8'));
  const missing = want.filter(x => !have.includes(x.k));
  console.log(`${have.length} file mp3 -> js/audio.js; còn thiếu ${missing.length} câu`);
  missing.slice(0, 10).forEach(x => console.log('  thiếu:', x.t));
} else {
  console.log('Dùng: node tools/gen-audio.mjs collect | index');
}
