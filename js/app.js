/* 在家練 戰情室：挑部位 → 跟著做；系列每日進度；自訂清單。狀態只存在本機 localStorage。 */
const PARTS = [
  { id: 'chest', icon: '🫁', name: '胸' }, { id: 'back', icon: '🔙', name: '背' }, { id: 'shoulders', icon: '🤷', name: '肩' },
  { id: 'arms', icon: '💪', name: '手臂' }, { id: 'lower', icon: '🦵', name: '臀腿' }, { id: 'core', icon: '🎯', name: '核心' }, { id: 'full', icon: '🔥', name: '全身' },
];
const L = {
  equip: { 'resistance-band': '彈力帶/繩', kettlebell: '壺鈴', dumbbell: '啞鈴', bodyweight: '徒手' },
  time: { t15: '15 分內', t30: '15–30 分', t45: '30 分以上' },
  inten: { low: '輕鬆', mid: '中等', high: '高強度' },
  level: { beginner: '初階', intermediate: '中階', advanced: '進階' },
};
const MUS = { chest: '胸', back: '背', shoulders: '肩', arms: '手臂', quads: '股四頭', hamstrings: '腿後', glutes: '臀', calves: '小腿', core: '核心' };
const hasPart = (v, p) => {
  const s = v.split || [], m = v.muscles || [];
  return { chest: m.includes('chest') || s.includes('push'), back: m.includes('back') || s.includes('pull'),
    shoulders: m.includes('shoulders'), arms: m.includes('arms'), core: s.includes('core') || m.includes('core'),
    lower: s.includes('lower') || s.includes('legs') || m.some(x => ['quads', 'hamstrings', 'glutes', 'calves'].includes(x)),
    full: s.includes('full-body') }[p];
};
const tb = d => (d <= 900 ? 't15' : d <= 1800 ? 't30' : 't45');
const ib = n => (n <= 2 ? 'low' : n === 3 ? 'mid' : 'high');

// ---------- 本機狀態 ----------
let S = { lists: [], done: {}, last: null, f: { parts: [], equip: [], time: [], inten: [], level: [] } };
try { S = { ...S, ...JSON.parse(localStorage.getItem('gym.v1') || '{}') }; } catch (e) {}
const save = () => { try { localStorage.setItem('gym.v1', JSON.stringify(S)); } catch (e) {} };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mins = s => Math.max(1, Math.round(s / 60));
const day = t => { const d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
function streak() {
  const days = new Set(Object.values(S.done).map(day)); let n = 0, t = new Date();
  if (!days.has(day(t))) t.setDate(t.getDate() - 1);
  while (days.has(day(t))) { n++; t.setDate(t.getDate() - 1); }
  return n;
}
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 1800); }

// ---------- 資料 ----------
let V = [], P = [], VM = {}; let ctx = [];
const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

// ---------- 卡片 ----------
function card(v, i) {
  const tags = (v.intensity ? [`<span class="tag int">強度 ${v.intensity}/5</span>`] : [])
    .concat((v.equipment || []).map(e => `<span class="tag">${esc(L.equip[e] || e)}</span>`),
      (v.muscles || []).slice(0, 3).map(m => `<span class="tag">${esc(MUS[m] || m)}</span>`));
  return `<div class="card"><button class="go" data-act="play" data-i="${i}">
    <div class="thumb"><img loading="lazy" alt="" src="${thumb(v.id)}"><span class="dur">${mins(v.duration)} 分</span>
    ${v.quality >= 88 ? '<span class="badge">精選</span>' : ''}${S.done[v.id] ? '<span class="done">✓ 完成</span>' : ''}</div>
    <div class="cbody"><div class="ctitle">${esc(v.title)}</div><div class="cmeta">${esc(v.channel)}</div>
    ${v.summaryZh ? `<div class="csum">${esc(v.summaryZh)}</div>` : ''}<div class="tags">${tags.join('')}</div></div></button>
    <button class="add" data-act="addlist" data-id="${v.id}" aria-label="加入清單">＋</button></div>`;
}
const chip = (k, v, label, on) => `<button class="chip" data-act="tf" data-k="${k}" data-v="${v}" aria-pressed="${on}">${esc(label)}</button>`;
const row = (name, k, map) => `<div class="row"><small>${name}</small>${Object.entries(map).map(([v, l]) => chip(k, v, l, S.f[k].includes(v))).join('')}</div>`;

