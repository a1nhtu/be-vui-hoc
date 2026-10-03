(() => {
  'use strict';
  const app = document.getElementById('app');
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Lưu tiến độ (ngay trên máy của bé) ---------- */
  const KEY = 'bevuihoc_v1';
  const AVATARS = ['🐰', '🐻', '🐱', '🐶', '🦊', '🐼', '🐯', '🦄', '🐸', '🐵'];
  // Mỗi bé một hồ sơ riêng: sao, điểm cao nhất, số lần chơi và sticker
  const newKid = (name, avatar) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, avatar, stars: {}, scores: {}, plays: {}, stickers: [] });
  const DEFAULTS = { kids: [], cur: '', limit: 20, voice: true, unlockAll: false };
  let S = { ...DEFAULTS };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    S = { ...DEFAULTS, ...raw };
    if (!Array.isArray(raw.kids)) {
      // Bản cũ chỉ lưu một bé: chuyển tiến độ sang hồ sơ đầu tiên, quy sao ra điểm
      S.kids = [];
      if (raw.name || Object.keys(raw.stars || {}).length) {
        const k = newKid(raw.name || '', '🐼');
        k.stars = raw.stars || {}; k.stickers = raw.stickers || [];
        for (const id in k.stars) { k.scores[id] = [0, 6, 8, 10][k.stars[id]] || 0; k.plays[id] = 1; }
        S.kids = [k]; S.cur = k.id;
      }
      delete S.stars; delete S.stickers; delete S.name;
    }
  } catch (e) { /* chế độ riêng tư: chơi không lưu */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } };
  const GUEST = newKid('', '🐼');
  const K = () => S.kids.find(k => k.id === S.cur) || S.kids[0] || GUEST;
  const kid = () => K().name.trim() || 'bé';

  /* ---------- Giọng đọc & âm thanh ---------- */
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { loadVoices(); synth.addEventListener && synth.addEventListener('voiceschanged', loadVoices); }
  const findVoice = lang => voices.find(v => v.lang.replace('_', '-') === lang) || voices.find(v => v.lang.slice(0, 2) === lang.slice(0, 2));
  // Phát file mp3 thu sẵn (Việt: HoaiMy, Anh: Jenny); câu nào chưa có file thì dùng giọng của máy.
  const hasClip = (text, l) => typeof AUDIO !== 'undefined' && !!AUDIO[l] && AUDIO[l].has(audioKey(text));
  const player = new Audio(), clips = new Map();
  let speakId = 0;
  // Tải mp3 bằng fetch để bản lưu ngoại tuyến dùng được trên mọi trình duyệt
  const clipUrl = (text, l) => {
    const path = `audio/${l}/${audioKey(text)}.mp3`;
    if (!clips.has(path)) clips.set(path, fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b => URL.createObjectURL(b)));
    return clips.get(path);
  };
  function tts(text, l, next) {
    if (!synth) return next();
    const lang = l === 'en' ? 'en-US' : 'vi-VN', u = new SpeechSynthesisUtterance(text), v = findVoice(lang);
    u.lang = lang; if (v) u.voice = v;
    u.rate = l === 'en' ? 0.8 : 0.9; u.pitch = 1.1;
    u.onend = u.onerror = next;
    synth.speak(u);
  }
  function stopSpeak() { speakId++; player.pause(); synth && synth.cancel(); }
  // done: gọi khi đọc xong cả chuỗi (không gọi nếu bị câu khác chen ngang)
  function speak(items, done) {
    if (!S.voice || !items || !items.length) { if (done) later(done, 900); return; }
    stopSpeak();
    const my = speakId;
    const run = k => {
      if (my !== speakId) return;
      if (k >= items.length) { if (done) done(); return; }
      const [text, l] = items[k];
      let moved = false;
      const step = fn => () => { if (moved || my !== speakId) return; moved = true; fn(); };
      const next = step(() => run(k + 1));
      if (!hasClip(text, l)) return tts(text, l, next);
      const fallback = step(() => tts(text, l, () => run(k + 1)));
      clipUrl(text, l).then(url => {
        if (my !== speakId) return;
        player.onended = next; player.onerror = fallback;
        player.src = url;
        return player.play();
      }).catch(fallback);
    };
    run(0);
  }
  // iOS chỉ cho phát tiếng sau khi người dùng chạm: mở khoá trình phát ở lần chạm đầu
  document.addEventListener('pointerdown', () => {
    if (!S.voice) return;
    player.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    player.play().catch(() => { });
  }, { once: true });
  let ac;
  function tone(freq, dur, when = 0, type = 'sine', vol = 0.14) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* máy không có âm thanh */ }
  }
  const sfx = {
    ok() { tone(660, 0.12); tone(880, 0.2, 0.11); },
    no() { tone(210, 0.22, 0, 'triangle'); },
    pop() { tone(520, 0.08, 0, 'square', 0.07); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, i * 0.14)); }
  };
  // Đọc xong mới sang bước kế, để câu khen không bị câu hỏi mới cắt ngang; max là thời gian chờ tối đa.
  function sayThen(items, fn, max = 6000) {
    let gone = false;
    const once = () => { if (gone) return; gone = true; fn(); };
    speak(items, () => later(once, 300));
    later(once, max);
  }
  const praiseThen = fn => sayThen([[U.pick(SAY.praise), 'vi']], fn);
  const retry = () => speak([[U.pick(SAY.retry), 'vi']]);

  /* ---------- Tiến độ ---------- */
  const starsOf = (id, k = K()) => k.stars[id] || 0;
  const subjectStars = (s, k = K()) => s.lessons.reduce((a, l) => a + starsOf(l.id, k), 0);
  const totalStars = (k = K()) => SUBJECTS.reduce((a, s) => a + subjectStars(s, k), 0);
  // Điểm mỗi bài theo thang 10: mỗi lần chọn sai trừ 1 điểm, thấp nhất 1 điểm. Tổng điểm = cộng điểm cao nhất của từng bài.
  const scoreFor = mistakes => Math.max(1, 10 - mistakes);
  const scoreOf = (id, k = K()) => k.scores[id] || 0;
  const subjectScore = (s, k = K()) => s.lessons.reduce((a, l) => a + scoreOf(l.id, k), 0);
  const totalScore = (k = K()) => SUBJECTS.reduce((a, s) => a + subjectScore(s, k), 0);
  const LESSON_COUNT = SUBJECTS.reduce((a, s) => a + s.lessons.length, 0);
  const unlocked = (s, i) => S.unlockAll || i === 0 || starsOf(s.lessons[i - 1].id) > 0;
  const starRow = n => '<span class="stars">' + [1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('') + '</span>';

  /* ---------- Màn hình chính ---------- */
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  function clearScreen() { timers.forEach(clearTimeout); timers = []; stopSpeak(); }

  function home() {
    if (!S.kids.length) return kidForm(true);
    clearScreen();
    document.body.style.setProperty('--accent', '#ffb703');
    app.innerHTML = `
      <header class="hero">
        <button class="mascot" id="mascot" aria-label="Bạn Gấu Trúc chào bé">🐼</button>
        <div><h1>Chào ${esc(kid())}!</h1><p>Hôm nay mình học gì nào?</p></div>
        <div class="total" aria-label="Tổng số sao">★ ${totalStars()}</div>
      </header>
      <div class="kidbar">
        <button class="chip" id="kid" aria-label="Đổi bé"><span class="av">${K().avatar}</span> ${esc(kid())} <small>Đổi bé ▾</small></button>
        <span class="chip score" aria-label="Tổng điểm">🏅 ${totalScore()} điểm</span>
      </div>
      <main class="subjects">
        ${SUBJECTS.map(s => `
          <button class="subject" data-s="${s.id}" style="--c:${s.color}">
            <span class="s-icon">${s.icon}</span>
            <span class="s-title">${s.title}</span>
            <span class="s-hello">${s.hello}</span>
            <span class="s-prog">★ ${subjectStars(s)} / ${s.lessons.length * 3}</span>
          </button>`).join('')}
      </main>
      <footer class="dock">
        <button class="btn ghost" id="stickers">🎁 Sticker của bé (${K().stickers.length})</button>
        <button class="btn ghost" id="parent">👨‍👩‍👧 Góc bố mẹ</button>
      </footer>
      <figure class="family"><img id="family" src="${FAMILY_PHOTO}" alt="Ảnh gia đình"><figcaption>${esc(CREDIT)}</figcaption></figure>`;
    // Ảnh chỉ hiện khi tải được; chưa có file ảnh thì chỉ còn dòng chữ
    $('#family').onload = e => e.target.classList.add('ok');
    $('#mascot').onclick = () => speak([[SAY.hello, 'vi']]);
    $('#kid').onclick = kids;
    $$('.subject').forEach(b => b.onclick = () => subject(b.dataset.s));
    $('#stickers').onclick = stickerBook;
    $('#parent').onclick = () => gate(parent);
  }

  // Chọn bé đang học
  function kids() {
    clearScreen();
    document.body.style.setProperty('--accent', '#ffb703');
    app.innerHTML = `
      <header class="bar"><button class="round" id="back" aria-label="Về trang chính">←</button><h2>Ai đang học nào?</h2><span></span></header>
      <main class="kids">
        ${S.kids.map(k => `<button class="kid ${k.id === K().id ? 'cur' : ''}" data-id="${k.id}">
          <span class="av">${k.avatar}</span><b>${esc(k.name.trim() || 'Bé')}</b><span>★ ${totalStars(k)} · 🏅 ${totalScore(k)} điểm</span>
        </button>`).join('')}
        <button class="kid add" id="add"><span class="av">＋</span><b>Thêm bé</b><span>Tạo hồ sơ mới</span></button>
      </main>`;
    $('#back').onclick = home;
    $$('.kid[data-id]').forEach(b => b.onclick = () => { S.cur = b.dataset.id; save(); home(); });
    $('#add').onclick = () => kidForm(false);
  }

  // Khai báo tên và hình đại diện của bé (lần mở đầu tiên hoặc khi thêm bé)
  function kidForm(first) {
    clearScreen();
    document.body.style.setProperty('--accent', '#ffb703');
    let avatar = AVATARS.find(a => !S.kids.some(k => k.avatar === a)) || AVATARS[0];
    app.innerHTML = `
      ${first ? '' : '<header class="bar"><button class="round" id="back" aria-label="Quay lại">←</button><h2>Thêm bé</h2><span></span></header>'}
      <main class="welcome">
        ${first ? '<div class="r-mascot">🐼</div><h1>Chào mừng đến với Bé Vui Học!</h1>' : ''}
        <label for="k-name">Bé tên là gì?</label>
        <input id="k-name" maxlength="20" placeholder="Ví dụ: Su" autocomplete="off">
        <p>Bé chọn một bạn đồng hành</p>
        <div class="avatars">${AVATARS.map(a => `<button class="avatar ${a === avatar ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
        <button class="btn big" id="k-ok">Bắt đầu học →</button>
      </main>`;
    if (!first) $('#back').onclick = kids;
    $$('.avatar').forEach(b => b.onclick = () => { avatar = b.dataset.a; $$('.avatar').forEach(x => x.classList.toggle('on', x === b)); });
    const ok = () => {
      const name = $('#k-name').value.trim();
      if (!name) { shake($('#k-name')); $('#k-name').focus(); return; }
      const k = newKid(name, avatar);
      S.kids.push(k); S.cur = k.id; save(); home();
    };
    $('#k-ok').onclick = ok;
    $('#k-name').onkeydown = e => { if (e.key === 'Enter') ok(); };
  }

  function subject(sid) {
    clearScreen();
    const s = SUBJECTS.find(x => x.id === sid);
    document.body.style.setProperty('--accent', s.color);
    app.innerHTML = `
      <header class="bar">
        <button class="round" id="back" aria-label="Về trang chính">←</button>
        <h2>${s.icon} ${s.title}</h2>
        <div class="total">★ ${subjectStars(s)}</div>
      </header>
      <main class="path">
        ${s.lessons.map((l, i) => {
          const open = unlocked(s, i);
          return `<button class="lesson ${open ? '' : 'locked'} ${i % 2 ? 'r' : 'l'}" data-i="${i}">
            <span class="l-icon">${open ? l.icon : '🔒'}</span>
            <span class="l-body"><b>${i + 1}. ${l.title}</b>${starRow(starsOf(l.id))}</span>
          </button>`;
        }).join('')}
      </main>`;
    $('#back').onclick = home;
    $$('.lesson').forEach(b => b.onclick = () => {
      const i = +b.dataset.i;
      if (!unlocked(s, i)) { sfx.no(); speak([[SAY.locked, 'vi']]); b.classList.add('shake'); later(() => b.classList.remove('shake'), 500); return; }
      play(s, i);
    });
  }

  /* ---------- Khung chơi chung ---------- */
  const RUN = { learn: runLearn, choice: runChoice, balloon: runBalloon, mole: runMole, memory: runMemory, build: runBuild, simon: runSimon };
  function play(s, i) {
    clearScreen();
    const l = s.lessons[i], ctx = { s, i, l, replay: null };
    document.body.style.setProperty('--accent', s.color);
    app.innerHTML = `
      <header class="bar">
        <button class="round" id="quit" aria-label="Thoát bài">✕</button>
        <div class="progress"><i id="prog"></i></div>
        <button class="round" id="again" aria-label="Nghe lại">🔊</button>
      </header>
      <main class="stage" id="stage"></main>`;
    $('#quit').onclick = () => subject(s.id);
    $('#again').onclick = () => ctx.replay && ctx.replay();
    ctx.stage = $('#stage');
    ctx.progress = p => { $('#prog').style.width = Math.round(p * 100) + '%'; };
    ctx.done = mistakes => finish(ctx, mistakes);
    RUN[l.type](ctx, l.make());
  }
  const shake = el => { el.classList.add('shake'); later(() => el.classList.remove('shake'), 500); };

  // Thẻ học: xem – nghe – bấm sang thẻ kế
  function runLearn(ctx, cards) {
    let i = 0;
    const show = () => {
      const c = cards[i];
      ctx.progress(i / cards.length);
      ctx.replay = () => speak(c.say);
      ctx.stage.innerHTML = `
        <button class="card" id="card">
          ${c.big ? `<span class="c-big">${c.big}</span>` : ''}
          ${c.pic ? `<span class="c-pic">${c.pic}</span>` : ''}
          <span class="c-sub">${c.sub}</span>
          <span class="c-tip">🔊 Bấm để nghe</span>
        </button>
        <div class="row">
          <button class="btn ghost" id="prev" ${i === 0 ? 'disabled' : ''}>← Trước</button>
          <button class="btn" id="next">${i === cards.length - 1 ? 'Xong ✓' : 'Tiếp →'}</button>
        </div>`;
      $('#card').onclick = ctx.replay;
      $('#prev').onclick = () => { i--; show(); };
      $('#next').onclick = () => { i++; if (i >= cards.length) ctx.done(0); else show(); };
      ctx.replay();
    };
    show();
  }

  // Câu hỏi chọn đáp án
  function runChoice(ctx, rounds) {
    let i = 0, mistakes = 0;
    const show = () => {
      if (i >= rounds.length) return ctx.done(mistakes);
      const r = rounds[i];
      ctx.progress(i / rounds.length);
      ctx.replay = () => speak(r.say);
      ctx.stage.innerHTML = `
        <p class="prompt">${r.text}</p>
        ${r.show ? `<div class="show">${r.show}</div>` : '<button class="listen" id="listen" aria-label="Nghe lại">🔊</button>'}
        <div class="opts n${r.opts.length} ${r.optCls || ''}">
          ${r.opts.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join('')}
        </div>`;
      const lis = $('#listen'); if (lis) lis.onclick = ctx.replay;
      $$('.opt').forEach(b => b.onclick = () => {
        if (+b.dataset.k === r.ans) {
          $$('.opt').forEach(x => x.disabled = true);
          b.classList.add('right'); sfx.ok();
          i++; praiseThen(show);
        } else {
          b.disabled = true; b.classList.add('wrong'); mistakes++; sfx.no(); retry();
        }
      });
      ctx.replay();
    };
    show();
  }

  // Bóng bay: chạm đúng 3 quả có chữ/số được gọi tên
  function runBalloon(ctx, rounds) {
    const NEED = 3, COLORS = ['#ff5a5f', '#3aa6ff', '#ffb703', '#20c997', '#9b5de5', '#f06292'];
    let i = 0, mistakes = 0;
    const show = () => {
      if (i >= rounds.length) return ctx.done(mistakes);
      const r = rounds[i]; let got = 0;
      ctx.progress(i / rounds.length);
      ctx.replay = () => speak(r.say);
      const labels = U.shuffle([...Array(NEED + 1).fill(r.target), ...r.others]);
      ctx.stage.innerHTML = `
        <p class="prompt">${r.text} <b class="ltr target">${r.target}</b> <span id="got">0/${NEED}</span></p>
        <div class="sky">
          ${labels.map((t, k) => `<button class="balloon" data-t="${esc(t)}" style="left:${4 + (k % 5) * 19 + U.rnd(-2, 2)}%;--bc:${COLORS[k % COLORS.length]};animation-duration:${U.rnd(70, 110) / 10}s;animation-delay:-${U.rnd(0, 90) / 10}s"><span class="ltr">${t}</span></button>`).join('')}
        </div>`;
      $$('.balloon').forEach(b => b.onclick = () => {
        if (b.dataset.t === r.target) {
          if (b.classList.contains('popped')) return;
          b.classList.add('popped'); sfx.pop(); got++;
          $('#got').textContent = `${got}/${NEED}`;
          if (got >= NEED) { sfx.ok(); i++; praiseThen(show); }
        } else { mistakes++; sfx.no(); shake(b); }
      });
      ctx.replay();
    };
    show();
  }

  // Đập chuột: chuột thò lên mang chữ/số, chạm đúng 3 con mang chữ được gọi tên
  function runMole(ctx, rounds) {
    const NEED = 3;
    let i = 0, mistakes = 0;
    const show = () => {
      if (i >= rounds.length) return ctx.done(mistakes);
      const r = rounds[i]; let got = 0, over = false;
      ctx.progress(i / rounds.length);
      ctx.replay = () => speak(r.say);
      ctx.stage.innerHTML = `
        <p class="prompt">${r.text} <b class="ltr target">${r.target}</b> <span id="got">0/${NEED}</span></p>
        <div class="holes">${'<button class="hole"><span class="mole ltr"></span></button>'.repeat(9)}</div>`;
      const holes = $$('.hole');
      const pop = () => {
        if (over) return;
        const h = U.pick(holes.filter(x => !x.classList.contains('up')));
        if (h) {
          h.dataset.t = Math.random() < 0.45 ? r.target : U.pick(r.others);
          $('.mole', h).textContent = h.dataset.t;
          h.classList.add('up');
          later(() => h.classList.remove('up', 'hit'), 2000);
        }
        later(pop, 900);
      };
      holes.forEach(h => h.onclick = () => {
        if (over || !h.classList.contains('up') || h.classList.contains('hit')) return;
        if (h.dataset.t === r.target) {
          h.classList.add('hit'); sfx.pop(); got++;
          $('#got').textContent = `${got}/${NEED}`;
          if (got >= NEED) { over = true; sfx.ok(); i++; praiseThen(show); }
        } else { mistakes++; sfx.no(); shake(h); }
      });
      ctx.replay(); later(pop, 1500);
    };
    show();
  }

  // Nhớ dãy màu: máy nháy một dãy ô, bé chạm lại đúng thứ tự
  function runSimon(ctx, lens) {
    const PADS = [['#ff5a5f', 330], ['#3aa6ff', 392], ['#ffb703', 494], ['#20c997', 587]];
    let i = 0, mistakes = 0, order = [], pos = 0, listening = false;
    ctx.replay = () => speak([[SAY.simon, 'vi']]);
    ctx.stage.innerHTML = `<p class="prompt">Nhớ dãy màu</p><p class="status" id="status">👀 Bé nhìn nhé</p>
      <div class="pads">${PADS.map(([c], k) => `<button class="pad" data-k="${k}" style="--pc:${c}" aria-label="Ô màu ${k + 1}"></button>`).join('')}</div>`;
    const pads = $$('.pad'), status = $('#status');
    const flash = k => { pads[k].classList.add('lit'); tone(PADS[k][1], 0.3); later(() => pads[k].classList.remove('lit'), 380); };
    const playSeq = () => {
      listening = false; status.textContent = '👀 Bé nhìn nhé';
      order.forEach((k, j) => later(() => flash(k), 700 + j * 700));
      later(() => { listening = true; pos = 0; status.textContent = '👉 Đến lượt bé'; }, 700 + order.length * 700);
    };
    const start = () => {
      if (i >= lens.length) return ctx.done(mistakes);
      ctx.progress(i / lens.length);
      order = Array.from({ length: lens[i] }, () => U.rnd(0, 3));
      playSeq();
    };
    pads.forEach(p => p.onclick = () => {
      if (!listening) return;
      const k = +p.dataset.k; flash(k);
      if (k === order[pos]) {
        if (++pos === order.length) { listening = false; status.textContent = '🎉 Đúng rồi!'; sfx.ok(); i++; later(start, 1100); }
      } else { listening = false; mistakes++; status.textContent = '🙈 Xem lại nhé'; sfx.no(); later(playSeq, 1000); }
    });
    sayThen([[SAY.simon, 'vi']], start, 8000);
  }

  // Lật thẻ tìm cặp
  function runMemory(ctx, cards) {
    cards = U.shuffle(cards);
    let first = null, lock = false, found = 0, misses = 0;
    ctx.replay = () => speak([[SAY.memory, 'vi']]);
    ctx.stage.innerHTML = `<p class="prompt">Lật thẻ tìm cặp</p>
      <div class="memory">${cards.map((c, k) => `<button class="mcard" data-k="${k}"><span class="back">❓</span><span class="face">${c.h}</span></button>`).join('')}</div>`;
    $$('.mcard').forEach(b => b.onclick = () => {
      if (lock || b.classList.contains('flip')) return;
      const c = cards[+b.dataset.k];
      b.classList.add('flip'); speak(c.say);
      if (!first) { first = b; return; }
      const a = first, ca = cards[+a.dataset.k]; first = null;
      if (ca.pid === c.pid) {
        a.classList.add('done'); b.classList.add('done'); sfx.ok(); found++;
        ctx.progress(found / (cards.length / 2));
        if (found === cards.length / 2) later(() => ctx.done(Math.floor(misses / 2)), 900);
      } else {
        lock = true; misses++;
        later(() => { a.classList.remove('flip'); b.classList.remove('flip'); lock = false; }, 1000);
      }
    });
    ctx.replay();
  }

  // Ghép chữ theo đúng thứ tự
  function runBuild(ctx, rounds) {
    let i = 0, mistakes = 0;
    const show = () => {
      if (i >= rounds.length) return ctx.done(mistakes);
      const r = rounds[i]; let pos = 0;
      ctx.progress(i / rounds.length);
      ctx.replay = () => speak(r.say);
      ctx.stage.innerHTML = `
        <p class="prompt">${r.text}</p>
        ${r.show ? `<div class="show">${r.show}</div>` : '<button class="listen" id="listen" aria-label="Nghe lại">🔊</button>'}
        <div class="slots">${r.target.map(() => '<span class="slot ltr"></span>').join('')}</div>
        <div class="tiles">${U.shuffle([...r.target, ...r.extra]).map(t => `<button class="tile ltr" data-t="${esc(t)}">${t}</button>`).join('')}</div>`;
      const lis = $('#listen'); if (lis) lis.onclick = ctx.replay;
      const slots = $$('.slot');
      $$('.tile').forEach(b => b.onclick = () => {
        if (b.dataset.t === r.target[pos]) {
          slots[pos].textContent = b.dataset.t; slots[pos].classList.add('filled');
          b.disabled = true; b.classList.add('used'); sfx.pop(); pos++;
          if (pos === r.target.length) {
            $$('.tile').forEach(x => x.disabled = true);
            sfx.ok(); i++; sayThen(r.after, show, 10000);
          }
        } else { mistakes++; sfx.no(); shake(b); }
      });
      ctx.replay();
    };
    show();
  }

  /* ---------- Kết thúc bài ---------- */
  function finish(ctx, mistakes) {
    clearScreen();
    const { s, i, l } = ctx, stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
    const k = K(), score = scoreFor(mistakes), best = Math.max(scoreOf(l.id), score), record = score > scoreOf(l.id) && !!scoreOf(l.id);
    const first = !starsOf(l.id);
    let sticker = '';
    if (first) {
      sticker = STICKERS.find(x => !k.stickers.includes(x)) || '';
      if (sticker) k.stickers.push(sticker);
    }
    k.stars[l.id] = Math.max(starsOf(l.id), stars);
    k.scores[l.id] = best; k.plays[l.id] = (k.plays[l.id] || 0) + 1;
    save();
    const hasNext = i + 1 < s.lessons.length;
    app.innerHTML = `
      <main class="result">
        <div class="confetti">${Array.from('🎉⭐🎈🌟🎊✨🎉⭐🎈🌟🎊✨').map((e, k) => `<i style="left:${k * 8 + 2}%;animation-delay:${(k % 5) * 0.25}s">${e}</i>`).join('')}</div>
        <div class="r-mascot">🐼</div>
        <h2>Hoan hô ${esc(kid())}!</h2>
        <div class="r-stars">${starRow(stars)}</div>
        <p class="r-score"><b>${score}</b>/10 điểm</p>
        <p class="r-total">${record ? 'Kỷ lục mới của bé! · ' : best > score ? `Điểm cao nhất bài này: ${best} · ` : ''}Tổng điểm: 🏅 ${totalScore()}</p>
        ${sticker ? `<p class="r-sticker">Bé nhận được sticker mới <b>${sticker}</b></p>` : ''}
        <div class="col">
          ${hasNext ? '<button class="btn big" id="next">Bài tiếp theo →</button>' : ''}
          <button class="btn ghost" id="replay">↻ Chơi lại</button>
          <button class="btn ghost" id="map">🗺️ Về bản đồ</button>
        </div>
      </main>`;
    sfx.win();
    speak([[SAY.done[stars - 1], 'vi']]);
    if (hasNext) $('#next').onclick = () => play(s, i + 1);
    $('#replay').onclick = () => play(s, i);
    $('#map').onclick = () => subject(s.id);
  }

  function stickerBook() {
    clearScreen();
    const total = LESSON_COUNT, got = K().stickers;
    app.innerHTML = `
      <header class="bar"><button class="round" id="back" aria-label="Về trang chính">←</button><h2>🎁 Sticker của ${esc(kid())}</h2><div class="total">${got.length}/${total}</div></header>
      <main class="book">
        ${Array.from({ length: total }, (_, k) => `<span class="st ${got[k] ? 'on' : ''}">${got[k] || '?'}</span>`).join('')}
      </main>
      <p class="note">Học xong mỗi bài mới, bé được thêm một sticker.</p>`;
    $('#back').onclick = home;
  }

  /* ---------- Góc bố mẹ ---------- */
  function modal(html) {
    const m = document.createElement('div');
    m.className = 'modal'; m.innerHTML = `<div class="sheet">${html}</div>`;
    document.body.appendChild(m);
    return m;
  }
  // Câu hỏi nhân để bé không tự vào phần cài đặt
  function gate(onPass, canCancel = true) {
    const a = U.rnd(3, 9), b = U.rnd(4, 9);
    const m = modal(`<h2>Dành cho bố mẹ</h2><p class="g-q">${a} × ${b} = ?</p>
      <input id="g-in" inputmode="numeric" autocomplete="off" aria-label="Kết quả">
      <div class="row">${canCancel ? '<button class="btn ghost" id="g-no">Huỷ</button>' : ''}<button class="btn" id="g-ok">Vào</button></div>`);
    const input = $('#g-in', m);
    const check = () => { if (+input.value === a * b) { m.remove(); onPass(); } else { input.value = ''; shake(input); } };
    $('#g-ok', m).onclick = check;
    input.onkeydown = e => { if (e.key === 'Enter') check(); };
    if (canCancel) $('#g-no', m).onclick = () => m.remove();
    input.focus();
  }

  function parent() {
    clearScreen();
    document.body.style.setProperty('--accent', '#5b6b7a');
    app.innerHTML = `
      <header class="bar"><button class="round" id="back" aria-label="Về trang chính">←</button><h2>Góc bố mẹ</h2><span></span></header>
      <main class="parent">
        <section>
          <h3>Cài đặt</h3>
          <label>Nhắc nghỉ mắt sau
            <select id="p-limit">${[10, 15, 20, 30, 0].map(v => `<option value="${v}" ${S.limit === v ? 'selected' : ''}>${v ? v + ' phút' : 'Không nhắc'}</option>`).join('')}</select>
          </label>
          <label class="check"><input type="checkbox" id="p-voice" ${S.voice ? 'checked' : ''}> Bật giọng đọc</label>
          <label class="check"><input type="checkbox" id="p-unlock" ${S.unlockAll ? 'checked' : ''}> Mở khoá tất cả bài học</label>
        </section>
        <section>
          <h3>Hồ sơ các bé</h3>
          ${S.kids.map(k => `<div class="k-row" data-id="${k.id}">
            <span class="av">${k.avatar}</span>
            <input class="k-name" maxlength="20" value="${esc(k.name)}" aria-label="Tên bé">
            <button class="btn danger sm k-del" aria-label="Xoá hồ sơ ${esc(k.name)}">Xoá</button>
          </div>`).join('')}
          <button class="btn ghost" id="k-add">＋ Thêm bé</button>
        </section>
        <section>
          <h3>Bảng điểm</h3>
          <p>Mỗi bài chấm theo thang 10: mỗi lần chọn sai trừ 1 điểm. Tổng điểm là cộng điểm cao nhất của từng bài (tối đa ${LESSON_COUNT * 10}).</p>
          <table class="rank">
            <tr><th>Bé</th><th>Bài đã học</th><th>Sao</th><th>Tổng điểm</th></tr>
            ${[...S.kids].sort((a, b) => totalScore(b) - totalScore(a)).map(k => `<tr class="${k.id === K().id ? 'cur' : ''}">
              <td>${k.avatar} ${esc(k.name.trim() || 'Bé')}</td><td>${Object.keys(k.scores).length}/${LESSON_COUNT}</td><td>★ ${totalStars(k)}</td><td><b>${totalScore(k)}</b></td></tr>`).join('')}
          </table>
          <h4>Điểm từng bài của ${esc(kid())}</h4>
          ${SUBJECTS.map(s => `<details>
            <summary>${s.icon} ${s.title} · ${s.lessons.filter(l => scoreOf(l.id)).length}/${s.lessons.length} bài · ${subjectScore(s)} điểm</summary>
            <table class="rank">
              <tr><th>Bài</th><th>Điểm cao nhất</th><th>Số lần học</th></tr>
              ${s.lessons.map((l, i) => `<tr><td>${i + 1}. ${l.title}</td><td>${scoreOf(l.id) ? `<b>${scoreOf(l.id)}</b>/10` : '–'}</td><td>${K().plays[l.id] || 0}</td></tr>`).join('')}
            </table>
          </details>`).join('')}
        </section>
        <section>
          <h3>Giọng đọc trên máy này</h3>
          <p>Tiếng Việt và tiếng Anh đều là <b>giọng thu sẵn</b>, máy nào cũng nghe giống nhau.</p>
          <div class="row"><button class="btn ghost" id="t-vi">Thử tiếng Việt</button><button class="btn ghost" id="t-en">Thử tiếng Anh</button></div>
        </section>
        <section>
          <h3>Tiến độ của ${esc(kid())}</h3>
          ${SUBJECTS.map(s => {
            const done = s.lessons.filter(l => starsOf(l.id)).length;
            return `<div class="p-row"><span>${s.icon} ${s.title}</span><span class="p-bar"><i style="width:${Math.round(done / s.lessons.length * 100)}%;background:${s.color}"></i></span><span>${done}/${s.lessons.length} bài · ★ ${subjectStars(s)}</span></div>`;
          }).join('')}
        </section>
        <section>
          <h3>Xoá tiến độ</h3>
          <p>Xoá toàn bộ sao, điểm và sticker của ${esc(kid())} trên máy này để học lại từ đầu.</p>
          <button class="btn danger" id="p-reset">Xoá tiến độ</button>
        </section>
      </main>`;
    $('#back').onclick = home;
    $$('.k-row').forEach(row => {
      const k = S.kids.find(x => x.id === row.dataset.id);
      $('.k-name', row).oninput = e => { k.name = e.target.value; save(); };
      $('.k-del', row).onclick = () => {
        const m = modal(`<h2>Xoá hồ sơ của ${esc(k.name.trim() || 'bé')}?</h2><p>Toàn bộ sao, điểm và sticker của bé sẽ mất, không khôi phục được.</p>
          <div class="row"><button class="btn ghost" id="d-no">Giữ lại</button><button class="btn danger" id="d-yes">Xoá</button></div>`);
        $('#d-no', m).onclick = () => m.remove();
        $('#d-yes', m).onclick = () => { S.kids = S.kids.filter(x => x !== k); if (S.cur === k.id) S.cur = S.kids[0] ? S.kids[0].id : ''; save(); m.remove(); S.kids.length ? parent() : home(); };
      };
    });
    $('#k-add').onclick = () => kidForm(false);
    $('#p-limit').onchange = e => { S.limit = +e.target.value; playedSec = 0; save(); };
    $('#p-voice').onchange = e => { S.voice = e.target.checked; save(); };
    $('#p-unlock').onchange = e => { S.unlockAll = e.target.checked; save(); };
    $('#t-vi').onclick = () => speak([[SAY.test, 'vi']]);
    $('#t-en').onclick = () => speak([[SAY_EN.test, 'en']]);
    $('#p-reset').onclick = () => {
      const m = modal(`<h2>Xoá tiến độ của ${esc(kid())}?</h2><p>Sao, điểm và sticker của bé sẽ mất, không khôi phục được.</p>
        <div class="row"><button class="btn ghost" id="r-no">Giữ lại</button><button class="btn danger" id="r-yes">Xoá</button></div>`);
      $('#r-no', m).onclick = () => m.remove();
      $('#r-yes', m).onclick = () => { Object.assign(K(), { stars: {}, scores: {}, plays: {}, stickers: [] }); save(); m.remove(); parent(); };
    };
  }

  /* ---------- Nhắc nghỉ mắt ---------- */
  let playedSec = 0, resting = false;
  setInterval(() => {
    if (document.hidden || resting || !S.limit) return;
    if (++playedSec < S.limit * 60) return;
    resting = true;
    speak([[SAY.rest, 'vi']]);
    const m = modal(`<div class="rest">😴</div><h2>Nghỉ mắt thôi nào!</h2><p>Bé đã học ${S.limit} phút rồi. Mình uống nước và nhìn ra xa một lát nhé.</p>
      <button class="btn" id="rest-go">Bố mẹ cho học tiếp</button>`);
    $('#rest-go', m).onclick = () => gate(() => { m.remove(); playedSec = 0; resting = false; });
  }, 1000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  home();
})();
