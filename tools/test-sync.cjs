// Thử hàm api/sync.js và phần gộp js/merge.js với một Redis giả trong bộ nhớ (không cần mạng).
//   node tools/test-sync.cjs
const assert = require('node:assert');
process.env.KV_REST_API_URL = 'http://fake';
process.env.KV_REST_API_TOKEN = 'x';

const kv = new Map(), counters = new Map();
const run = ([cmd, key, ...a]) => {
  switch (cmd) {
    case 'INCR': counters.set(key, (counters.get(key) || 0) + 1); return counters.get(key);
    case 'EXPIRE': return 1;
    case 'GET': return kv.has(key) ? kv.get(key) : null;
    case 'SET': kv.set(key, a[0]); return 'OK';
    default: throw new Error('lệnh chưa giả lập: ' + cmd);
  }
};
global.fetch = async (url, opt) => ({ ok: true, json: async () => JSON.parse(opt.body).map(c => ({ result: run(c) })) });

const { merge } = require('../js/merge.js');
const handler = require('../api/sync.js');
const call = async (body, method = 'POST') => {
  const res = { code: 0, body: null, setHeader() { }, status(c) { this.code = c; return this; }, json(j) { this.body = j; return this; } };
  await handler({ method, body, headers: { 'x-forwarded-for': '1.2.3.4' } }, res);
  return res;
};
const kid = (id, o = {}) => ({ id, name: 'Su', avatar: '🐰', pub: true, u: 1, ep: 0, stars: {}, scores: {}, plays: {}, stickers: [], ...o });

(async () => {
  // --- gộp ---
  const a = { kids: [kid('su0000001', { scores: { 'vi-learn1': 7, 'ma-1': 10 }, stars: { 'vi-learn1': 2 }, plays: { 'vi-learn1': 3 }, stickers: ['🦄'] })], gone: [] };
  const b = { kids: [kid('su0000001', { name: 'Su Su', u: 5, scores: { 'vi-learn1': 9, 'en-1': 6 }, plays: { 'vi-learn1': 1 }, stickers: ['🐼'] }), kid('tho000001', { name: 'Thỏ' })], gone: [] };
  let m = merge(a, b);
  assert.equal(m.kids.length, 2);
  assert.equal(m.kids[0].name, 'Su Su', 'tên sửa sau thắng');
  assert.deepEqual(m.kids[0].scores, { 'vi-learn1': 9, 'ma-1': 10, 'en-1': 6 }, 'lấy điểm cao nhất từng bài');
  assert.deepEqual(m.kids[0].plays, { 'vi-learn1': 3 });
  assert.deepEqual(m.kids[0].stickers, ['🦄', '🐼']);
  assert.deepEqual(merge(b, a).kids.find(k => k.id === 'su0000001').scores, m.kids[0].scores, 'gộp không phụ thuộc thứ tự');
  // xoá tiến độ (ep tăng) thắng điểm cũ ở máy khác
  m = merge(m, { kids: [kid('su0000001', { ep: 1, scores: { 'ma-1': 4 } })], gone: [] });
  assert.deepEqual(m.kids[0].scores, { 'ma-1': 4 });
  assert.equal(m.kids[0].name, 'Su Su');
  // xoá hồ sơ ở một máy thì máy khác cũng mất
  m = merge(m, { kids: [], gone: ['tho000001'] });
  assert.deepEqual(m.kids.map(k => k.id), ['su0000001']);
  assert.ok(m.gone.includes('tho000001'));
  // dữ liệu bẩn bị lọc
  m = merge({}, { kids: [{ id: 'BAD ID' }, kid('x00000001', { name: '<b>quá dài quá dài quá dài</b>', scores: { 'a': 99, 'b c': 5, 'd': -1 } })] });
  assert.equal(m.kids.length, 1);
  assert.ok(!/[<>]/.test(m.kids[0].name) && m.kids[0].name.length <= 20);
  assert.deepEqual(m.kids[0].scores, { a: 10 });

  // --- api ---
  assert.equal((await call({}, 'GET')).code, 405);
  assert.equal((await call({ code: 'ngắn', data: a })).code, 400);
  let r = await call({ code: 'ABCDE-23456', join: true, data: { kids: [] } });
  assert.deepEqual([r.code, r.body.isNew, kv.size], [200, true, 0], 'nhập mã chưa có thì không tạo gia đình');
  r = await call({ code: 'ABCDE-23456', data: a });                    // máy 1 tạo mã, đẩy hồ sơ lên
  assert.deepEqual([r.code, r.body.isNew], [200, true]);
  r = await call({ code: 'abcde23456', join: true, data: { kids: [] } }); // máy 2 nhập mã (chữ thường, bỏ gạch)
  assert.deepEqual([r.code, r.body.isNew, r.body.data.kids.length], [200, false, 1]);
  r = await call({ code: 'ABCDE23456', data: b });                      // máy 2 học thêm khi mất mạng rồi đẩy lên
  assert.deepEqual(r.body.data.kids.map(k => k.id), ['su0000001', 'tho000001']);
  assert.equal(r.body.data.kids[0].scores['vi-learn1'], 9);
  r = await call({ code: 'ABCDE23456', data: { kids: [], gone: [] } });  // máy 1 kéo về
  assert.equal(r.body.data.kids[0].scores['ma-1'], 10);
  assert.equal(kv.size, 1);
  // gọi dồn dập thì bị chặn
  let last; for (let i = 0; i < 70; i++) last = await call({ code: 'ABCDE23456', data: {} });
  assert.equal(last.code, 429);
  // chưa cấu hình kho thì báo 503
  delete require.cache[require.resolve('../api/sync.js')];
  delete process.env.KV_REST_API_URL;
  const hd = require('../api/sync.js'), res = { setHeader() { }, status(c) { this.code = c; return this; }, json() { return this; } };
  await hd({ method: 'POST', body: {}, headers: {} }, res);
  assert.equal(res.code, 503);
  console.log('api/sync.js + js/merge.js: tất cả phép thử đều đạt');
})().catch(e => { console.error(e); process.exit(1); });
