// Bảng xếp hạng chung của Bé Vui Học (hàm serverless trên Vercel).
// Dữ liệu nằm ở Upstash Redis, gọi qua REST. Vercel tự cấp biến môi trường khi kết nối kho Upstash với dự án.
//   bvh:rank  – sorted set: mã hồ sơ bé -> tổng điểm
//   bvh:kid   – hash: mã hồ sơ bé -> {n: tên, a: hình đại diện, s: sao, l: số bài}
// Mã hồ sơ do máy của bé tự sinh và đóng vai trò mật khẩu sửa điểm, nên không bao giờ trả về cho người khác.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TOP = 50, MAX_KIDS = 5000, MAX_SCORE = 5000, PER_MINUTE = 60;

async function redis(cmds) {
  const r = await fetch(REDIS_URL + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const idOk = id => typeof id === 'string' && /^[a-z0-9]{8,24}$/.test(id);
const parse = j => { try { return JSON.parse(j) || {}; } catch (e) { return {}; } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'not_configured' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let b = req.body;
  if (typeof b === 'string') b = parse(b);
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'body' });

  try {
    // Chặn gọi dồn dập từ một địa chỉ
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const [hits] = await redis([['INCR', 'bvh:rl:' + ip], ['EXPIRE', 'bvh:rl:' + ip, 60]]);
    if (hits > PER_MINUTE) return res.status(429).json({ error: 'slow_down' });

    if (b.action === 'save') {
      const name = clean(b.name, 20);
      if (!idOk(b.id) || !name) return res.status(400).json({ error: 'input' });
      const [known, count] = await redis([['ZSCORE', 'bvh:rank', b.id], ['ZCARD', 'bvh:rank']]);
      if (known === null && count >= MAX_KIDS) return res.status(507).json({ error: 'full' });
      const info = JSON.stringify({ n: name, a: clean(b.avatar, 8) || '🐼', s: int(b.stars, 1000), l: int(b.lessons, 500) });
      await redis([['ZADD', 'bvh:rank', int(b.score, MAX_SCORE), b.id], ['HSET', 'bvh:kid', b.id, info]]);
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'remove') {
      if (!idOk(b.id)) return res.status(400).json({ error: 'input' });
      await redis([['ZREM', 'bvh:rank', b.id], ['HDEL', 'bvh:kid', b.id]]);
      return res.status(200).json({ ok: true });
    }

    if (b.action === 'list') {
      const mine = (Array.isArray(b.mine) ? b.mine : []).filter(idOk).slice(0, 10);
      const [flat, total] = await redis([['ZREVRANGE', 'bvh:rank', 0, TOP - 1, 'WITHSCORES'], ['ZCARD', 'bvh:rank']]);
      const ids = [], scores = [];
      for (let i = 0; i < flat.length; i += 2) { ids.push(flat[i]); scores.push(Number(flat[i + 1])); }
      const row = (id, score, rank, infoJson) => {
        const i = parse(infoJson);
        return { rank, name: i.n || 'Bé', avatar: i.a || '🐼', stars: i.s || 0, lessons: i.l || 0, score, me: mine.includes(id) };
      };
      const infos = ids.length ? (await redis([['HMGET', 'bvh:kid', ...ids]]))[0] : [];
      const top = ids.map((id, k) => row(id, scores[k], k + 1, infos[k]));
      // Bé của máy đang hỏi mà chưa lọt top: trả thêm thứ hạng riêng
      const rest = mine.filter(id => !ids.includes(id));
      let others = [];
      if (rest.length) {
        const r = await redis(rest.flatMap(id => [['ZREVRANK', 'bvh:rank', id], ['ZSCORE', 'bvh:rank', id], ['HGET', 'bvh:kid', id]]));
        others = rest.map((id, k) => r[k * 3] === null ? null : row(id, Number(r[k * 3 + 1]), r[k * 3] + 1, r[k * 3 + 2])).filter(Boolean);
      }
      return res.status(200).json({ top, others, total });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    return res.status(502).json({ error: 'storage' });
  }
};
