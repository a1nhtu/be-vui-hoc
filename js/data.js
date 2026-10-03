'use strict';
/* Nội dung bài học. Mỗi bài có type: learn | choice | balloon | memory | build
   và hàm make() trả về danh sách thẻ / câu hỏi (trộn ngẫu nhiên mỗi lần chơi). */

const U = {
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  sample(a, n) { return U.shuffle(a).slice(0, n); },
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  up(s) { return s.toLocaleUpperCase('vi'); }
};

// Tên file mp3 của một câu đọc tiếng Việt (dùng chung cho app và tools/gen-audio.mjs)
function audioKey(t) {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
// Câu nói cố định của app. Không chèn tên bé vào đây vì giọng đọc là file thu sẵn.
const SAY = {
  praise: ['Đúng rồi!', 'Giỏi lắm!', 'Tuyệt vời!', 'Hay quá!', 'Chính xác!'],
  retry: ['Thử lại nhé!', 'Chưa đúng, con chọn lại nào!', 'Gần đúng rồi, thử lại nhé!'],
  hello: 'Chào bé! Hôm nay mình học gì nào?',
  locked: 'Con học xong bài trước để mở khoá nhé!',
  memory: 'Bé lật hai thẻ giống nhau thành một cặp nhé!',
  done: ['Hoan hô! Con được 1 sao!', 'Hoan hô! Con được 2 sao!', 'Hoan hô! Con được 3 sao!'],
  rest: 'Bé ơi, mình nghỉ mắt một lát nhé!',
  test: 'Chào bé! Mình cùng học nhé.'
};

/* ---------- Dữ liệu gốc ---------- */

// 29 chữ cái tiếng Việt: c = chữ, s = cách đọc âm (theo chương trình lớp 1), w = từ mẫu, e = hình, pic = dùng cho bài "chữ đầu của hình"
const VI = [
  { c: 'a', s: 'a', w: 'áo', e: '👕' }, { c: 'ă', s: 'á', w: 'ăn cơm', e: '🍚' }, { c: 'â', s: 'ớ', w: 'ấm trà', e: '🍵' },
  { c: 'b', s: 'bờ', w: 'bò', e: '🐄', pic: 1 }, { c: 'c', s: 'cờ', w: 'cá', e: '🐟', pic: 1 }, { c: 'd', s: 'dờ', w: 'dê', e: '🐐', pic: 1 },
  { c: 'đ', s: 'đờ', w: 'đèn', e: '💡', pic: 1 }, { c: 'e', s: 'e', w: 'em bé', e: '👶' }, { c: 'ê', s: 'ê', w: 'ếch', e: '🐸', pic: 1 },
  { c: 'g', s: 'gờ', w: 'gà', e: '🐔', pic: 1 }, { c: 'h', s: 'hờ', w: 'hoa', e: '🌸', pic: 1 }, { c: 'i', s: 'i', w: 'im lặng', e: '🤫' },
  { c: 'k', s: 'ca', w: 'kem', e: '🍦', pic: 1 }, { c: 'l', s: 'lờ', w: 'lá', e: '🍃', pic: 1 }, { c: 'm', s: 'mờ', w: 'mèo', e: '🐱', pic: 1 },
  { c: 'n', s: 'nờ', w: 'nơ', e: '🎀', pic: 1 }, { c: 'o', s: 'o', w: 'ong', e: '🐝', pic: 1 }, { c: 'ô', s: 'ô', w: 'ô', e: '☂️' },
  { c: 'ơ', s: 'ơ', w: 'ớt', e: '🌶️' }, { c: 'p', s: 'pờ', w: 'pin', e: '🔋' }, { c: 'q', s: 'cu', w: 'quà', e: '🎁' },
  { c: 'r', s: 'rờ', w: 'rùa', e: '🐢', pic: 1 }, { c: 's', s: 'sờ', w: 'sao', e: '⭐', pic: 1 }, { c: 't', s: 'tờ', w: 'táo', e: '🍎', pic: 1 },
  { c: 'u', s: 'u', w: 'ủng', e: '🥾' }, { c: 'ư', s: 'ư', w: 'ừ', e: '👍' }, { c: 'v', s: 'vờ', w: 'voi', e: '🐘', pic: 1 },
  { c: 'x', s: 'xờ', w: 'xe đạp', e: '🚲', pic: 1 }, { c: 'y', s: 'i dài', w: 'y tá', e: '👩‍⚕️' }
];

const TONES = [
  { n: 'thanh ngang', k: 0 }, { n: 'thanh huyền', k: 1 }, { n: 'thanh sắc', k: 2 },
  { n: 'thanh hỏi', k: 3 }, { n: 'thanh ngã', k: 4 }, { n: 'thanh nặng', k: 5 }
];
const TONE_MAP = { a: 'aàáảãạ', o: 'oòóỏõọ', e: 'eèéẻẽẹ' };
const TONE_BASES = ['ma', 'ba', 'la', 'ca', 'da', 'ga', 'bo', 'co', 'lo', 'me', 'be', 've'];
const toneOf = (base, k) => base[0] + TONE_MAP[base[1]][k];

// Ghép vần: phụ âm + nguyên âm
const SYL = [['b', 'a'], ['b', 'o'], ['b', 'e'], ['c', 'a'], ['c', 'o'], ['d', 'a'], ['d', 'ê'], ['đ', 'i'], ['đ', 'o'], ['g', 'a'],
  ['h', 'ô'], ['l', 'a'], ['l', 'ê'], ['m', 'e'], ['m', 'ơ'], ['n', 'ơ'], ['t', 'ô'], ['t', 'a'], ['v', 'e'], ['x', 'e']];
// Ghép tiếng có hình
const VI_WORDS = [
  { w: 'cá', t: ['c', 'á'], e: '🐟' }, { w: 'bò', t: ['b', 'ò'], e: '🐄' }, { w: 'gà', t: ['g', 'à'], e: '🐔' }, { w: 'dê', t: ['d', 'ê'], e: '🐐' },
  { w: 'lá', t: ['l', 'á'], e: '🍃' }, { w: 'nơ', t: ['n', 'ơ'], e: '🎀' }, { w: 'xe', t: ['x', 'e'], e: '🚲' }, { w: 'hổ', t: ['h', 'ổ'], e: '🐯' },
  { w: 'bé', t: ['b', 'é'], e: '👶' }, { w: 'mẹ', t: ['m', 'ẹ'], e: '👩' }, { w: 'bố', t: ['b', 'ố'], e: '👨' },
  { w: 'mèo', t: ['m', 'è', 'o'], e: '🐱' }, { w: 'voi', t: ['v', 'o', 'i'], e: '🐘' }, { w: 'táo', t: ['t', 'á', 'o'], e: '🍎' },
  { w: 'sao', t: ['s', 'a', 'o'], e: '⭐' }, { w: 'hoa', t: ['h', 'o', 'a'], e: '🌸' }, { w: 'rùa', t: ['r', 'ù', 'a'], e: '🐢' }, { w: 'kem', t: ['k', 'e', 'm'], e: '🍦' }
];

const COUNTABLE = [
  { e: '🐱', n: 'con mèo' }, { e: '🍎', n: 'quả táo' }, { e: '⭐', n: 'ngôi sao' }, { e: '🐟', n: 'con cá' },
  { e: '🌸', n: 'bông hoa' }, { e: '🚗', n: 'ô tô' }, { e: '🐥', n: 'con gà con' }, { e: '🎈', n: 'quả bóng bay' }, { e: '🥕', n: 'củ cà rốt' }
];
const SHAPES = [
  { n: 'hình tròn', svg: c => `<circle cx="50" cy="50" r="42" fill="${c}"/>` },
  { n: 'hình vuông', svg: c => `<rect x="10" y="10" width="80" height="80" rx="4" fill="${c}"/>` },
  { n: 'hình tam giác', svg: c => `<polygon points="50,8 94,90 6,90" fill="${c}"/>` },
  { n: 'hình chữ nhật', svg: c => `<rect x="4" y="26" width="92" height="48" rx="4" fill="${c}"/>` }
];
const SHAPE_COLORS = ['#ff5a5f', '#3aa6ff', '#ffb703', '#20c997', '#9b5de5'];
const PATTERN_SETS = [['❤️', '💙'], ['💛', '💚'], ['🍎', '🍌'], ['🐶', '🐱'], ['⭐', '🌙'], ['🌸', '🍃']];

// Tiếng Anh
const EN_ABC = [
  ['A', 'apple', '🍎'], ['B', 'ball', '⚽'], ['C', 'cat', '🐱'], ['D', 'dog', '🐶'], ['E', 'egg', '🥚'], ['F', 'fish', '🐟'], ['G', 'goat', '🐐'],
  ['H', 'hat', '🎩'], ['I', 'ice cream', '🍦'], ['J', 'juice', '🍹'], ['K', 'key', '🔑'], ['L', 'lion', '🦁'], ['M', 'moon', '🌙'], ['N', 'nose', '👃'],
  ['O', 'orange', '🍊'], ['P', 'pig', '🐷'], ['Q', 'queen', '👸'], ['R', 'rabbit', '🐰'], ['S', 'sun', '☀️'], ['T', 'tree', '🌳'], ['U', 'umbrella', '☂️'],
  ['V', 'van', '🚐'], ['W', 'watch', '⌚'], ['X', 'box', '📦'], ['Y', 'yellow', '💛'], ['Z', 'zebra', '🦓']
].map(([c, w, e]) => ({ c, w, e }));
const EN_NUM = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map((w, i) => ({ w, n: i + 1 }));
const EN_COLORS = [['red', 'màu đỏ', '#e53935'], ['blue', 'màu xanh dương', '#1e88e5'], ['green', 'màu xanh lá', '#43a047'], ['yellow', 'màu vàng', '#fdd835'],
  ['orange', 'màu cam', '#fb8c00'], ['pink', 'màu hồng', '#f06292'], ['purple', 'màu tím', '#8e24aa'], ['black', 'màu đen', '#212121'],
  ['white', 'màu trắng', '#ffffff'], ['brown', 'màu nâu', '#795548']].map(([w, vi, hex]) => ({ w, vi, hex }));
const voc = a => a.map(([w, vi, e]) => ({ w, vi, e }));
const EN_ANIMALS = voc([['cat', 'con mèo', '🐱'], ['dog', 'con chó', '🐶'], ['fish', 'con cá', '🐟'], ['bird', 'con chim', '🐦'], ['cow', 'con bò', '🐄'], ['pig', 'con lợn', '🐷'],
  ['duck', 'con vịt', '🦆'], ['lion', 'sư tử', '🦁'], ['monkey', 'con khỉ', '🐵'], ['elephant', 'con voi', '🐘'], ['rabbit', 'con thỏ', '🐰'], ['bee', 'con ong', '🐝']]);
const EN_FRUITS = voc([['apple', 'quả táo', '🍎'], ['banana', 'quả chuối', '🍌'], ['orange', 'quả cam', '🍊'], ['grapes', 'chùm nho', '🍇'], ['watermelon', 'dưa hấu', '🍉'],
  ['strawberry', 'dâu tây', '🍓'], ['pineapple', 'quả dứa', '🍍'], ['lemon', 'quả chanh', '🍋'], ['pear', 'quả lê', '🍐'], ['cherry', 'quả anh đào', '🍒']]);
const EN_FAMILY = voc([['father', 'bố', '👨'], ['mother', 'mẹ', '👩'], ['baby', 'em bé', '👶'], ['brother', 'anh, em trai', '👦'], ['sister', 'chị, em gái', '👧'],
  ['grandpa', 'ông', '👴'], ['grandma', 'bà', '👵']]);
const EN_THINGS = voc([['ball', 'quả bóng', '⚽'], ['book', 'quyển sách', '📖'], ['car', 'ô tô', '🚗'], ['bus', 'xe buýt', '🚌'], ['sun', 'mặt trời', '☀️'], ['moon', 'mặt trăng', '🌙'],
  ['star', 'ngôi sao', '⭐'], ['tree', 'cái cây', '🌳'], ['house', 'ngôi nhà', '🏠'], ['hat', 'cái mũ', '🎩']]);
const EN_SPELL3 = voc([['cat', '', '🐱'], ['dog', '', '🐶'], ['pig', '', '🐷'], ['sun', '', '☀️'], ['bus', '', '🚌'], ['hat', '', '🎩'], ['bee', '', '🐝'], ['cow', '', '🐄'], ['car', '', '🚗'], ['egg', '', '🥚']]);
const EN_SPELL4 = voc([['fish', '', '🐟'], ['duck', '', '🦆'], ['ball', '', '⚽'], ['book', '', '📖'], ['moon', '', '🌙'], ['star', '', '⭐'], ['tree', '', '🌳'], ['lion', '', '🦁']]);

// Câu đố vui: q = câu hỏi, a = đáp án, d = phương án nhiễu
const RIDDLES = [
  [
    ['Con gì kêu meo meo, thích bắt chuột?', '🐱', '🐶🐷🐔'], ['Con gì gáy ò ó o gọi bé dậy?', '🐓', '🦆🐄🐱'], ['Con gì có cái vòi thật dài?', '🐘', '🦁🐴🐒'],
    ['Con gì ăn no, bụng to, kêu ụt ịt?', '🐷', '🐄🐶🐰'], ['Con gì cổ dài nhất?', '🦒', '🐘🐢🐍'], ['Con gì đi đâu cũng cõng nhà trên lưng?', '🐌', '🐜🐝🐛'],
    ['Con gì chăm chỉ đi hút mật hoa?', '🐝', '🐜🦋🐞'], ['Con gì bơi dưới nước, có vây, có đuôi?', '🐟', '🐦🐸🐢'], ['Con gì có túi trước bụng, nhảy rất xa?', '🦘', '🐰🐒🐿️'],
    ['Con gì không bay được, sống ở nơi băng tuyết?', '🐧', '🦅🦆🐓']
  ],
  [
    ['Cái gì che mưa, che nắng cho bé?', '☂️', '👟🎩📖'], ['Cái gì có kim mà không khâu được, kêu tích tắc?', '⏰', '✂️📏🔑'], ['Xe gì kêu ò e, đi chữa cháy?', '🚒', '🚌🚲🚕'],
    ['Cái gì tròn tròn, bé đá vào khung thành?', '⚽', '🎈🍊🥚'], ['Ban đêm cái gì sáng tròn trên trời?', '🌕', '☀️⭐☁️'], ['Cái gì bé dùng để đọc truyện?', '📖', '🥄🔑🧦'],
    ['Cái gì bay trên trời, chở nhiều người?', '✈️', '🚗🚢🚲'], ['Cái gì bé đi vào chân trước khi ra đường?', '👟', '🧤🎩👓'], ['Cái gì dùng để mở khoá cửa?', '🔑', '✏️🥄📏'],
    ['Cái gì bé dùng để viết và vẽ?', '✏️', '🥄🔑🧦']
  ],
  [
    ['Quả gì màu vàng, khỉ rất thích ăn?', '🍌', '🍎🍇🍉'], ['Quả gì vỏ xanh, ruột đỏ, hạt đen?', '🍉', '🍊🍋🍐'], ['Quả gì có rất nhiều mắt?', '🍍', '🍎🍌🍒'],
    ['Quả gì chua chua, màu vàng, pha nước rất ngon?', '🍋', '🍓🍇🍑'], ['Củ gì màu cam, thỏ rất thích?', '🥕', '🌽🍆🥔'], ['Mặc gì khi trời mưa để không bị ướt?', '🧥', '👙🩳👕'],
    ['Trời nắng nóng, bé ăn gì cho mát?', '🍦', '🍜🍞🌶️'], ['Sáng dậy, cái gì mọc ở đằng đông?', '☀️', '🌙⭐🌈'], ['Sau cơn mưa, cái gì bảy màu hiện trên trời?', '🌈', '☁️⚡❄️'],
    ['Con gì kêu ộp ộp khi trời mưa?', '🐸', '🐦🐍🐢']
  ]
// tách chuỗi nhiễu thành từng emoji; thêm lại U+FE0F để ☀ ☁ ✏… luôn hiện dạng hình màu
].map(set => set.map(([q, a, d]) => ({ q, a, d: Array.from(d.replace(/️/g, '')).map(x => x + '️') })));
const GROUPS = {
  animal: ['🐶', '🐱', '🐷', '🐄', '🐘', '🐵', '🐰', '🐔'], fruit: ['🍎', '🍌', '🍇', '🍉', '🍓', '🍊', '🍍', '🍐'],
  vehicle: ['🚗', '🚌', '🚲', '✈️', '🚂', '🚀', '🚒', '🚢'], clothes: ['👕', '👖', '👗', '🧦', '🧢', '👟', '🧥', '🧤']
};

/* ---------- Hàm dựng câu hỏi ---------- */
const big = (h, cls = '') => `<span class="big ${cls}">${h}</span>`;
const ltr = h => `<span class="ltr">${h}</span>`;
const group = (e, n) => `<div class="group">${Array(n).fill(`<i>${e}</i>`).join('')}</div>`;

function pickRounds(pool, n, optN, mk) {
  return U.sample(pool, Math.min(n, pool.length)).map(it => {
    const opts = U.shuffle([it, ...U.sample(pool.filter(x => x !== it), optN - 1)]);
    return Object.assign(mk(it, opts), { ans: opts.indexOf(it) });
  });
}
function numOpts(ans, min, max, n = 3) {
  const s = new Set([ans]); let guard = 0;
  while (s.size < n && guard++ < 60) { const v = ans + U.rnd(-2, 2); if (v >= min && v <= max) s.add(v); }
  for (let v = min; s.size < n; v++) s.add(v);
  const arr = U.shuffle([...s]);
  return { opts: arr.map(x => ltr(x)), ans: arr.indexOf(ans) };
}
const times = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/* Tiếng Việt */
const viLearn = (from, to) => () => VI.slice(from, to).map(l => ({
  big: ltr(`${U.up(l.c)} ${l.c}`), pic: l.e, sub: l.w, say: [[l.s, 'vi'], [l.w, 'vi']]
}));
const viListen = (from, to, n = 8) => () => pickRounds(VI.slice(from, to), n, 4, (l, opts) => ({
  say: [['Chữ ' + l.s, 'vi']], text: 'Nghe và chọn chữ đúng', show: '', opts: opts.map(o => ltr(o.c))
}));
const viPic = () => pickRounds(VI.filter(l => l.pic), 8, 3, (l, opts) => ({
  say: [[l.w + '.', 'vi'], [`Tiếng ${l.w} bắt đầu bằng chữ nào?`, 'vi']], text: `“${l.w}” bắt đầu bằng chữ nào?`, show: big(l.e), opts: opts.map(o => ltr(o.c))
}));
const viBalloon = () => U.sample(VI, 4).map(l => ({
  say: [['Bé hãy chọn bóng có chữ ' + l.s, 'vi']], text: 'Chọn bóng có chữ', target: l.c, others: U.sample(VI.filter(x => x !== l), 6).map(x => x.c)
}));
const viCase = () => U.sample(VI, 6).flatMap((l, i) => [
  { pid: i, h: ltr(U.up(l.c)), say: [[l.s, 'vi']] }, { pid: i, h: ltr(l.c), say: [[l.s, 'vi']] }
]);
const viToneLearn = () => TONES.map(t => ({ big: ltr(toneOf('ma', t.k)), pic: '', sub: t.n, say: [[t.n + '.', 'vi'], [toneOf('ma', t.k), 'vi']] }));
const viTone = () => times(8, () => {
  const base = U.pick(TONE_BASES), ks = U.sample([0, 1, 2, 3, 4, 5], 4), k = ks[0], opts = U.shuffle(ks);
  return { say: [[toneOf(base, k), 'vi']], text: 'Nghe và chọn tiếng đúng', show: '', opts: opts.map(x => ltr(toneOf(base, x))), ans: opts.indexOf(k) };
});
const viBuild1 = () => U.sample(SYL, 6).map(([p, v]) => {
  const lp = VI.find(l => l.c === p), w = p + v;
  return { say: [[`${lp.s}, ${v}, ${w}.`, 'vi'], ['Bé ghép tiếng ' + w, 'vi']], text: 'Ghép tiếng: ' + w, show: '', target: [p, v],
    extra: U.sample(VI.map(l => l.c).filter(c => c !== p && c !== v), 2), after: [[w, 'vi']] };
});
const viBuild2 = () => U.sample(VI_WORDS, 6).map(x => ({
  say: [[x.w + '.', 'vi'], ['Bé ghép chữ thành tiếng ' + x.w, 'vi']], text: 'Ghép thành: ' + x.w, show: big(x.e), target: x.t,
  extra: U.sample(VI.map(l => l.c).filter(c => !x.t.includes(c)), 2), after: [[x.w, 'vi']]
}));

/* Toán */
const mCount = (min, max) => () => times(8, () => {
  const it = U.pick(COUNTABLE), n = U.rnd(min, max), o = numOpts(n, Math.max(1, min - 1), max + 1);
  return { say: [[`Có bao nhiêu ${it.n}?`, 'vi']], text: `Có bao nhiêu ${it.n}?`, show: group(it.e, n), opts: o.opts, ans: o.ans };
});
const mListen = () => U.sample(times(10, i => i + 1), 8).map(n => {
  const o = numOpts(n, 1, 10, 4);
  return { say: [['Số ' + n, 'vi']], text: 'Nghe và chọn số đúng', show: '', opts: o.opts, ans: o.ans };
});
const mBalloon = () => U.sample(times(10, i => i + 1), 4).map(n => ({
  say: [['Bé hãy chọn bóng có số ' + n, 'vi']], text: 'Chọn bóng có số', target: String(n),
  others: U.sample(times(10, i => i + 1).filter(x => x !== n), 6).map(String)
}));
const mMore = () => times(8, () => {
  const it = U.pick(COUNTABLE), a = U.rnd(1, 8); let b = U.rnd(1, 8); if (b === a) b = a + 1;
  const less = Math.random() < 0.4, word = less ? 'ít hơn' : 'nhiều hơn';
  return { say: [[`Bên nào ${word}?`, 'vi']], text: `Bên nào ${word}?`, show: '', optCls: 'wide', opts: [group(it.e, a), group(it.e, b)], ans: (less ? a < b : a > b) ? 0 : 1 };
});
const mCompare = () => times(8, () => {
  const a = U.rnd(1, 10); let b = U.rnd(1, 10); if (b === a) b = a === 10 ? 9 : a + 1;
  const less = Math.random() < 0.5, word = less ? 'bé hơn' : 'lớn hơn';
  return { say: [[`Số nào ${word}?`, 'vi']], text: `Số nào ${word}?`, show: '', opts: [ltr(a), ltr(b)], ans: (less ? a < b : a > b) ? 0 : 1 };
});
const mNext = () => times(8, () => {
  const s = U.rnd(1, 7), o = numOpts(s + 3, 1, 12);
  return { say: [['Số nào đứng tiếp theo?', 'vi']], text: 'Số nào đứng tiếp theo?', show: `<div class="seq">${[s, s + 1, s + 2].map(x => `<b>${x}</b>`).join('')}<b class="q">?</b></div>`, opts: o.opts, ans: o.ans };
});
const mAdd = max => () => times(8, () => {
  const it = U.pick(COUNTABLE), a = U.rnd(1, max - 1), b = U.rnd(1, max - a), o = numOpts(a + b, 1, max + 1);
  return { say: [[`${a} cộng ${b} bằng mấy?`, 'vi']], text: `${a} + ${b} = ?`, show: `<div class="eq">${group(it.e, a)}<b>+</b>${group(it.e, b)}</div>`, opts: o.opts, ans: o.ans };
});
const mSub = max => () => times(8, () => {
  const it = U.pick(COUNTABLE), a = U.rnd(2, max), b = U.rnd(1, a - 1), o = numOpts(a - b, 0, max);
  const pics = Array(a).fill(0).map((_, i) => `<i class="${i >= a - b ? 'gone' : ''}">${it.e}</i>`).join('');
  return { say: [[`${a} trừ ${b} bằng mấy?`, 'vi']], text: `${a} − ${b} = ?`, show: `<div class="group">${pics}</div>`, opts: o.opts, ans: o.ans };
});
const mShape = () => times(8, () => {
  const opts = U.shuffle(SHAPES), cols = U.shuffle(SHAPE_COLORS), t = U.pick(opts);
  return { say: [[`Hình nào là ${t.n}?`, 'vi']], text: `Hình nào là ${t.n}?`, show: '', opts: opts.map((s, i) => `<svg class="shape" viewBox="0 0 100 100">${s.svg(cols[i])}</svg>`), ans: opts.indexOf(t) };
});
const mPattern = () => times(8, () => {
  const [A, B] = U.pick(PATTERN_SETS), C = U.pick(['🔺', '🎈', '🐟']);
  const unit = U.pick([[A, B], [A, A, B], [A, B, B], [A, B, C]]), len = unit.length * 2 + U.rnd(0, unit.length - 1);
  const seq = times(len, i => unit[i % unit.length]), ans = unit[len % unit.length], opts = U.shuffle([...new Set([A, B, C])]);
  return { say: [['Hình nào đứng tiếp theo?', 'vi']], text: 'Hình nào đứng tiếp theo?', show: `<div class="seq pat">${seq.map(x => `<b>${x}</b>`).join('')}<b class="q">?</b></div>`, opts: opts.map(x => big(x, 'sm')), ans: opts.indexOf(ans) };
});

/* Tiếng Anh */
const enAbcLearn = (from, to) => () => EN_ABC.slice(from, to).map(l => ({
  big: ltr(`${l.c} ${l.c.toLowerCase()}`), pic: l.e, sub: l.w, say: [[l.c, 'en'], [l.w, 'en']]
}));
const enAbcListen = (from, to) => () => pickRounds(EN_ABC.slice(from, to), 8, 4, (l, opts) => ({
  say: [[l.c, 'en']], text: 'Nghe và chọn chữ cái', show: '', opts: opts.map(o => ltr(o.c))
}));
const enAbcBalloon = () => U.sample(EN_ABC, 4).map(l => ({
  say: [['Bé hãy chọn bóng có chữ', 'vi'], [l.c, 'en']], text: 'Chọn bóng có chữ', target: l.c, others: U.sample(EN_ABC.filter(x => x !== l), 6).map(x => x.c)
}));
const enLearn = list => () => list.map(x => ({ big: '', pic: x.e, sub: `${x.w} – ${x.vi}`, say: [[x.w, 'en'], [x.vi, 'vi'], [x.w, 'en']] }));
const enListen = (list, n = 8) => () => pickRounds(list, n, 4, (x, opts) => ({
  say: [[x.w, 'en']], text: 'Nghe và chọn hình đúng', show: '', opts: opts.map(o => big(o.e, 'sm'))
}));
const enNumLearn = () => EN_NUM.map(x => ({ big: ltr(x.n), pic: '', sub: x.w, say: [[x.w, 'en']] }));
const enNumListen = () => pickRounds(EN_NUM, 8, 4, (x, opts) => ({ say: [[x.w, 'en']], text: 'Nghe và chọn số', show: '', opts: opts.map(o => ltr(o.n)) }));
const sw = c => `<span class="swatch" style="background:${c}"></span>`;
const enColorLearn = () => EN_COLORS.map(x => ({ big: sw(x.hex), pic: '', sub: `${x.w} – ${x.vi}`, say: [[x.w, 'en'], [x.vi, 'vi'], [x.w, 'en']] }));
const enColorListen = () => pickRounds(EN_COLORS, 8, 4, (x, opts) => ({ say: [[x.w, 'en']], text: 'Nghe và chọn màu', show: '', opts: opts.map(o => sw(o.hex)) }));
const enMemory = list => () => U.sample(list, 6).flatMap((x, i) => [
  { pid: i, h: big(x.e, 'sm'), say: [[x.w, 'en']] }, { pid: i, h: `<span class="word">${x.w}</span>`, say: [[x.w, 'en']] }
]);
const enSpell = list => () => U.sample(list, 6).map(x => {
  const t = x.w.split('');
  return { say: [[x.w, 'en']], text: 'Xếp chữ thành từ', show: big(x.e), target: t,
    extra: U.sample('abcdefghiklmnoprstuw'.split('').filter(c => !t.includes(c)), 2), after: [[t.join(', ') + '.', 'en'], [x.w, 'en']] };
});

/* Câu đố */
const riddle = i => () => U.sample(RIDDLES[i], 8).map(r => {
  const opts = U.shuffle([r.a, ...r.d.slice(0, 3)]);
  return { say: [[r.q, 'vi']], text: r.q, show: big('🤔', 'sm'), opts: opts.map(x => big(x, 'sm')), ans: opts.indexOf(r.a) };
});
const oddOne = () => times(8, () => {
  const [g1, g2] = U.sample(Object.keys(GROUPS), 2), odd = U.pick(GROUPS[g2]), opts = U.shuffle([...U.sample(GROUPS[g1], 3), odd]);
  return { say: [['Hình nào khác với các hình còn lại?', 'vi']], text: 'Hình nào khác loại?', show: '', opts: opts.map(x => big(x, 'sm')), ans: opts.indexOf(odd) };
});
const picMemory = () => U.sample([...GROUPS.animal, ...GROUPS.fruit, ...GROUPS.vehicle], 6).flatMap((e, i) => [
  { pid: i, h: big(e, 'sm'), say: [] }, { pid: i, h: big(e, 'sm'), say: [] }
]);

/* ---------- Danh sách môn & bài ---------- */
const L = (id, icon, title, type, make) => ({ id, icon, title, type, make });

const SUBJECTS = [
  {
    id: 'vi', title: 'Tiếng Việt', icon: '📖', color: '#ff7a59', hello: 'Học chữ cái và ghép vần',
    lessons: [
      L('vi-learn1', '🔤', 'Chữ cái: a → g', 'learn', viLearn(0, 10)),
      L('vi-listen1', '👂', 'Nghe âm chọn chữ 1', 'choice', viListen(0, 10)),
      L('vi-learn2', '🔤', 'Chữ cái: h → p', 'learn', viLearn(10, 20)),
      L('vi-listen2', '👂', 'Nghe âm chọn chữ 2', 'choice', viListen(10, 20)),
      L('vi-learn3', '🔤', 'Chữ cái: q → y', 'learn', viLearn(20, 29)),
      L('vi-listen3', '👂', 'Nghe âm chọn chữ 3', 'choice', viListen(0, 29, 10)),
      L('vi-balloon', '🎈', 'Bóng bay chữ cái', 'balloon', viBalloon),
      L('vi-pic', '🖼️', 'Chữ đầu của hình', 'choice', viPic),
      L('vi-case', '🃏', 'Chữ hoa – chữ thường', 'memory', viCase),
      L('vi-tone1', '🎵', 'Làm quen 6 thanh', 'learn', viToneLearn),
      L('vi-tone2', '🎶', 'Nghe thanh chọn tiếng', 'choice', viTone),
      L('vi-build1', '🧩', 'Ghép vần', 'build', viBuild1),
      L('vi-build2', '🧱', 'Ghép tiếng có hình', 'build', viBuild2)
    ]
  },
  {
    id: 'math', title: 'Toán', icon: '🔢', color: '#3aa6ff', hello: 'Đếm số, cộng trừ, hình khối',
    lessons: [
      L('m-count5', '🖐️', 'Đếm đến 5', 'choice', mCount(1, 5)),
      L('m-count10', '🔟', 'Đếm đến 10', 'choice', mCount(4, 10)),
      L('m-listen', '👂', 'Nghe số chọn số', 'choice', mListen),
      L('m-balloon', '🎈', 'Bóng bay số', 'balloon', mBalloon),
      L('m-more', '⚖️', 'Nhiều hơn – ít hơn', 'choice', mMore),
      L('m-compare', '🐊', 'Số lớn – số bé', 'choice', mCompare),
      L('m-next', '➡️', 'Số tiếp theo', 'choice', mNext),
      L('m-add5', '➕', 'Cộng trong phạm vi 5', 'choice', mAdd(5)),
      L('m-sub5', '➖', 'Trừ trong phạm vi 5', 'choice', mSub(5)),
      L('m-shape', '🔺', 'Hình khối', 'choice', mShape),
      L('m-pattern', '🧠', 'Tìm quy luật', 'choice', mPattern),
      L('m-add10', '➕', 'Cộng trong phạm vi 10', 'choice', mAdd(10)),
      L('m-sub10', '➖', 'Trừ trong phạm vi 10', 'choice', mSub(10)),
      L('m-count20', '🏆', 'Thử thách: đếm đến 20', 'choice', mCount(11, 20))
    ]
  },
  {
    id: 'en', title: 'Tiếng Anh', icon: '🌍', color: '#7c5cff', hello: 'ABC, số đếm, màu sắc, con vật',
    lessons: [
      L('en-abc1', '🔠', 'ABC: A → I', 'learn', enAbcLearn(0, 9)),
      L('en-abcl1', '👂', 'Nghe chọn chữ A → I', 'choice', enAbcListen(0, 9)),
      L('en-abc2', '🔠', 'ABC: J → R', 'learn', enAbcLearn(9, 18)),
      L('en-abc3', '🔠', 'ABC: S → Z', 'learn', enAbcLearn(18, 26)),
      L('en-abcl2', '👂', 'Nghe chọn chữ A → Z', 'choice', enAbcListen(0, 26)),
      L('en-balloon', '🎈', 'Bóng bay ABC', 'balloon', enAbcBalloon),
      L('en-num1', '🔢', 'Số đếm 1 → 10', 'learn', enNumLearn),
      L('en-num2', '👂', 'Nghe chọn số', 'choice', enNumListen),
      L('en-col1', '🎨', 'Màu sắc', 'learn', enColorLearn),
      L('en-col2', '👂', 'Nghe chọn màu', 'choice', enColorListen),
      L('en-ani1', '🐶', 'Con vật', 'learn', enLearn(EN_ANIMALS)),
      L('en-ani2', '👂', 'Nghe chọn con vật', 'choice', enListen(EN_ANIMALS)),
      L('en-ani3', '🃏', 'Lật thẻ con vật', 'memory', enMemory(EN_ANIMALS)),
      L('en-fru1', '🍎', 'Trái cây', 'learn', enLearn(EN_FRUITS)),
      L('en-fru2', '👂', 'Nghe chọn trái cây', 'choice', enListen(EN_FRUITS)),
      L('en-fam1', '👨‍👩‍👧', 'Gia đình', 'learn', enLearn(EN_FAMILY)),
      L('en-fam2', '👂', 'Nghe chọn người thân', 'choice', enListen(EN_FAMILY, 7)),
      L('en-thi1', '🏠', 'Đồ vật quanh bé', 'learn', enLearn(EN_THINGS)),
      L('en-thi2', '👂', 'Nghe chọn đồ vật', 'choice', enListen(EN_THINGS)),
      L('en-spell3', '🧩', 'Xếp chữ: từ 3 chữ', 'build', enSpell(EN_SPELL3)),
      L('en-spell4', '🧱', 'Xếp chữ: từ 4 chữ', 'build', enSpell(EN_SPELL4))
    ]
  },
  {
    id: 'fun', title: 'Câu đố vui', icon: '🎲', color: '#20c997', hello: 'Đố vui và trò chơi trí nhớ',
    lessons: [
      L('f-rid1', '🐾', 'Đố bé con gì?', 'choice', riddle(0)),
      L('f-odd', '🔍', 'Tìm hình khác loại', 'choice', oddOne),
      L('f-rid2', '🎁', 'Đố bé cái gì?', 'choice', riddle(1)),
      L('f-mem', '🃏', 'Lật thẻ trí nhớ', 'memory', picMemory),
      L('f-rid3', '🌈', 'Đố vui quanh em', 'choice', riddle(2))
    ]
  }
];

const STICKERS = Array.from('🦄🐼🦊🐯🐨🐸🐵🦁🐰🐶🐱🐧🐬🦋🐢🐙🦖🐳🦉🐝🌈⭐🌙🌻🍓🍉🍦🍩🍭🎂🚀🚂🚁🚒🏰🎠🎡🎨🎸🎺⚽🏀🎯🪁🧸👑💎🎁🏆🥇🎈🎉🌟🍀🌺');
