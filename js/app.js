const L = {
  equipment: ['器材', { 'resistance-band': '彈力帶/繩', kettlebell: '壺鈴', dumbbell: '啞鈴', bodyweight: '徒手' }],
  split: ['部位', { 'full-body': '全身', upper: '上肢', lower: '下肢', push: '推(胸肩)', pull: '拉(背)', legs: '腿', core: '核心' }],
  muscles: ['肌群', { chest: '胸', back: '背', shoulders: '肩', arms: '手臂', quads: '股四頭', hamstrings: '腿後', glutes: '臀', calves: '小腿', core: '核心' }],
  style: ['型態', { strength: '肌力', hiit: 'HIIT', cardio: '有氧', mobility: '活動度', warmup: '熱身' }],
  intensity: ['強度', { 1: '1 拉伸', 2: '2 輕度', 3: '3 中等', 4: '4 高強度', 5: '5 極高' }],
  level: ['程度', { beginner: '初階', intermediate: '中階', advanced: '進階' }],
  dur: ['時長', { s: '<10 分', m: '10–20', l: '20–30', xl: '30+' }],
  lang: ['語言', { zh: '中文', en: 'English' }],
};
const bucket = s => (s < 600 ? 's' : s < 1200 ? 'm' : s < 1800 ? 'l' : 'xl');
const vals = (v, k) => (k === 'dur' ? [bucket(v.duration)] : [].concat(v[k] ?? []).map(String));
const sel = Object.fromEntries(Object.keys(L).map(k => [k, new Set()]));
let data = [], text = '';
const $ = id => document.getElementById(id);
const el = (t, c, x) => Object.assign(document.createElement(t), { className: c || '', textContent: x ?? '' });

function load() { // 從網址 hash 還原篩選，可分享
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k in sel) (p.get(k) || '').split(',').filter(Boolean).forEach(x => sel[k].add(x));
  text = p.get('q') || ''; $('q').value = text;
}
function save() {
  const p = new URLSearchParams();
  for (const k in sel) if (sel[k].size) p.set(k, [...sel[k]].join(','));
  if (text) p.set('q', text);
  history.replaceState(null, '', p.toString() ? '#' + p : location.pathname);
}
const match = v => Object.keys(sel).every(k => !sel[k].size || vals(v, k).some(x => sel[k].has(x)))
  && (!text || (v.title + v.channel + (v.summaryZh || '')).toLowerCase().includes(text.toLowerCase()));

function chips() {
  const box = $('filters'); box.replaceChildren();
  for (const [k, [name, map]] of Object.entries(L)) {
    const g = el('div', 'group'); g.append(el('b', '', name));
    for (const [val, label] of Object.entries(map)) {
      if (!data.some(v => vals(v, k).includes(val))) continue; // 沒有影片的選項不顯示
      const b = el('button', 'chip', label); b.type = 'button';
      b.setAttribute('aria-pressed', sel[k].has(val));
      b.onclick = () => { sel[k].has(val) ? sel[k].delete(val) : sel[k].add(val); render(); };
      g.append(b);
    }
    box.append(g);
  }
}
const mins = s => Math.round(s / 60);
const views = n => (n >= 1e4 ? (n / 1e4).toFixed(1) + ' 萬' : n ? String(n) : '');

function card(v) {
  const c = el('button', 'card'); c.type = 'button';
  const t = el('div', 'thumb'); const im = el('img'); im.loading = 'lazy'; im.alt = '';
  im.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`; t.append(im, el('span', 'dur', mins(v.duration) + ' 分'));
  const b = el('div', 'body');
  b.append(el('div', 'title', v.title), el('div', 'meta', [v.channel, views(v.views) && views(v.views) + '次觀看'].filter(Boolean).join('・')));
  if (v.summaryZh) b.append(el('div', 'sum', v.summaryZh));
  const tags = el('div', 'tags');
  if (v.intensity) tags.append(el('span', 'int', '●'.repeat(v.intensity) + '○'.repeat(5 - v.intensity)));
  for (const x of v.equipment) tags.append(el('span', 'tag', L.equipment[1][x] || x));
  for (const x of v.split) tags.append(el('span', 'tag', L.split[1][x] || x));
  b.append(tags); c.append(t, b); c.onclick = () => play(v); return c;
}
function play(v) {
  $('yt').src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`;
  $('pt').textContent = v.title; $('pm').textContent = v.channel;
  $('pl').href = `https://www.youtube.com/watch?v=${v.id}`; $('player').showModal();
}
function render() {
  save(); chips();
  const rows = data.filter(match);
  $('list').replaceChildren(...rows.map(card));
  $('count').textContent = `${rows.length} / ${data.length} 支`;
  $('empty').hidden = rows.length > 0;
  $('reset').hidden = !(text || Object.values(sel).some(s => s.size));
}
$('q').oninput = e => { text = e.target.value.trim(); render(); };
$('reset').onclick = () => { for (const k in sel) sel[k].clear(); text = ''; $('q').value = ''; render(); };
$('close').onclick = () => $('player').close();
$('player').onclose = () => { $('yt').src = ''; }; // 關閉即停止播放
$('player').onclick = e => { if (e.target === $('player')) $('player').close(); };
fetch('data/videos.json').then(r => r.json()).then(d => { data = d; load(); render(); })
  .catch(() => { $('empty').hidden = false; $('empty').textContent = '資料載入失敗'; });