function filtered(kind) {
  const f = S.f, any = (a, ok) => !a.length || ok;
  return V.filter(v => v.kind === kind
    && any(f.parts, f.parts.some(p => hasPart(v, p)))
    && any(f.equip, (v.equipment || []).some(e => f.equip.includes(e)))
    && any(f.time, f.time.includes(tb(v.duration)))
    && any(f.inten, v.intensity && f.inten.includes(ib(v.intensity)))
    && any(f.level, f.level.includes(v.level))).sort((a, b) => b.quality - a.quality);
}
const hasF = () => Object.values(S.f).some(a => a.length);

// ---------- 頁面 ----------
function home(kind) {
  const isGuide = kind === 'guide', rows = filtered(kind); ctx = rows.map(v => v.id);
  const nx = nextUp();
  return `<section class="hero"><h1>${isGuide ? '先把動作<em>學對</em>' : '今天想練<em>哪裡</em>？'}</h1>
    <p>${isGuide ? '姿勢、要領、常見錯誤。學會再去跟練，更安全也更有效。' : '點選想練的部位，挑出高品質、可以直接跟著做的影片。'}</p></section>
    ${!isGuide && nx ? nx : ''}
    <div class="parts">${PARTS.map(p => `<button class="part" data-act="tf" data-k="parts" data-v="${p.id}" aria-pressed="${S.f.parts.includes(p.id)}"><b>${p.icon}</b><span>${p.name}</span></button>`).join('')}</div>
    ${row('器材', 'equip', L.equip)}${isGuide ? '' : row('時間', 'time', L.time) + row('強度', 'inten', L.inten)}${row('程度', 'level', L.level)}
    <div class="bar"><h2>${rows.length ? `為你挑出 ${rows.length} 支` : '沒有符合的影片'}</h2>
      <span>${rows.length && !isGuide ? '<button class="btn primary" data-act="rand">🎲 隨機一支</button> ' : ''}${hasF() ? '<button class="btn" data-act="clear">清除</button>' : ''}</span></div>
    ${rows.length ? `<div class="grid">${rows.map(card).join('')}</div>` : '<p class="empty">放寬一點條件試試。</p>'}
    <p class="note">影片版權屬原頻道，本站僅以 YouTube 官方嵌入播放。分類由 AI 依標題、說明與章節整理，品質由觀看、讚率、頻道規模等數據把關。</p>`;
}

function nextUp() {
  const l = S.last; if (!l) return '';
  let title = '', cur = null;
  if (l.type === 'program') { const p = P.find(x => x.id === l.id); if (!p) return ''; const i = p.days.findIndex(d => !S.done[d.id]); if (i < 0) return ''; cur = p.days[i]; title = `${p.title}・第 ${i + 1} 天`; }
  else if (l.type === 'list') { const li = S.lists.find(x => x.id === l.id); if (!li) return ''; const i = li.ids.findIndex(id => !S.done[id]); if (i < 0) return ''; cur = VM[li.ids[i]]; title = `清單「${li.name}」`; }
  if (!cur) return '';
  return `<button class="continue" data-act="cont"><img alt="" src="${thumb(cur.id)}"><div><div class="k">繼續今天的訓練</div><div class="t">${esc(title)}</div><div class="k">${esc(cur.title)}</div></div></button>`;
}

