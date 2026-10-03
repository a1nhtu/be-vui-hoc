// Đồng bộ hồ sơ các bé giữa nhiều máy bằng "mã gia đình" (hàm serverless trên Vercel).
// Cùng kho Upstash Redis với api/rank.js:  bvh:fam:<mã> – JSON {kids, gone}
// Máy gửi bản của mình lên, máy chủ gộp với bản đang lưu (js/merge.js) rồi trả bản gộp về.
// Mã gia đình đóng vai trò mật khẩu: ai có mã thì đọc và sửa được hồ sơ của gia đình đó.
const { merge, clean } = require('../js/merge.js');
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PER_MINUTE = 60, MAX_BODY = 200000, KEEP_DAYS = 400;

async function redis(cmds) {
  const r = await fetch(REDIS_URL + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}
const parse = j => { try { return JSON.parse(j) || {}; } catch (e) { return {}; } };
// Mã gồm 10 ký tự chữ in hoa/số, có thể viết kèm dấu gạch hoặc cách
const famCode = c => { const s = String(c || '').toUpperCase().replace(/[\s-]/g, ''); return /^[A-Z0-9]{10}$/.test(s) ? s : ''; };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(503).json({ error: 'not_configured' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let b = req.body;
  if (typeof b === 'string') { if (b.length > MAX_BODY) return res.status(413).json({ error: 'too_big' }); b = parse(b); }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'body' });
  const code = famCode(b.code);
  if (!code) return res.status(400).json({ error: 'code' });

  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const [hits] = await redis([['INCR', 'bvh:rl:' + ip], ['EXPIRE', 'bvh:rl:' + ip, 60]]);
    if (hits > PER_MINUTE) return res.status(429).json({ error: 'slow_down' });

    const key = 'bvh:fam:' + code;
    const [stored] = await redis([['GET', key]]);
    // Máy mới xin nối vào gia đình: mã chưa tồn tại thì báo lại, không tạo gia đình mới vì gõ nhầm
    if (!stored && b.join) return res.status(200).json({ data: { kids: [], gone: [] }, isNew: true });
    const merged = merge(stored ? parse(stored) : {}, clean(b.data));
    const json = JSON.stringify(merged);
    if (json !== stored) await redis([['SET', key, json, 'EX', KEEP_DAYS * 86400]]);
    else await redis([['EXPIRE', key, KEEP_DAYS * 86400]]);
    return res.status(200).json({ data: merged, isNew: !stored });
  } catch (e) {
    return res.status(502).json({ error: 'storage' });
  }
};
