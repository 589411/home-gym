// 選用的 Google 登入＋雲端練習紀錄（Supabase，沿用 launchdock 專案）
// 沒登入：一切照舊只存在這個瀏覽器。登入後：本機紀錄與雲端做聯集（去重），之後每練完一支就寫一筆。
// 下面的金鑰是 Supabase 的「publishable」公開金鑰，本來就放在前端；資料由資料表的 RLS 保護（只能讀寫自己的）。
(function () {
  var U = 'https://lxudxtpfenotkpgmhomq.supabase.co', K = 'sb_publishable_AOtRKbRCaCVlujPrOKJtnA_qMlCpQYT', KEY = 'gym.auth', TB = 'gym_training_history';
  var A = null, err = '';
  try { A = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  function store() { try { A ? localStorage.setItem(KEY, JSON.stringify(A)) : localStorage.removeItem(KEY); } catch (e) {} }
  function claims(t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return {}; } }
  // Google 登入回來時，Supabase 會把 token 放在網址 # 後面；收下後把網址改回首頁（app.js 的路由也用 #）
  var h = location.hash;
  if (/[#&](access_token|error)=/.test(h)) {
    var q = new URLSearchParams(h.replace(/^#/, ''));
    if (q.get('access_token')) {
      var c = claims(q.get('access_token'));
      A = { at: q.get('access_token'), rt: q.get('refresh_token'), exp: +q.get('expires_at') || Math.floor(Date.now() / 1000) + (+q.get('expires_in') || 3600), id: c.sub, email: c.email || '', fresh: true };
      store();
    } else err = q.get('error_description') || q.get('error') || '登入失敗';
    history.replaceState(null, '', location.pathname + location.search + '#/');
  }
  function token() {
    if (!A) return Promise.reject(new Error('not signed in'));
    if (A.exp - 60 > Date.now() / 1000) return Promise.resolve(A.at);
    return fetch(U + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: A.rt }) })
      .then(function (r) {
        if (r.status === 400 || r.status === 401) { A = null; store(); throw new Error('session expired'); }
        if (!r.ok) throw new Error('refresh ' + r.status);
        return r.json();
      })
      .then(function (j) { A.at = j.access_token; A.rt = j.refresh_token; A.exp = j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600); store(); return A.at; });
  }
  function rest(path, opt) {
    return token().then(function (t) {
      opt = opt || {}; opt.headers = Object.assign({ apikey: K, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, opt.headers || {});
      return fetch(U + '/rest/v1/' + path, opt).then(function (r) { if (!r.ok) throw new Error('rest ' + r.status); return r.status === 204 || r.status === 201 ? null : r.json(); });
    });
  }
  function push(rows) {
    if (!rows.length) return Promise.resolve();
    return rest(TB, { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows.map(function (x) { return { video_id: String(x.id), t: x.t }; })) });
  }
  window.Cloud = {
    user: function () { return A ? { id: A.id, email: A.email } : null; },
    error: function () { var e = err; err = ''; return e; },
    justSignedIn: function () { var f = !!(A && A.fresh); if (f) { delete A.fresh; store(); } return f; },
    signIn: function () { location.href = U + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname); },
    signOut: function () {
      var t = A && A.at; A = null; store();
      if (t) fetch(U + '/auth/v1/logout', { method: 'POST', headers: { apikey: K, Authorization: 'Bearer ' + t } }).catch(function () {});
    },
    // 聯集合併：雲端有、本機沒有的補進本機；本機有、雲端沒有的上傳。回傳合併後的 log
    sync: function (log) {
      return rest(TB + '?select=video_id,t&order=t.asc').then(function (rows) {
        var key = function (x) { return x.id + '@' + x.t; }, have = {}, out = log.slice(), remote = {};
        out.forEach(function (x) { have[key(x)] = 1; });
        (rows || []).forEach(function (r) { var x = { id: r.video_id, t: +r.t }; remote[key(x)] = 1; if (!have[key(x)]) { have[key(x)] = 1; out.push(x); } });
        out.sort(function (a, b) { return a.t - b.t; });
        return push(log.filter(function (x) { return !remote[key(x)]; })).then(function () { return out; });
      });
    },
    add: function (x) { if (A) push([x]).catch(function () {}); }  // 失敗不重試；下次開網站同步時會補上
  };
})();