function series() {
  return `<section class="hero"><h1>每天<em>跟著做</em></h1><p>多天課程，一天一支，照順序練完。系統記錄你練到第幾天。</p></section>
    ${P.length ? `<div class="grid">${P.map(p => { const d = p.days.filter(x => S.done[x.id]).length;
      return `<a class="card" href="#/series/${p.id}" style="text-decoration:none"><div class="thumb"><img loading="lazy" alt="" src="${thumb(p.days[0].id)}"><span class="badge">${p.days.length} 天</span></div>
      <div class="cbody"><div class="ctitle">${esc(p.title)}</div><div class="cmeta">${esc(p.channel)}</div>${p.summaryZh ? `<div class="csum">${esc(p.summaryZh)}</div>` : ''}
      <div class="tags">${(p.equipment || []).map(e => `<span class="tag">${esc(L.equip[e] || e)}</span>`).join('')}${p.intensity ? `<span class="tag int">強度 ${p.intensity}/5</span>` : ''}</div>
      <div class="prog"><i style="width:${Math.round(d / p.days.length * 100)}%"></i></div><div class="cmeta">${d ? `已完成 ${d} / ${p.days.length} 天` : '尚未開始'}</div></div></a>`; }).join('')}</div>` : '<p class="empty">還沒有通過品質把關的系列。</p>'}`;
}
function seriesDetail(id) {
  const p = P.find(x => x.id === id); if (!p) return '<p class="empty">找不到這個系列。</p>';
  const nxt = p.days.findIndex(d => !S.done[d.id]); ctx = p.days.map(d => d.id);
  return `<a class="back" href="#/series">← 所有系列</a><section class="hero"><h1>${esc(p.title)}</h1><p>${esc(p.channel)}・${p.days.length} 天${p.summaryZh ? '・' + esc(p.summaryZh) : ''}</p></section>
    <div class="days">${p.days.map((d, i) => `<button class="day ${S.done[d.id] ? 'is-done' : ''} ${i === nxt ? 'is-today' : ''}" data-act="playprog" data-pid="${p.id}" data-i="${i}">
      <span class="n">${S.done[d.id] ? '✓' : '第 ' + (i + 1) + ' 天'}</span><span class="t">${esc(d.title)}</span><span class="m">${mins(d.duration)} 分</span></button>`).join('')}</div>`;
}
function lists(id) {
  if (id) {
    const li = S.lists.find(x => x.id === id); if (!li) return '<p class="empty">找不到這個清單。</p>'; ctx = li.ids;
    return `<a class="back" href="#/lists">← 我的清單</a><div class="bar"><h2>${esc(li.name)}</h2><span><button class="btn primary" data-act="playlist" data-lid="${li.id}">▶ 播放全部</button> <button class="btn" data-act="dellist" data-lid="${li.id}">刪除</button></span></div>
      <div class="days">${li.ids.map((vid, i) => { const v = VM[vid]; return v ? `<div class="day ${S.done[vid] ? 'is-done' : ''}"><button style="all:unset;display:flex;gap:12px;flex:1;cursor:pointer;align-items:center" data-act="play" data-i="${i}"><span class="n">${S.done[vid] ? '✓' : i + 1}</span><span class="t">${esc(v.title)}</span><span class="m">${mins(v.duration)} 分</span></button><button class="chip" data-act="rm" data-lid="${li.id}" data-id="${vid}">移除</button></div>` : ''; }).join('') || '<p class="empty">還沒有影片，到戰情室按卡片上的 ＋ 加入。</p>'}</div>`;
  }
  return `<section class="hero"><h1>我的<em>清單</em></h1><p>把喜歡的影片排成每天的訓練菜單，一鍵連續播放。</p></section>
    <form data-act="newlist" class="row"><input class="field" name="n" placeholder="新清單名稱，例如「週一 胸背」" maxlength="30" style="flex:1"><button class="btn primary">建立</button></form>
    <div class="days">${S.lists.map(li => `<a class="day" href="#/lists/${li.id}" style="text-decoration:none"><span class="n">${li.ids.length} 支</span><span class="t">${esc(li.name)}</span><span class="m">${mins(li.ids.reduce((a, id) => a + (VM[id]?.duration || 0), 0))} 分</span></a>`).join('') || '<p class="empty">還沒有清單。</p>'}</div>`;
}

// ---------- 路由 ----------
const TABS = [['#/', '戰情室'], ['#/series', '跟練系列'], ['#/guides', '動作講解'], ['#/lists', '我的清單']];
function render() {
  const h = location.hash || '#/', [, r, id] = h.split('/');
  $('tabs').innerHTML = TABS.map(([href, n]) => `<a href="${href}" ${(href === '#/' ? !r : href.split('/')[1] === r) ? 'aria-current="page"' : ''}>${n}</a>`).join('');
  $('app').innerHTML = r === 'guides' ? home('guide') : r === 'series' ? (id ? seriesDetail(id) : series()) : r === 'lists' ? lists(id) : home('follow');
  const s = streak(); $('streak').textContent = s ? `🔥 連續 ${s} 天` : '';
}
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

