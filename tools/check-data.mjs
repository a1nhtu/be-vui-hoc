// Kiểm tra dữ liệu bài học: chạy mỗi bài nhiều lần, bắt câu hỏi lỗi (đáp án sai chỉ số, phương án trùng, giá trị rỗng).
//   node tools/check-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\n;globalThis.__d = { SUBJECTS, STICKERS };', ctx);
const { SUBJECTS, STICKERS } = ctx.__d;

const errs = new Set();
let total = 0;
for (const s of SUBJECTS) for (const l of s.lessons) {
  total++;
  for (let k = 0; k < 300; k++) {
    try {
      const r = l.make();
      if (!r.length) errs.add(`${l.id}: rỗng`);
      if (/undefined|NaN/.test(JSON.stringify(r))) errs.add(`${l.id}: có giá trị rỗng`);
      if (l.type === 'choice') for (const x of r) {
        if (!(x.ans >= 0 && x.ans < x.opts.length)) errs.add(`${l.id}: đáp án sai chỉ số`);
        if (new Set(x.opts).size !== x.opts.length) errs.add(`${l.id}: phương án trùng`);
      }
      if (l.type === 'build') for (const x of r) if (x.extra.some(e => x.target.includes(e))) errs.add(`${l.id}: ô nhiễu trùng ô đúng`);
      if (l.type === 'memory' && r.length !== 12) errs.add(`${l.id}: không đủ 6 cặp`);
    } catch (e) { errs.add(`${l.id}: lỗi chạy – ${e.message}`); }
  }
}
const ids = SUBJECTS.flatMap(s => s.lessons.map(l => l.id));
if (new Set(ids).size !== ids.length) errs.add('Trùng mã bài');
if (new Set(STICKERS).size < total) errs.add(`Thiếu sticker: ${new Set(STICKERS).size} cho ${total} bài`);
console.log(SUBJECTS.map(s => `${s.title}: ${s.lessons.length}`).join(', '), `· tổng ${total} bài · ${new Set(STICKERS).size} sticker`);
console.log(errs.size ? [...errs].join('\n') : 'Không có lỗi');
process.exit(errs.size ? 1 : 0);
