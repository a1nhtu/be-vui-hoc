// Gộp hồ sơ các bé giữa nhiều máy (dùng chung cho trình duyệt và hàm api/sync.js).
// Dữ liệu một gia đình: { kids: [hồ sơ bé], gone: [mã hồ sơ đã xoá] }
// Mỗi hồ sơ: { id, name, avatar, pub, u, ep, stars, scores, plays, stickers }
//   u  – thời điểm sửa tên/hình/lựa chọn bảng xếp hạng gần nhất: bản sửa sau thắng
//   ep – số lần "xoá tiến độ": bản có ep lớn hơn thắng phần tiến độ, bằng nhau thì gộp lấy cao nhất
(function (root) {
  'use strict';
  const MAX_KIDS = 12, MAX_GONE = 100, MAX_LESSONS = 400;
  const idOk = id => typeof id === 'string' && /^[a-z0-9]{8,24}$/.test(id);
  const keyOk = k => /^[a-z0-9_-]{1,40}$/i.test(k);
  const text = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').slice(0, max);
  const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const nums = (o, max) => {
    const out = {};
    if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, MAX_LESSONS)) if (keyOk(k) && int(o[k], max)) out[k] = int(o[k], max);
    return out;
  };

  // Làm sạch một hồ sơ nhận từ máy khác; hồ sơ hỏng trả về null
  function cleanKid(k) {
    if (!k || typeof k !== 'object' || !idOk(k.id)) return null;
    return {
      id: k.id,
      name: text(k.name, 20),
      avatar: text(k.avatar, 8) || '🐼',
      pub: k.pub !== false,
      u: int(k.u, 1e14),
      ep: int(k.ep, 1e6),
      stars: nums(k.stars, 3),
      scores: nums(k.scores, 10),
      plays: nums(k.plays, 1e6),
      stickers: Array.isArray(k.stickers) ? [...new Set(k.stickers.map(s => text(s, 8)).filter(Boolean))].slice(0, MAX_LESSONS) : []
    };
  }
  function clean(d) {
    d = d && typeof d === 'object' ? d : {};
    const gone = (Array.isArray(d.gone) ? d.gone : []).filter(idOk).slice(-MAX_GONE);
    const kids = (Array.isArray(d.kids) ? d.kids : []).map(cleanKid).filter(Boolean).slice(0, MAX_KIDS);
    return { kids, gone };
  }

  const maxMap = (a, b) => {
    const out = { ...a };
    for (const k in b) out[k] = Math.max(out[k] || 0, b[k]);
    return out;
  };
  function mergeKid(a, b) {
    const meta = (b.u || 0) > (a.u || 0) ? b : a;
    const out = { ...a, name: meta.name, avatar: meta.avatar, pub: meta.pub, u: meta.u };
    if ((a.ep || 0) !== (b.ep || 0)) {
      const p = (a.ep || 0) > (b.ep || 0) ? a : b;
      return { ...out, ep: p.ep, stars: { ...p.stars }, scores: { ...p.scores }, plays: { ...p.plays }, stickers: [...p.stickers] };
    }
    return {
      ...out,
      stars: maxMap(a.stars, b.stars),
      scores: maxMap(a.scores, b.scores),
      plays: maxMap(a.plays, b.plays),
      stickers: [...new Set([...a.stickers, ...b.stickers])]
    };
  }
  // Gộp hai bản dữ liệu; thứ tự các bé theo bản a, bé mới từ b nối vào sau
  function merge(a, b) {
    a = clean(a); b = clean(b);
    const gone = [...new Set([...a.gone, ...b.gone])].slice(-MAX_GONE);
    const byId = new Map();
    for (const k of [...a.kids, ...b.kids]) byId.set(k.id, byId.has(k.id) ? mergeKid(byId.get(k.id), k) : k);
    const kids = [...byId.values()].filter(k => !gone.includes(k.id)).slice(0, MAX_KIDS);
    return { kids, gone };
  }

  const api = { merge, clean, cleanKid, idOk, MAX_KIDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BVHMerge = api;
})(this);
