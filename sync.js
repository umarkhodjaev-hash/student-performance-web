/* Sign in with Google and sync progress (Firebase). Loaded on every page. */
(function () {
  "use strict";
  var CFG = {
    apiKey: "AIzaSyB8CI8qHrkxMgUZDCNH066-TsYNC5FQUgk",
    authDomain: "studentpp-99f45.firebaseapp.com",
    projectId: "studentpp-99f45",
    appId: "1:953656481723:web:731324b607fc1be0edd69e"
  };
  var KEYS = ["act", "history", "last", "fx_stats", "qbest", "fx_name", "exam", "fx_sub", "fx_subj_list", "cards_v1"];
  var TXT = {
    ru: { in: "Войти", tip: "Войти через Google, чтобы сохранить прогресс", out: "Выйти?", err: "Не удалось войти. Нажми ещё раз." },
    en: { in: "Sign in", tip: "Sign in with Google to save your progress", out: "Sign out?", err: "Could not sign in. Tap again." },
    uz: { in: "Kirish", tip: "Progressni saqlash uchun Google orqali kiring", out: "Chiqasizmi?", err: "Kirib bo'lmadi. Yana bosing." }
  };
  function L() { var l = window.getLang ? window.getLang() : "en"; return TXT[l] || TXT.en; }

  var S = { user: null, state: "idle", lastSync: 0, error: "" }, fb = null, loading = null, timer = null, lastStr = "", armed = false, btn = null, listeners = [];

  function emit(kind) {
    S.kind = kind || "state";
    listeners.forEach(function (f) { try { f(S); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent("studentpp-sync", { detail: kind || "state" })); } catch (e) {}
    paint();
  }

  /* ---------- Firebase loading ---------- */
  function load() {
    if (fb) return Promise.resolve(fb);
    if (window.FB_TEST) { fb = window.FB_TEST; return Promise.resolve(fb); }
    if (loading) return loading;
    var B = "https://www.gstatic.com/firebasejs/10.12.2/";
    loading = Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]).then(function (m) {
      var A = m[0], U = m[1], F = m[2], app = A.initializeApp(CFG), auth = U.getAuth(app), db = F.getFirestore(app);
      fb = {
        onAuth: function (cb) { U.onAuthStateChanged(auth, cb); },
        signIn: function () { return U.signInWithPopup(auth, new U.GoogleAuthProvider()); },
        signOut: function () { return U.signOut(auth); },
        get: function (uid) { return F.getDoc(F.doc(db, "users", uid)).then(function (d) { return d.exists() ? d.data().d : null; }); },
        set: function (uid, str) { return F.setDoc(F.doc(db, "users", uid), { d: str, u: Date.now() }); }
      };
      return fb;
    }).catch(function (e) { loading = null; throw e; });
    return loading;
  }

  /* ---------- local data ---------- */
  function rd(k) { try { var v = localStorage.getItem(k); if (v === null) return null; return k === "fx_name" ? v : JSON.parse(v); } catch (e) { return null; } }
  function snap() { var o = {}; KEYS.forEach(function (k) { var v = rd(k); if (v !== null) o[k] = v; }); return o; }
  function apply(o) {
    KEYS.forEach(function (k) { try { if (o[k] !== undefined && o[k] !== null) localStorage.setItem(k, k === "fx_name" ? String(o[k]) : JSON.stringify(o[k])); } catch (e) {} });
  }
  function maxMap(a, b) { var o = {}, k; a = a || {}; b = b || {}; for (k in a) o[k] = a[k]; for (k in b) o[k] = Math.max(o[k] || 0, b[k] || 0); return o; }
  function merge(a, b) {
    b = b || {}; var o = {}, k;
    var days = {}, da = (a.act && a.act.days) || {}, db = (b.act && b.act.days) || {};
    for (k in da) days[k] = da[k];
    for (k in db) days[k] = days[k] ? maxMap(days[k], db[k]) : db[k];
    var xp = 0; for (k in days) xp += days[k].xp || 0;
    if (Object.keys(days).length) o.act = { days: days, xp: xp };
    var seen = {}, h = (a.history || []).concat(b.history || []).filter(function (r) { if (!r || seen[r.t]) return false; seen[r.t] = 1; return true; });
    h.sort(function (x, y) { return x.t - y.t; }); if (h.length > 12) h = h.slice(h.length - 12);
    if (h.length) o.history = h;
    var ta = (a.history || []).length ? a.history[a.history.length - 1].t : 0, tb = (b.history || []).length ? b.history[b.history.length - 1].t : 0;
    var lastv = ta >= tb ? (a.last || b.last) : (b.last || a.last);
    if (lastv) o.last = lastv;
    var fa = a.fx_stats, fbb = b.fx_stats;
    if (fa || fbb) o.fx_stats = { days: maxMap(fa && fa.days, fbb && fbb.days), ses: maxMap(fa && fa.ses, fbb && fbb.ses) };
    if (a.qbest || b.qbest) o.qbest = maxMap(a.qbest, b.qbest);
    var nm = a.fx_name || b.fx_name; if (nm) o.fx_name = nm;
    var ex = a.exam || b.exam; if (ex) o.exam = ex;
    if (a.fx_sub || b.fx_sub) {
      var sd = {}, xa = (a.fx_sub && a.fx_sub.days) || {}, xb = (b.fx_sub && b.fx_sub.days) || {};
      for (k in xa) sd[k] = xa[k];
      for (k in xb) sd[k] = sd[k] ? maxMap(sd[k], xb[k]) : xb[k];
      o.fx_sub = { days: sd };
    }
    var sl = (a.fx_subj_list || []).concat(b.fx_subj_list || []).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).slice(0, 8);
    if (sl.length) o.fx_subj_list = sl;
    if (a.cards_v1 || b.cards_v1) {
      var ca = a.cards_v1 || { prog: {}, custom: [] }, cb = b.cards_v1 || { prog: {}, custom: [] }, pr = {}, ids = {}, cu = [];
      for (k in ca.prog) pr[k] = ca.prog[k];
      for (k in cb.prog) { var r1 = pr[k], r2 = cb.prog[k]; pr[k] = !r1 ? r2 : (r2.b > r1.b || (r2.b === r1.b && r2.d > r1.d)) ? r2 : r1; }
      (ca.custom || []).concat(cb.custom || []).forEach(function (c) { if (c && !ids[c.id]) { ids[c.id] = 1; cu.push(c); } });
      o.cards_v1 = { prog: pr, custom: cu.slice(0, 200), newDay: ca.newDay || cb.newDay || "", newN: ca.newDay ? ca.newN : (cb.newN || 0) };
    }
    return o;
  }

  /* ---------- sync ---------- */
  function sync(force) {
    if (!S.user || !fb) return Promise.resolve();
    S.state = "busy"; emit();
    return fb.get(S.user.uid).then(function (remote) {
      var rem = null; try { rem = remote ? JSON.parse(remote) : null; } catch (e) {}
      var out = force ? snap() : merge(snap(), rem);
      if (!force) apply(out);
      var str = JSON.stringify(out); lastStr = str;
      var p = (str !== remote) ? fb.set(S.user.uid, str) : Promise.resolve();
      return p.then(function () {
        S.state = "ok"; S.lastSync = Date.now();
        var ns = document.getElementById("navStreak"); if (ns && window.actStreak) ns.textContent = window.actStreak();
        emit("synced");
      });
    }).catch(function () { S.state = "err"; emit(); });
  }
  function onUser(u) {
    S.user = u || null; S.state = "idle";
    if (timer) { clearInterval(timer); timer = null; }
    try { if (u) localStorage.setItem("fb_on", "1"); else localStorage.removeItem("fb_on"); } catch (e) {}
    emit();
    if (u) { sync(); timer = setInterval(function () { sync(); }, 60000); }
  }
  function start() {
    return load().then(function (f) { f.onAuth(onUser); return f; });
  }
  function signIn() {
    S.state = "busy"; S.error = ""; emit();
    return load().then(function (f) {
      if (!started) { started = true; f.onAuth(onUser); }
      return f.signIn();
    }).then(function () { S.state = S.user ? "ok" : "idle"; emit(); })
      .catch(function (e) {
        var code = e && e.code || "";
        S.state = (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") ? "idle" : "err"; S.error = code; emit();
      });
  }
  function signOut() { return load().then(function (f) { return f.signOut(); }).then(function () { S.state = "idle"; emit(); }); }
  var started = false;

  /* ---------- nav button ---------- */
  function paint() {
    if (!btn) return;
    var t = L(), name = S.user ? (S.user.displayName || S.user.email || "").split(" ")[0].slice(0, 10) : "";
    if (armed && S.user) { btn.innerHTML = '<span class="t">' + esc(t.out) + "</span>"; btn.title = t.out; }
    else if (S.user) { btn.innerHTML = "☁️" + (S.state === "busy" ? "…" : S.state === "err" ? " ⚠️" : " ✓") + ' <span class="t">' + esc(name) + "</span>"; btn.title = name; }
    else if (S.state === "busy") { btn.innerHTML = "⏳"; btn.title = ""; }
    else if (S.state === "err") { btn.innerHTML = "⚠️ " + '<span class="t">' + esc(t.in) + "</span>"; btn.title = t.err; }
    else { btn.innerHTML = "👤 " + '<span class="t">' + esc(t.in) + "</span>"; btn.title = t.tip; }
  }
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function inject() {
    if (btn) return true;
    var tools = document.querySelector("#nav .tools");
    if (!tools) return false;
    var st = document.createElement("style");
    st.textContent = "#navAcc{white-space:nowrap}@media(max-width:820px){#navAcc .t{display:none}}";
    document.head.appendChild(st);
    btn = document.createElement("button"); btn.className = "chip"; btn.id = "navAcc"; btn.type = "button";
    tools.insertBefore(btn, document.getElementById("burger"));
    var pre = function () { load().catch(function () {}); };
    ["pointerenter", "touchstart", "focus"].forEach(function (ev) { btn.addEventListener(ev, pre, { once: true, passive: true }); });
    btn.onclick = function () {
      if (S.user) {
        if (!armed) { armed = true; paint(); setTimeout(function () { armed = false; paint(); }, 3000); return; }
        armed = false; signOut(); return;
      }
      signIn();
    };
    paint();
    return true;
  }
  function boot() {
    if (!inject()) {
      var n = 0, iv = setInterval(function () { if (inject() || ++n > 40) clearInterval(iv); }, 100);
    }
    var old = window.onLang; window.onLang = function () { if (old) old(); paint(); };
    document.addEventListener("visibilitychange", function () { if (document.hidden && S.user) sync(); });
    var on = false; try { on = localStorage.getItem("fb_on") === "1"; } catch (e) {}
    if (on || window.FB_TEST && window.FB_TEST.autostart) { started = true; start().catch(function () { S.state = "err"; emit(); }); }
    emit("ready");
  }

  window.Sync = {
    get: function () { return S; },
    signIn: signIn, signOut: signOut,
    force: function () { return sync(true); },
    on: function (f) { listeners.push(f); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
