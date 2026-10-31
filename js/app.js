/* 我家也有健身房：挑部位 → 跟著做；系列每日進度；自訂清單；遠距離跟練播放器。
   狀態只存在本機 localStorage（gym.v1）。圖示來自 js/icons.js 的全域 ICONS（agy 產生，勿在此修改）。 */

// ---------- 圖示 ----------
// 部位/隨機/連續/完成：用 ICONS[key]（inline SVG，currentColor 上色）；找不到時優雅降級為文字或不顯示。
const icon = (key, fallback = '') => {
  const lib = typeof ICONS === 'object' && ICONS ? ICONS : {};
  const s = lib[key];
  return typeof s === 'string' && s.trim().startsWith('<svg')
    ? `<span class="ico" aria-hidden="true">${s}</span>`
    : fallback ? `<span class="ico ico-fb" aria-hidden="true">${fallback}</span>` : '';
};
// 介面操作用的小圖示（不屬於 ICONS 的範圍：播放、加號、箭頭等），自繪線條、currentColor。
const UI = (() => {
  const w = d => `<span class="ico ui" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`;
  return {
    play: w('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
    pause: w('<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor"/>'),
    plus: w('<path d="M12 5v14M5 12h14"/>'),
    check: w('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    close: w('<path d="M6 6l12 12M18 6L6 18"/>'),
    prev: w('<path d="M15 6l-6 6 6 6"/>'),
    next: w('<path d="M9 6l6 6-6 6"/>'),
    skipPrev: w('<path d="M6 5v14"/><path d="M18 6l-8 6 8 6z" fill="currentColor"/>'),
    skipNext: w('<path d="M18 5v14"/><path d="M6 6l8 6-8 6z" fill="currentColor"/>'),
    up: w('<path d="M6 15l6-6 6 6"/>'),
    down: w('<path d="M6 9l6 6 6-6"/>'),
    trash: w('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
    expand: w('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    shrink: w('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
    filter: w('<path d="M4 6h16M7 12h10M10 18h4"/>'),
    list: w('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
    warn: w('<path d="M12 4L2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>'),
  };
})();

const PARTS = [
  { id: 'chest', name: '胸' }, { id: 'back', name: '背' }, { id: 'shoulders', name: '肩' }, { id: 'arms', name: '手臂' },
  { id: 'lower', name: '臀腿' }, { id: 'core', name: '核心' }, { id: 'full', name: '全身' },
];
const PN = Object.fromEntries(PARTS.map(p => [p.id, p.name]));
const L = {
  equip: { 'resistance-band': '彈力帶', kettlebell: '壺鈴', dumbbell: '啞鈴', bodyweight: '徒手' },
  time: { t15: '15 分內', t30: '15–30 分', t45: '30 分以上' },
  inten: { low: '輕鬆', mid: '中等', high: '高強度' },
  level: { beginner: '初階', intermediate: '中階', advanced: '進階' },
};
const FLABEL = { equip: '器材', time: '時間', inten: '強度', level: '程度' };
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
// log：每次練完都記一筆 {id, t}（done 只記每支影片第一次，重練、隔天再練都不會留下紀錄）
let S = { lists: [], done: {}, log: [], last: null, f: { parts: [], equip: [], time: [], inten: [], level: [] } };
try { const o = JSON.parse(localStorage.getItem('gym.v1') || '{}'); S = { ...S, ...o, f: { ...S.f, ...(o.f || {}) } }; } catch (e) {}
if (!Array.isArray(S.log)) S.log = [];
// 舊資料移轉：把 done 裡的第一次完成時間補進 log
{ const seen = new Set(S.log.map(x => x.id + '@' + x.t)); for (const [id, t] of Object.entries(S.done)) if (!seen.has(id + '@' + t)) S.log.push({ id, t }); S.log.sort((a, b) => a.t - b.t); }
// 請瀏覽器不要在空間不足時自動清掉這個網站的資料（使用者手動「清除網站資料」時仍會清掉）
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
const save = () => { try { localStorage.setItem('gym.v1', JSON.stringify(S)); } catch (e) {} };
save(); // 移轉後的 log 立刻寫回
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mins = s => Math.max(1, Math.round((s || 0) / 60));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const day = t => { const d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
const doneToday = () => S.log.some(x => day(x.t) === day(Date.now()));
const trainedDays = () => new Set(S.log.map(x => day(x.t)));
const totalDays = () => trainedDays().size;
function streak() {
  const days = trainedDays(); let n = 0; const t = new Date();
  if (!days.has(day(t))) t.setDate(t.getDate() - 1);
  while (days.has(day(t))) { n++; t.setDate(t.getDate() - 1); }
  return n;
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

// toast：用 popover 進入 top layer，播放器（modal dialog）開著時也看得到；可帶一個動作按鈕（例如「復原」）。
function toast(msg, action) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-act">${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { hideToast(); action.run(); };
  try { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } catch (e) { t.hidden = false; }
  t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(hideToast, action ? 6000 : 2200);
}
function hideToast() { const t = $('toast'); t.classList.remove('on'); try { t.hidePopover(); } catch (e) { t.hidden = true; } }

// ---------- 資料 ----------
let V = [], P = [], VM = {}, CUES = {}; let ctx = [];
const thumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const meta = id => VM[id] || P.flatMap(p => p.days).find(d => d.id === id) || { id, title: '' };

// ---------- 小元件 ----------
const dots = n => n ? `<span class="dots" role="img" aria-label="強度 ${n}/5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}<b>${L.inten[ib(n)]}</b></span>` : '';
const partsOf = v => PARTS.filter(p => p.id !== 'full' && hasPart(v, p.id)).map(p => p.name);
function card(v, i) {
  const ps = hasPart(v, 'full') ? ['全身'] : partsOf(v).slice(0, 2);
  const inList = S.lists.some(l => l.ids.includes(v.id)), done = !!S.done[v.id];
  const tags = (v.equipment || []).slice(0, 2).map(e => `<span class="tag">${esc(L.equip[e] || e)}</span>`)
    .concat(ps.map(p => `<span class="tag pt">${esc(p)}</span>`));
  return `<article class="card${done ? ' is-done' : ''}"><button class="go" data-act="play" data-i="${i}" aria-label="播放：${esc(v.title)}">
    <div class="thumb"><img loading="lazy" alt="" src="${thumb(v.id)}"><span class="dur">${mins(v.duration)} 分</span>
    ${v.quality >= 88 ? '<span class="badge">精選</span>' : ''}${done ? `<span class="done">${icon('check', '✓')}已完成</span>` : ''}
    <span class="playhint">${UI.play}</span></div>
    <div class="cbody"><div class="ctitle">${esc(v.title)}</div>
    ${v.summaryZh ? `<div class="csum">${esc(v.summaryZh)}</div>` : ''}
    <div class="cfoot">${dots(v.intensity)}<span class="tags">${tags.join('')}</span></div>
    <div class="cmeta">${esc(v.channel)}</div></div></button>
    <button class="add${inList ? ' in' : ''}" data-act="addlist" data-id="${v.id}" aria-label="${inList ? '已在清單，管理' : '加入清單'}" title="加入清單">${inList ? UI.check : UI.plus}</button></article>`;
}
const chip = (k, v, label, on) => `<button type="button" class="chip" data-act="tf" data-k="${k}" data-v="${v}" aria-pressed="${on}">${esc(label)}</button>`;
const row = (k, map) => `<div class="frow" role="group" aria-label="${FLABEL[k]}"><small>${FLABEL[k]}</small><div class="chips">${Object.entries(map).map(([v, l]) => chip(k, v, l, S.f[k].includes(v))).join('')}</div></div>`;

function filtered(kind) {
  const f = S.f, any = (a, ok) => !a.length || ok, keys = filterKeys(kind);
  const on = k => keys.includes(k) ? f[k] : [];
  return V.filter(v => v.kind === kind
    && any(f.parts, f.parts.some(p => hasPart(v, p)))
    && any(on('equip'), (v.equipment || []).some(e => f.equip.includes(e)))
    && any(on('time'), f.time.includes(tb(v.duration)))
    && any(on('inten'), v.intensity && f.inten.includes(ib(v.intensity)))
    && any(on('level'), f.level.includes(v.level))).sort((a, b) => b.quality - a.quality);
}
// 跟練影片只有約 1 成有標程度，程度篩選只在講解頁提供；講解影片不提供時間/強度。
const filterKeys = kind => (kind === 'guide' ? ['equip', 'level'] : ['equip', 'time', 'inten']);
const activeExtra = kind => filterKeys(kind).flatMap(k => S.f[k].map(v => L[k][v])).filter(Boolean);
const hasF = kind => S.f.parts.length || activeExtra(kind).length;
let filtersOpen = false;

// ---------- 頁面 ----------
function todayBlock(rows) {
  const s = streak(), nx = nextUp();
  const status = doneToday() ? `<span class="pill good">${icon('check', '✓')}今天練過了</span>` : '<span class="pill">今天還沒練</span>';
  const fl = (s ? `<span class="pill flame">${icon('flame')}連續 ${s} 天</span>` : '') + (totalDays() ? `<span class="pill">累計 ${totalDays()} 天</span>` : '');
  const cont = nx ? `<button class="today-main" data-act="cont"><img alt="" src="${thumb(nx.v.id)}"><span class="tm-body"><span class="k">${nx.kind}</span><span class="t">${esc(nx.title)}</span><span class="s">${esc(nx.v.title)}・${mins(nx.v.duration)} 分</span></span><span class="tm-go">${UI.play}</span></button>`
    : `<a class="today-main ghost" href="#/series"><span class="tm-body"><span class="k">還沒有進行中的課表</span><span class="t">挑一個每日跟練系列</span><span class="s">28–31 天，一天一支，系統幫你記第幾天</span></span><span class="tm-go">${UI.next}</span></a>`;
  const rand = rows.length ? `<button class="today-rand" data-act="rand">${icon('dice')}<span><b>隨機一支</b><small>${S.f.parts.length ? S.f.parts.map(p => PN[p]).join('・') : '從精選'}${S.f.parts.length ? '的精選' : '中'}挑</small></span></button>` : '';
  return `<section class="today" aria-label="今天的訓練"><div class="today-head"><h2>今天的訓練</h2><span>${status}${fl}</span></div>
    <div class="today-grid">${cont}${rand}</div>${historyBlock()}${accountLine()}</section>`;
}
function home(kind) {
  const isGuide = kind === 'guide', rows = filtered(kind); ctx = rows.map(v => v.id);
  const ex = activeExtra(kind);
  return `${isGuide ? '' : todayBlock(rows)}
    <section class="hero"><h1 tabindex="-1">${isGuide ? '先把動作<em>學對</em>' : '今天想練<em>哪裡</em>？'}</h1>
    <p>${isGuide ? '姿勢、要領、常見錯誤。學會再去跟練，更安全也更有效。' : '點選部位（可複選），下面立刻列出能直接跟著做的精選影片。'}</p></section>
    <div class="parts" role="group" aria-label="部位">${PARTS.map(p => `<button type="button" class="part" data-act="tf" data-k="parts" data-v="${p.id}" aria-pressed="${S.f.parts.includes(p.id)}">${icon(p.id, p.name.slice(0, 1))}<span>${p.name}</span></button>`).join('')}</div>
    <details class="filters" ${filtersOpen ? 'open' : ''}><summary>${UI.filter}<span class="fs-label">更多條件</span>
      <span class="fs-sum">${ex.length ? ex.map(x => `<span class="tag on">${esc(x)}</span>`).join('') : `<span class="muted">${filterKeys(kind).map(k => FLABEL[k]).join('・')}</span>`}</span>${UI.down}</summary>
      <div class="fbody">${filterKeys(kind).map(k => row(k, L[k])).join('')}</div></details>
    <div class="bar"><h2 aria-live="polite">${rows.length ? `精選 <b>${rows.length}</b> 支` : '沒有符合的影片'}</h2>
      ${hasF(kind) ? '<button type="button" class="btn sm" data-act="clear">清除條件</button>' : ''}</div>
    ${rows.length ? `<div class="grid">${rows.map(card).join('')}</div>`
      : `<div class="empty"><p>這個組合目前沒有影片。</p><button type="button" class="btn primary" data-act="clear">清除條件</button></div>`}
    <p class="note">影片版權屬原頻道，本站僅以 YouTube 官方嵌入播放。分類由 AI 依標題、說明與章節整理；「精選」代表觀看、讚率、頻道規模等數據評分前段。</p>`;
}

function nextUp() {
  const l = S.last; if (!l) return null;
  if (l.type === 'program') {
    const p = P.find(x => x.id === l.id); if (!p) return null; const i = p.days.findIndex(d => !S.done[d.id]); if (i < 0) return null;
    return { v: p.days[i], kind: `繼續系列・第 ${i + 1} / ${p.days.length} 天`, title: p.title, ids: p.days.map(d => d.id), i };
  }
  if (l.type === 'list') {
    const li = S.lists.find(x => x.id === l.id); if (!li) return null; const i = li.ids.findIndex(id => !S.done[id]); if (i < 0 || !VM[li.ids[i]]) return null;
    return { v: VM[li.ids[i]], kind: `繼續清單・第 ${i + 1} / ${li.ids.length} 支`, title: li.name, ids: li.ids, i };
  }
  return null;
}

function series() {
  return `<section class="hero"><h1 tabindex="-1">每天<em>跟著做</em></h1><p>多天課程，一天一支，照順序練完。系統記錄你練到第幾天。</p></section>
    ${P.length ? `<div class="grid">${P.map(p => { const d = p.days.filter(x => S.done[x.id]).length, nxt = p.days.findIndex(x => !S.done[x.id]);
      return `<a class="card" href="#/series/${p.id}"><div class="thumb"><img loading="lazy" alt="" src="${thumb(p.days[0].id)}"><span class="badge">${p.days.length} 天</span></div>
      <div class="cbody"><div class="ctitle">${esc(p.title)}</div>${p.summaryZh ? `<div class="csum">${esc(p.summaryZh)}</div>` : ''}
      <div class="cfoot">${dots(p.intensity)}<span class="tags">${(p.equipment || []).slice(0, 2).map(e => `<span class="tag">${esc(L.equip[e] || e)}</span>`).join('')}</span></div>
      <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${p.days.length}" aria-valuenow="${d}" aria-label="進度"><i style="width:${Math.round(d / p.days.length * 100)}%"></i></div>
      <div class="cmeta"><span>${esc(p.channel)}</span><b>${nxt < 0 ? '全部完成' : d ? `下一個：第 ${nxt + 1} 天` : '尚未開始'}</b></div></div></a>`; }).join('')}</div>`
      : '<div class="empty"><p>還沒有通過品質把關的系列。</p></div>'}`;
}
function seriesDetail(id) {
  const p = P.find(x => x.id === id); if (!p) return '<div class="empty"><p>找不到這個系列。</p><a class="btn" href="#/series">回所有系列</a></div>';
  const nxt = p.days.findIndex(d => !S.done[d.id]), d = p.days.filter(x => S.done[x.id]).length; ctx = p.days.map(x => x.id);
  const cur = nxt >= 0 ? p.days[nxt] : null;
  return `<a class="back" href="#/series">${UI.prev}所有系列</a>
    <section class="hero"><h1 tabindex="-1">${esc(p.title)}</h1><p>${esc(p.channel)}・${p.days.length} 天${p.summaryZh ? '・' + esc(p.summaryZh) : ''}</p></section>
    <div class="prog big" role="progressbar" aria-valuemin="0" aria-valuemax="${p.days.length}" aria-valuenow="${d}" aria-label="系列進度"><i style="width:${Math.round(d / p.days.length * 100)}%"></i></div>
    <p class="cmeta">已完成 ${d} / ${p.days.length} 天</p>
    ${cur ? `<button class="today-main" data-act="playprog" data-pid="${p.id}" data-i="${nxt}"><img alt="" src="${thumb(cur.id)}"><span class="tm-body"><span class="k">今天：第 ${nxt + 1} 天</span><span class="t">${esc(cur.title)}</span><span class="s">${mins(cur.duration)} 分鐘</span></span><span class="tm-go">${UI.play}</span></button>`
      : `<div class="empty"><p>${icon('flame')} 整個系列都完成了，太強了！</p></div>`}
    <h2 class="sec">所有天數</h2>
    <ol class="days">${p.days.map((x, i) => `<li><button class="day ${S.done[x.id] ? 'is-done' : ''} ${i === nxt ? 'is-today' : ''}" data-act="playprog" data-pid="${p.id}" data-i="${i}" ${i === nxt ? 'aria-current="step"' : ''}>
      <span class="n">${S.done[x.id] ? icon('check', '✓') : i + 1}</span><span class="t">${i === nxt ? '<b class="now">今天</b>' : ''}${esc(x.title)}</span><span class="m">${mins(x.duration)} 分</span></button></li>`).join('')}</ol>`;
}
function lists(id) {
  if (id) {
    const li = S.lists.find(x => x.id === id); if (!li) return '<div class="empty"><p>找不到這個清單。</p><a class="btn" href="#/lists">回我的清單</a></div>';
    ctx = li.ids; const tot = li.ids.reduce((a, x) => a + (VM[x]?.duration || 0), 0);
    return `<a class="back" href="#/lists">${UI.prev}我的清單</a>
      <section class="hero"><h1 tabindex="-1">${esc(li.name)}</h1><p>${li.ids.length} 支・約 ${mins(tot)} 分鐘</p></section>
      <div class="actions">${li.ids.length ? `<button type="button" class="btn primary lg" data-act="playlist" data-lid="${li.id}">${UI.play}播放全部</button>` : ''}
        <button type="button" class="btn" data-act="dellist" data-lid="${li.id}">${UI.trash}刪除清單</button></div>
      ${li.ids.length ? `<ol class="days">${li.ids.map((vid, i) => { const v = VM[vid]; return v ? `<li class="lrow ${S.done[vid] ? 'is-done' : ''}">
        <button class="lplay" data-act="play" data-i="${i}" aria-label="播放第 ${i + 1} 支：${esc(v.title)}"><span class="n">${S.done[vid] ? icon('check', '✓') : i + 1}</span><img alt="" loading="lazy" src="${thumb(vid)}"><span class="t">${esc(v.title)}<small>${mins(v.duration)} 分${v.intensity ? `・強度 ${v.intensity}/5` : ''}</small></span></button>
        <span class="lbtns"><button class="ib" data-act="mv" data-d="-1" data-lid="${li.id}" data-i="${i}" aria-label="上移" ${i === 0 ? 'disabled' : ''}>${UI.up}</button><button class="ib" data-act="mv" data-d="1" data-lid="${li.id}" data-i="${i}" aria-label="下移" ${i === li.ids.length - 1 ? 'disabled' : ''}>${UI.down}</button><button class="ib" data-act="rm" data-lid="${li.id}" data-id="${vid}" aria-label="從清單移除">${UI.close}</button></span></li>` : ''; }).join('')}</ol>`
        : `<div class="empty"><p>還沒有影片。到首頁，按卡片右上角的 ＋ 就能加進來。</p><a class="btn primary" href="#/">去首頁挑影片</a></div>`}`;
  }
  return `<section class="hero"><h1 tabindex="-1">我的<em>清單</em></h1><p>把喜歡的影片排成每天的訓練菜單，一鍵連續播放。</p></section>
    <form data-act="newlist" class="newform"><label class="sr" for="nl">新清單名稱</label><input class="field" id="nl" name="n" placeholder="新清單，例如「週一 胸背」" maxlength="30" autocomplete="off"><button class="btn primary">${UI.plus}建立</button></form>
    ${S.lists.length ? `<ul class="days">${S.lists.map(li => `<li><a class="day" href="#/lists/${li.id}"><span class="n">${UI.list}</span><span class="t">${esc(li.name)}<small>${li.ids.length} 支・約 ${mins(li.ids.reduce((a, x) => a + (VM[x]?.duration || 0), 0))} 分</small></span><span class="m">${UI.next}</span></a></li>`).join('')}</ul>`
      : '<div class="empty"><p>還沒有清單。建一個，或在首頁的影片卡片上按 ＋ 直接加入。</p></div>'}`;
}

// ---------- 路由（重繪時保留鍵盤焦點） ----------
// 最近 14 個練習日：哪天、練了哪些影片
function historyBlock() {
  if (!S.log.length) return '';
  const T = {}; P.forEach(p => p.days.forEach(d => (T[d.id] = d.title))); V.forEach(v => (T[v.id] = v.title));
  const by = new Map();
  for (const x of [...S.log].sort((a, b) => b.t - a.t)) { const k = new Date(x.t).toDateString(); if (!by.has(k)) by.set(k, { t: x.t, ids: [] }); const g = by.get(k); if (!g.ids.includes(x.id)) g.ids.push(x.id); }
  const rows = [...by.values()].slice(0, 14).map(g => { const d = new Date(g.t);
    return `<li><b>${d.getMonth() + 1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）</b> ${g.ids.map(id => esc(T[id] || id)).join('、')}</li>`; }).join('');
  return `<details class="history"><summary>練習紀錄（累計 ${totalDays()} 天）</summary><ul>${rows}</ul></details>`;
}
// 選用登入：沒登入只存在這個瀏覽器；登入後同步到雲端（js/cloud.js）
function accountLine() {
  const C = window.Cloud; if (!C) return '';
  const u = C.user();
  return u ? `<p class="acct">已用 Google 登入${u.email ? `（${esc(u.email)}）` : ''}，練習紀錄會同步到雲端。<button type="button" class="linkbtn" data-act="logout">登出</button></p>`
    : `<p class="acct">紀錄只存在這個瀏覽器，清除瀏覽器資料會不見。<button type="button" class="linkbtn" data-act="login">用 Google 登入</button>可備份到雲端、換裝置也看得到（選用）。</p>`;
}
let syncing = false;
function cloudSync(quiet) {
  const C = window.Cloud; if (!C || !C.user() || syncing) return; syncing = true;
  C.sync(S.log).then(log => { S.log = log; save(); render(); if (!quiet) toast(`已登入，練習紀錄已同步（累計 ${totalDays()} 天）`); })
    .catch(() => { if (!C.user()) render(); if (!quiet) toast('雲端同步失敗，紀錄仍存在這個瀏覽器'); })
    .finally(() => { syncing = false; });
}
const TABS = [['#/', '首頁'], ['#/series', '跟練系列'], ['#/guides', '動作講解'], ['#/lists', '我的清單']];
const fkey = el => el && el.dataset && el.dataset.act ? JSON.stringify(el.dataset) : null;
function render(routeChanged) {
  const h = location.hash || '#/', [, r, id] = h.split('/');
  const fk = fkey(document.activeElement);
  $('tabs').innerHTML = TABS.map(([href, n]) => `<a href="${href}" ${(href === '#/' ? !r : href.split('/')[1] === r) ? 'aria-current="page"' : ''}>${n}</a>`).join('');
  $('app').innerHTML = r === 'guides' ? home('guide') : r === 'series' ? (id ? seriesDetail(id) : series()) : r === 'lists' ? lists(id) : home('follow');
  $('app').setAttribute('aria-busy', 'false');
  const s = streak(); $('streak').innerHTML = s ? `${icon('flame')}<b>${s}</b><span class="sr">天連續練習</span>` : '';
  $('streak').title = s ? `連續練習 ${s} 天` : '';
  if (routeChanged) { const h1 = $('app').querySelector('h1'); h1 && h1.focus({ preventScroll: true }); }
  else if (fk) { const el = [...$('app').querySelectorAll('[data-act]')].find(e => fkey(e) === fk); el && el.focus({ preventScroll: true }); }
  const d = $('app').querySelector('details.filters'); if (d) d.ontoggle = () => (filtersOpen = d.open);
}
window.addEventListener('hashchange', () => { render(true); scrollTo(0, 0); });

// ---------- 播放器：YouTube IFrame API ＋ 遠距離跟練面板 ----------
let yt = null, ytReady = false, queue = [], qi = 0, cues = [], ci = -1, poll = 0, wake = null;
const P$ = { dlg: $('player'), wrap: $('pwrap') };

// DEMO：只在 ?demo=1 或 localStorage gym.demoCues=1 時啟用，預設關閉。
// 為沒有 cues 的影片產生假章節，並在 YouTube 播放器還沒就緒時用模擬時鐘推進，僅供驗證 UI。
const DEMO = /[?&]demo=1\b/.test(location.search) || (() => { try { return localStorage.getItem('gym.demoCues') === '1'; } catch (e) { return false; } })();
function demoCues(dur) {
  const ex = [['深蹲', '臀部往後坐，重心在腳跟', '膝蓋不要內夾'], ['俯身划船', '手肘往後拉，夾緊背', '腰不要拱起來'],
    ['伏地挺身', '身體一直線，胸口貼近地面', '屁股不要翹高'], ['弓箭步', '前膝在腳踝正上方', ''], ['肩推', '核心收緊，推到頭頂', '不要聳肩或後仰']];
  const out = [{ t: 0, end: 20, type: 'intro', name: '開場說明', cue: '準備好器材', watch: '', en: 'Intro' },
    { t: 20, end: 60, type: 'warmup', name: '熱身', cue: '關節慢慢轉開', watch: '', en: 'Warm up' }];
  let t = 60, k = 0;
  while (t < (dur || 600) - 60 && k < 40) {
    const [name, cue, watch] = ex[k % ex.length];
    out.push({ t, end: t + 40, type: 'exercise', name, cue, watch, en: 'Demo ' + (k + 1) }); t += 40;
    out.push({ t, end: t + 20, type: 'rest', name: '休息', cue: '深呼吸，喝口水', watch: '', en: 'Rest' }); t += 20; k++;
  }
  out.push({ t, end: dur || t + 60, type: 'stretch', name: '收操伸展', cue: '每個姿勢停 20 秒', watch: '不要彈震', en: 'Cool down' });
  return out;
}
let sim = { base: 0, at: 0, playing: false };
const simNow = () => sim.base + (sim.playing ? (Date.now() - sim.at) / 1000 : 0);
const useSim = () => DEMO && !ytReady;
const nowT = () => { if (useSim()) return simNow(); try { return yt.getCurrentTime() || 0; } catch (e) { return 0; } };
const isPlaying = () => (useSim() ? sim.playing : ytReady && (() => { try { return yt.getPlayerState() === 1; } catch (e) { return false; } })());
// 跳段後播放器回報的時間會延遲一下；先鎖定目標段落，避免連按「下一個動作」時重算回舊段落。
let lock = { i: -1, until: 0 };
function seekCue(i) {
  if (i < 0 || i >= cues.length) return; const s = cues[i].t;
  if (useSim()) { sim = { base: s, at: Date.now(), playing: sim.playing }; } else if (ytReady) { try { yt.seekTo(s, true); yt.playVideo(); } catch (e) {} }
  lock = { i, until: Date.now() + 1500 }; ci = i; paintCue(); tick();
}
function togglePlay() {
  if (useSim()) { sim = { base: simNow(), at: Date.now(), playing: !sim.playing }; }
  else if (ytReady) { try { isPlaying() ? yt.pauseVideo() : yt.playVideo(); } catch (e) {} }
  setTimeout(syncPlayBtn, 120);
}
function syncPlayBtn() { const p = isPlaying(); $('pplay').innerHTML = (p ? UI.pause : UI.play) + `<span>${p ? '暫停' : '播放'}</span>`; $('pplay').setAttribute('aria-label', p ? '暫停' : '播放'); }

const TYPE = { exercise: '動作', rest: '休息', intro: '開場', warmup: '熱身', stretch: '伸展' };
function cueAt(t) { for (let i = cues.length - 1; i >= 0; i--) if (t >= cues[i].t) return i; return cues.length ? 0 : -1; }
const cueEnd = i => cues[i].end ?? (cues[i + 1] ? cues[i + 1].t : cues[i].t + 60);
function tick(force) {
  if (!cues.length) return;
  const t = nowT(); let i = cueAt(t);
  if (Date.now() < lock.until && i !== lock.i) i = lock.i; else lock.until = 0;
  if (i !== ci || force) { ci = i; paintCue(); }
  const c = cues[ci], end = cueEnd(ci), len = Math.max(1, end - c.t), tt = Math.min(end, Math.max(c.t, t)), done = (tt - c.t) / len;
  $('cbar').style.transform = `scaleX(${done})`;
  $('ctime').textContent = `剩 ${mmss(end - tt)}`;
}
function paintCue() {
  const c = cues[ci]; if (!c) return;
  const exs = cues.filter(x => x.type === 'exercise'), n = exs.indexOf(c);
  $('cue').dataset.type = c.type || 'exercise';
  $('ctype').textContent = c.type === 'exercise' && n >= 0 ? `動作 ${n + 1} / ${exs.length}` : (TYPE[c.type] || '');
  $('cname').textContent = c.name || c.en || '';
  $('ctip').hidden = !c.cue; $('ctipt').textContent = c.cue || '';
  const showWatch = !!c.watch && !['rest', 'intro'].includes(c.type);
  $('cwatch').hidden = !showWatch; $('cwatcht').textContent = showWatch ? c.watch : '';
  $('cprev').disabled = ci <= 0; $('cnext').disabled = ci >= cues.length - 1;
}
function startPoll() { stopPoll(); poll = setInterval(() => { tick(); }, 300); }
function stopPoll() { clearInterval(poll); poll = 0; }

function play(ids, i, source) {
  if (!ids.length) return;
  queue = ids.slice(); qi = Math.max(0, i); if (source) { S.last = source; save(); }
  if (!P$.dlg.open) P$.dlg.showModal();
  keepAwake(true); load();
}
function load() {
  const id = queue[qi], v = meta(id);
  $('pt').textContent = v.title || ''; $('pq').textContent = queue.length > 1 ? `第 ${qi + 1} / ${queue.length} 支` : '';
  $('pvprev').disabled = qi === 0; $('pvnext').disabled = qi >= queue.length - 1;
  $('pover').hidden = true;
  cues = (CUES[id] && CUES[id].length ? CUES[id] : DEMO ? demoCues(v.duration) : []).slice().sort((a, b) => a.t - b.t);
  ci = -1;
  P$.wrap.classList.toggle('has-cues', !!cues.length);
  $('psum').textContent = v.summaryZh || ''; $('psum').hidden = !!cues.length || !v.summaryZh;
  sim = { base: 0, at: Date.now(), playing: true };
  if (cues.length) { tick(true); startPoll(); } else stopPoll();
  if (yt && ytReady) { try { yt.loadVideoById(id); } catch (e) {} }
  else if (!yt) {
    const mk = () => {
      if (yt) return;
      yt = new YT.Player('ytbox', { host: 'https://www.youtube-nocookie.com', videoId: queue[qi], playerVars: { rel: 0, playsinline: 1, autoplay: 1, modestbranding: 1, cc_load_policy: 1, cc_lang_pref: 'zh-Hant', hl: 'zh-TW' },
        events: { onReady: () => { ytReady = true; if (yt.getVideoData && yt.getVideoData().video_id !== queue[qi]) yt.loadVideoById(queue[qi]); syncPlayBtn(); },
          onStateChange: e => { syncPlayBtn(); if (e.data === 1) zhCaptions(); if (e.data === 0) ended(); } } });
    };
    if (window.YT && YT.Player) mk(); else { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); mk(); }; }
  }
  syncPlayBtn();
}
// 預設開字幕並自動翻成繁中。captions 模組的 setOption 是 YouTube 未公開的介面，失敗就維持原字幕，不影響播放。
let capFor = '', capTimer = 0;
function zhCaptions() {
  clearInterval(capTimer);
  try {
    const id = yt.getVideoData && yt.getVideoData().video_id;
    if (!id || capFor === id) return; capFor = id;
    let n = 0;
    capTimer = setInterval(() => {   // 字幕清單載入要幾秒，輪詢到有為止（最多約 15 秒）
      try {
        yt.loadModule('captions');
        const tl = yt.getOption('captions', 'tracklist') || [];
        if (tl.length) {
          clearInterval(capTimer);
          if (tl.some(t => /^zh/.test(t.languageCode))) return;   // 已有中文字幕，cc_lang_pref 會選
          const t = tl.find(x => x.is_translateable);
          if (t) yt.setOption('captions', 'track', { languageCode: t.languageCode, translationLanguage: { languageCode: 'zh-Hant', languageName: '中文（繁體）' } });
        } else if (++n > 30) clearInterval(capTimer);
      } catch (e) { clearInterval(capTimer); }
    }, 500);
  } catch (e) {}
}
function finish() {
  const id = queue[qi], first = !doneToday(), now = Date.now();
  if (!S.done[id]) S.done[id] = now;
  // 同一支影片同一天只記一次（避免連按「完成這支」重複），隔天重練會再記
  if (!S.log.some(x => x.id === id && day(x.t) === day(now))) { S.log.push({ id, t: now }); window.Cloud && Cloud.add({ id, t: now }); }
  save(); return first;
}
function celebrate(auto) {
  finish(); const s = streak(), hasNext = qi < queue.length - 1;
  $('povs').textContent = s > 1 ? `連續 ${s} 天` : '今天的第一練完成';
  $('povnext').hidden = !hasNext;
  $('pover').hidden = false; $('pover').classList.toggle('pop', !REDUCED.matches);
  (hasNext ? $('povnext') : $('povclose')).focus();
  clearTimeout(celebrate.t);
  if (auto && hasNext) { let n = 8; const tickN = () => { $('povnext').textContent = `下一支（${n}）`; if (n-- <= 0) nextVideo(); else celebrate.t = setTimeout(tickN, 1000); }; tickN(); }
  else $('povnext').textContent = '下一支';
}
function ended() { celebrate(true); }
function nextVideo() { clearTimeout(celebrate.t); if (qi < queue.length - 1) { qi++; load(); } else P$.dlg.close(); }
function prevVideo() { if (qi > 0) { qi--; load(); } }
function isFs() { return document.fullscreenElement || document.webkitFullscreenElement; }
async function toggleFs() {
  try {
    if (isFs()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const el = P$.wrap, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) { toast('這個裝置不支援全螢幕，請把手機橫放'); return; }
    await req.call(el);
    try { await screen.orientation.lock('landscape'); } catch (e) {}
  } catch (e) { toast('無法進入全螢幕，請把手機橫放'); }
}
function syncFs() { const on = !!isFs(); $('pfs').innerHTML = on ? UI.shrink : UI.expand; $('pfs').setAttribute('aria-label', on ? '離開全螢幕' : '全螢幕'); P$.wrap.classList.toggle('is-fs', on); }
document.addEventListener('fullscreenchange', syncFs); document.addEventListener('webkitfullscreenchange', syncFs);
async function keepAwake(on) {
  try { if (on && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } else if (!on && wake) { await wake.release(); wake = null; } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && P$.dlg.open) keepAwake(true); });

// 播放器按鈕圖示（UI 為自繪線條圖示；完成/連續用 ICONS）
$('pclose').innerHTML = UI.close; $('pfs').innerHTML = UI.expand;
$('cprev').innerHTML = UI.skipPrev + '<span class="lab">上一個動作</span>'; $('cnext').innerHTML = '<span class="lab">下一個動作</span>' + UI.skipNext;
$('pvprev').innerHTML = UI.prev + '上一支'; $('pvnext').innerHTML = '下一支' + UI.next; $('pdone').innerHTML = icon('check', '✓') + '完成這支';
$('povi').innerHTML = icon('flame', '★');
$('pclose').onclick = () => P$.dlg.close();
$('pfs').onclick = toggleFs;
$('pplay').onclick = togglePlay;
$('pdone').onclick = () => celebrate(false);
$('pvprev').onclick = prevVideo; $('pvnext').onclick = nextVideo;
$('cprev').onclick = () => seekCue(ci - 1);
$('cnext').onclick = () => seekCue(ci + 1);
$('povnext').onclick = nextVideo; $('povclose').onclick = () => P$.dlg.close();
$('povstay').onclick = () => { clearTimeout(celebrate.t); $('pover').hidden = true; };
P$.dlg.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); cues.length ? $('cnext').click() : nextVideo(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); cues.length ? $('cprev').click() : prevVideo(); }
  else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFs(); }
});
P$.dlg.addEventListener('close', () => {
  // 沒看到最後、也沒按「完成這支」就關掉：看超過 80% 仍算練過
  try { if (yt && ytReady && !useSim()) { const d = yt.getDuration() || 0; if (d > 0 && yt.getCurrentTime() / d >= 0.8) finish(); } } catch (e) {}
  stopPoll(); clearTimeout(celebrate.t); keepAwake(false);
  try { yt && ytReady && yt.stopVideo(); } catch (e) {}
  if (isFs()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
  render();
});

// ---------- 加入清單（<dialog> bottom sheet：有焦點管理、Esc 關閉） ----------
const SH = $('sheet');
SH.addEventListener('click', e => { if (e.target === SH) SH.close(); });
let sheetFor = null;
function addSheet(vid) {
  sheetFor = vid; const v = meta(vid);
  SH.innerHTML = `<div class="grab" aria-hidden="true"></div><h3 id="shh">加入清單</h3><p class="cmeta">${esc(v.title)}</p>
    <div class="opts">${S.lists.map(li => { const on = li.ids.includes(vid); return `<button type="button" class="opt${on ? ' on' : ''}" data-act="addto" data-lid="${li.id}" data-id="${vid}" aria-pressed="${on}"><span>${esc(li.name)}<small>${li.ids.length} 支</small></span>${on ? UI.check + '<span class="sr">已加入，再按一次移除</span>' : UI.plus}</button>`; }).join('')
      || `<button type="button" class="opt" data-act="quicklist" data-id="${vid}"><span>建立「我的菜單」並加入<small>之後可以改名或另建</small></span>${UI.plus}</button>`}</div>
    <form data-act="newadd" data-id="${vid}" class="newform"><label class="sr" for="nla">新清單名稱</label><input class="field" id="nla" name="n" placeholder="或輸入新清單名稱" maxlength="30" autocomplete="off"><button class="btn primary">建立並加入</button></form>
    <button type="button" class="btn block" data-act="closesheet">完成</button>`;
  SH.setAttribute('aria-labelledby', 'shh');
  if (!SH.open) SH.showModal();
  (SH.querySelector('.opt') || SH.querySelector('input')).focus();
}
SH.addEventListener('close', () => { sheetFor = null; if (!P$.dlg.open) render(); });

// ---------- 事件 ----------
function delList(lid) {
  const idx = S.lists.findIndex(x => x.id === lid); if (idx < 0) return; const li = S.lists[idx];
  S.lists.splice(idx, 1); save(); location.hash = '#/lists';
  toast(`已刪除「${li.name}」`, { label: '復原', run: () => { S.lists.splice(Math.min(idx, S.lists.length), 0, li); save(); location.hash = '#/lists/' + li.id; } });
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'FORM') return; const a = t.dataset.act, d = t.dataset;
  if (a === 'tf') { const s = new Set(S.f[d.k]); s.has(d.v) ? s.delete(d.v) : s.add(d.v); S.f[d.k] = [...s]; save(); render(); }
  else if (a === 'clear') { for (const k in S.f) S.f[k] = []; save(); render(); toast('已清除條件'); }
  else if (a === 'play') play(ctx, +d.i, location.hash.startsWith('#/lists/') ? { type: 'list', id: location.hash.split('/')[2] } : null);
  else if (a === 'playprog') play(ctx, +d.i, { type: 'program', id: d.pid });
  else if (a === 'rand') { const pool = ctx.filter(id => !S.done[id]); const ids = pool.length ? pool : ctx; play([ids[Math.floor(Math.random() * ids.length)]], 0); }
  else if (a === 'cont') { const nx = nextUp(); if (nx) play(nx.ids, nx.i, S.last); }
  else if (a === 'addlist') addSheet(d.id);
  else if (a === 'login') window.Cloud && Cloud.signIn();
  else if (a === 'logout') { Cloud.signOut(); render(); toast('已登出；這個瀏覽器裡的紀錄仍保留'); }
  else if (a === 'closesheet') SH.close();
  else if (a === 'quicklist') { const li = { id: 'l' + Date.now().toString(36), name: '我的菜單', ids: [d.id] }; S.lists.push(li); save(); SH.close(); toast('已加入「我的菜單」', { label: '查看', run: () => (location.hash = '#/lists/' + li.id) }); }
  else if (a === 'addto') {
    const li = S.lists.find(x => x.id === d.lid); if (!li) return;
    if (!li.ids.includes(d.id)) { li.ids.push(d.id); save(); SH.close(); toast(`已加入「${li.name}」`, { label: '查看', run: () => (location.hash = '#/lists/' + li.id) }); }
    else { li.ids = li.ids.filter(x => x !== d.id); save(); addSheet(d.id); toast(`已從「${li.name}」移除`); }
  }
  else if (a === 'playlist') { const li = S.lists.find(x => x.id === d.lid); if (li && li.ids.length) { const i = li.ids.findIndex(id => !S.done[id]); play(li.ids, i < 0 ? 0 : i, { type: 'list', id: li.id }); } }
  else if (a === 'mv') {
    const li = S.lists.find(x => x.id === d.lid), i = +d.i, j = i + +d.d; if (!li || j < 0 || j >= li.ids.length) return;
    [li.ids[i], li.ids[j]] = [li.ids[j], li.ids[i]]; save(); render();
    const btn = $('app').querySelector(`[data-act="mv"][data-i="${j}"][data-d="${d.d}"]:not([disabled])`) || $('app').querySelector(`[data-act="mv"][data-i="${j}"]:not([disabled])`); btn && btn.focus();
  }
  else if (a === 'rm') {
    const li = S.lists.find(x => x.id === d.lid); if (!li) return; const i = li.ids.indexOf(d.id); li.ids.splice(i, 1); save(); render();
    toast(`已移除「${(VM[d.id]?.title || '').slice(0, 18)}…」`, { label: '復原', run: () => { li.ids.splice(i, 0, d.id); save(); render(); } });
  }
  else if (a === 'dellist') delList(d.lid);
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-act]'); if (!f) return; e.preventDefault();
  const name = f.n.value.trim(); if (!name) { f.n.focus(); return; }
  const li = { id: 'l' + Date.now().toString(36), name, ids: [] };
  if (f.dataset.act === 'newadd') li.ids.push(f.dataset.id);
  S.lists.push(li); save();
  if (f.dataset.act === 'newadd') { SH.close(); toast(`已建立「${name}」並加入`, { label: '查看', run: () => (location.hash = '#/lists/' + li.id) }); }
  else { render(); toast(`已建立「${name}」`); }
});

// ---------- 載入 ----------
function boot() {
  $('app').setAttribute('aria-busy', 'true');
  Promise.all([fetch('data/videos.json').then(r => { if (!r.ok) throw r; return r.json(); }),
    fetch('data/programs.json').then(r => (r.ok ? r.json() : [])).catch(() => []),
    fetch('data/cues.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}))])
    .then(([v, p, c]) => { V = v; P = p; CUES = c && typeof c === 'object' ? c : {}; VM = Object.fromEntries(V.map(x => [x.id, x])); render();
      if (window.Cloud) { const e = Cloud.error(); if (e) toast('Google 登入沒有完成：' + e); cloudSync(!Cloud.justSignedIn()); } })
    .catch(() => { $('app').setAttribute('aria-busy', 'false'); $('app').innerHTML = '<div class="empty"><p>資料載入失敗，請檢查網路後再試一次。</p><button type="button" class="btn primary" id="retry">重新載入</button></div>'; $('retry').onclick = boot; });
}
boot();
