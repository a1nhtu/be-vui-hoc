// Thử hàm api/rank.js với một Redis giả trong bộ nhớ (không cần mạng).
//   node tools/test-rank.cjs
const assert = require('node:assert');
process.env.KV_REST_API_URL = 'http://fake';
process.env.KV_REST_API_TOKEN = 'x';

const z = new Map(), h = new Map(), counters = new Map();
const sorted = () => [...z.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
const run = ([cmd, key, ...a]) => {
  switch (cmd) {
    case 'INCR': counters.set(key, (counters.get(key) || 0) + 1); return counters.get(key);
    case 'EXPIRE': return 1;
    case 'ZSCORE': return z.has(a[0]) ? String(z.get(a[0])) : null;
    case 'ZCARD': return z.size;
    case 'ZADD': z.set(a[1], Number(a[0])); return 1;
    case 'ZREM': return z.delete(a[0]) ? 1 : 0;
    case 'HSET': h.set(a[0], a[1]); return 1;
    case 'HDEL': return h.delete(a[0]) ? 1 : 0;
    case 'HGET': return h.get(a[0]) ?? null;
    case 'HMGET': return a.map(id => h.get(id) ?? null);
    case 'ZREVRANGE': return sorted().slice(a[0], a[1] + 1).flatMap(([m, s]) => [m, String(s)]);
    case 'ZREVRANK': { const i = sorted().findIndex(([m]) => m === a[0]); return i < 0 ? null : i; }
    default: throw new Error('lệnh chưa giả lập: ' + cmd);
  }
};
global.fetch = async (url, opt) => ({ ok: true, json: async () => JSON.parse(opt.body).map(c => ({ result: run(c) })) });

const handler = require('../api/rank.js');
const call = async (body, method = 'POST') => {
  const res = { code: 0, body: null, setHeader() { }, status(c) { this.code = c; return this; }, json(j) { this.body = j; return this; } };
  await handler({ method, body, headers: { 'x-forwarded-for': '1.2.3.4' } }, res);
  return res;
};

(async () => {
  assert.equal((await call({}, 'GET')).code, 405);
  assert.equal((await call({ action: 'save', id: 'bad id', name: 'Su' })).code, 400);
  assert.equal((await call({ action: 'save', id: 'kid00000001', name: '   ' })).code, 400);
  for (let i = 1; i <= 55; i++) {
    const r = await call({ action: 'save', id: 'kid' + String(i).padStart(8, '0'), name: 'Bé ' + i, avatar: '🐰', score: i * 10, stars: i, lessons: i });
    assert.equal(r.code, 200);
  }
  await call({ action: 'save', id: 'kid00000003', name: '<b>Su</b>\u0007 tên rất dài quá hai mươi ký tự', avatar: '🐻', score: 999999, stars: -5, lessons: 'x' });
  let r = await call({ action: 'list', mine: ['kid00000003', 'kid00000002', 'khong-hop-le'] });
  assert.equal(r.code, 200);
  assert.equal(r.body.total, 55);
  assert.equal(r.body.top.length, 50);
  assert.deepEqual([r.body.top[0].rank, r.body.top[0].score, r.body.top[0].me], [1, 5000, true]);   // điểm bị chặn trần, là bé của mình
  assert.ok(!/[<>\u0007]/.test(r.body.top[0].name) && r.body.top[0].name.length <= 20);
  assert.equal(r.body.top[0].stars, 0);
  assert.equal(r.body.top[1].score, 550);
  assert.ok(r.body.top.every(x => !('id' in x)), 'không được lộ mã hồ sơ');
  assert.deepEqual(r.body.others.map(o => [o.rank, o.score, o.me]), [[54, 20, true]]);            // bé ngoài top vẫn biết hạng
  counters.clear();   // Redis giả không tự hết hạn bộ đếm
  assert.equal((await call({ action: 'remove', id: 'kid00000003' })).code, 200);
  r = await call({ action: 'list', mine: ['kid00000003'] });
  assert.equal(r.body.total, 54);
  assert.equal(r.body.others.length, 0);
  // gọi dồn dập thì bị chặn
  let last; for (let i = 0; i < 70; i++) last = await call({ action: 'list' });
  assert.equal(last.code, 429);
  // chưa cấu hình kho thì báo 503
  delete require.cache[require.resolve('../api/rank.js')];
  delete process.env.KV_REST_API_URL;
  assert.equal((await (async () => { const hd = require('../api/rank.js'); const res = { setHeader() { }, status(c) { this.code = c; return this; }, json() { return this; } }; await hd({ method: 'POST', body: {}, headers: {} }, res); return res; })()).code, 503);
  console.log('api/rank.js: tất cả phép thử đều đạt');
})().catch(e => { console.error(e); process.exit(1); });