// ---------- 播放（YouTube IFrame API，播完自動下一支＋記完成） ----------
let yt = null, queue = [], qi = 0;
const meta = id => VM[id] || P.flatMap(p => p.days).find(d => d.id === id) || { title: '' };
function play(ids, i, source) {
  queue = ids; qi = i; if (source) { S.last = source; save(); }
  $('player').showModal(); load();
}
function load() {
  const id = queue[qi]; $('pt').textContent = meta(id).title; $('pq').textContent = `${qi + 1} / ${queue.length}`;
  $('pprev').disabled = qi === 0; $('pnext').disabled = qi >= queue.length - 1;
  if (yt && yt.loadVideoById) return yt.loadVideoById(id);
  const mk = () => (yt = new YT.Player('ytbox', { host: 'https://www.youtube-nocookie.com', videoId: id, playerVars: { rel: 0, playsinline: 1, autoplay: 1 },
    events: { onStateChange: e => { if (e.data === 0) { finish(); if (qi < queue.length - 1) { qi++; load(); } } } } }));
  if (window.YT && YT.Player) mk(); else window.onYouTubeIframeAPIReady = mk;
}
function finish() { const id = queue[qi]; if (!S.done[id]) { S.done[id] = Date.now(); save(); toast('完成！🔥'); } }
$('pdone').onclick = () => { finish(); if (qi < queue.length - 1) { qi++; load(); } else $('player').close(); };
$('pnext').onclick = () => { qi++; load(); }; $('pprev').onclick = () => { qi--; load(); };
$('pclose').onclick = () => $('player').close();
$('player').onclose = () => { try { yt && yt.stopVideo(); } catch (e) {} render(); };

// ---------- 加入清單（bottom sheet） ----------
function sheet(html) { $('sheet').innerHTML = html; $('sheet').hidden = $('backdrop').hidden = false; }
const closeSheet = () => { $('sheet').hidden = $('backdrop').hidden = true; };
$('backdrop').onclick = closeSheet;
function addSheet(vid) {
  sheet(`<h3>加入清單</h3>${S.lists.map(li => `<button class="opt" data-act="addto" data-lid="${li.id}" data-id="${vid}"><span>${esc(li.name)}</span><span>${li.ids.includes(vid) ? '✓ 已加入' : ''}</span></button>`).join('')}
    <form data-act="newadd" data-id="${vid}" class="row"><input class="field" name="n" placeholder="新清單名稱" maxlength="30" style="flex:1"><button class="btn primary">＋ 新增</button></form>`);
}

// ---------- 事件 ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'FORM') return; const a = t.dataset.act, d = t.dataset;
  if (a === 'tf') { const s = new Set(S.f[d.k]); s.has(d.v) ? s.delete(d.v) : s.add(d.v); S.f[d.k] = [...s]; save(); render(); }
  else if (a === 'clear') { for (const k in S.f) S.f[k] = []; save(); render(); }
  else if (a === 'play') play(ctx, +d.i, location.hash.startsWith('#/lists/') ? { type: 'list', id: location.hash.split('/')[2] } : null);
  else if (a === 'playprog') play(ctx, +d.i, { type: 'program', id: d.pid });
  else if (a === 'rand') play(ctx, Math.floor(Math.random() * ctx.length));
  else if (a === 'cont') { const l = S.last, ids = l.type === 'program' ? P.find(p => p.id === l.id).days.map(x => x.id) : S.lists.find(x => x.id === l.id).ids; play(ids, ids.findIndex(id => !S.done[id]), l); }
  else if (a === 'addlist') addSheet(d.id);
  else if (a === 'addto') { const li = S.lists.find(x => x.id === d.lid); if (!li.ids.includes(d.id)) li.ids.push(d.id); else li.ids = li.ids.filter(x => x !== d.id); save(); addSheet(d.id); }
  else if (a === 'playlist') { const li = S.lists.find(x => x.id === d.lid); if (li.ids.length) play(li.ids, Math.max(0, li.ids.findIndex(id => !S.done[id])), { type: 'list', id: li.id }); }
  else if (a === 'rm') { const li = S.lists.find(x => x.id === d.lid); li.ids = li.ids.filter(x => x !== d.id); save(); render(); }
  else if (a === 'dellist') { S.lists = S.lists.filter(x => x.id !== d.lid); save(); location.hash = '#/lists'; }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-act]'); if (!f) return; e.preventDefault();
  const name = f.n.value.trim(); if (!name) return; const li = { id: 'l' + Date.now().toString(36), name, ids: [] };
  if (f.dataset.act === 'newadd') li.ids.push(f.dataset.id);
  S.lists.push(li); save(); if (f.dataset.act === 'newadd') { addSheet(f.dataset.id); toast('已建立並加入'); } else render();
});

Promise.all([fetch('data/videos.json').then(r => r.json()), fetch('data/programs.json').then(r => r.json()).catch(() => [])])
  .then(([v, p]) => { V = v; P = p; VM = Object.fromEntries(V.map(x => [x.id, x])); render(); })
  .catch(() => { $('app').innerHTML = '<p class="empty">資料載入失敗</p>'; });
