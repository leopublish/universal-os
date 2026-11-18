/* ТГЮУ · движок тестов. Данные теста — в window.QUIZ на странице теста. */
(function () {
  "use strict";
  const Z = window.QUIZ, I = window.QI || {};
  const KIT = document.currentScript.src.replace(/quiz\.js(\?.*)?$/, "");
  const ORG = "Ташкентский государственный юридический университет";
  const L = "АБВГДЕ";
  const app = document.getElementById("app");

  // ---------- утилиты ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (n) => I[n] || "";
  const mix = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const b64u = {
    enc(o) { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ""; b.forEach((x) => (s += String.fromCharCode(x))); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
    dec(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; const s = atob(t), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); },
  };
  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  const baseUrl = () => (Z.url || location.href.split("#")[0]);

  // ---------- тема ----------
  function setTheme(t) { document.documentElement.dataset.theme = t; store.set("tsul-theme", t); const b = $("#thm"); if (b) b.innerHTML = t === "dark" ? ic("sun") : ic("moon"); }
  const savedTheme = store.get("tsul-theme", null);
  setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

  // ---------- каркас ----------
  document.body.insertAdjacentHTML("afterbegin",
    '<header class="top"><div class="hin"><img src="' + KIT + 'logo.png" alt=""><div class="t"><b>' + esc(Z.subject) + '</b><span>' + ORG + '</span></div>' +
    (Z.catalog ? '<a class="ib" href="' + esc(Z.catalog) + '" title="Все тесты" aria-label="Все тесты">' + ic("home") + "</a>" : "") +
    (Z.slides ? '<button class="ib" id="hsl" type="button" title="Презентация" aria-label="Презентация">' + ic("slides") + "</button>" : "") +
    '<button class="ib" id="thm" type="button" title="Тема" aria-label="Сменить тему"></button></div></header>');
  setTheme(document.documentElement.dataset.theme);
  if (Z.slides) $("#hsl").onclick = () => slides(0);
  $("#thm").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  const view = (html) => { app.innerHTML = '<div class="view">' + html + "</div>"; window.scrollTo(0, 0); };

  // ---------- состояние ----------
  const N = Z.questions.length, PASS = Z.pass || 70, KEY = "tsul-quiz:" + Z.id;
  let S = null; // текущая попытка
  let tick = null;
  const person = store.get("tsul-person", { name: "", email: "" });

  // ---------- старт ----------
  function start() {
    clearInterval(tick);
    const hist = store.get(KEY, { best: null, n: 0 });
    view(
      '<div class="grid2"><div class="card">' +
      '<span class="eyebrow">' + ic("book") + " " + esc(Z.subject) + "</span>" +
      "<h1>" + esc(Z.title) + "</h1>" +
      '<p class="lead">' + esc(Z.description) + "</p>" +
      '<div class="chips"><span class="chip">' + ic("list") + N + ' вопросов</span><span class="chip">' + ic("watch") + Z.minutes + ' мин в экзамене</span><span class="chip">' + ic("target") + "Проходной балл " + PASS + '%</span><span class="chip">' + ic("cert") + "Сертификат</span></div>" +
      '<h3 style="margin-top:20px">Что проверяет тест</h3><ul class="topics">' + Z.topics.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul>" +
      (hist.best !== null ? '<div class="best">Ваш лучший результат: <b>' + hist.best + " из " + N + "</b> · попыток: " + hist.n + "</div>" : "") +
      '</div><div>' + (Z.slides ? '<div class="card pres"><button type="button" class="pthumb" id="pth" aria-label="Открыть презентацию"><img src="' + slideSrc(0) + '" alt="Первый слайд презентации" loading="lazy"><span class="pplay">' + ic("play") + '</span></button>' +
      '<div class="pinfo"><span class="eyebrow">' + ic("slides") + ' Перед тестом</span><h3>Презентация к теме</h3><p class="lead" style="margin:0 0 12px">' + Z.slides.n + ' слайдов. Повторите материал, а потом проверьте себя.</p>' +
      '<div class="row"><button class="btn sm" type="button" id="pop">' + ic("play") + 'Смотреть</button>' + (Z.slides.pptx ? '<a class="btn sm ghost" href="' + esc(Z.slides.pptx) + '" download>' + ic("ppt") + 'PPTX</a>' : "") + '</div></div></div>' : "") +
      '<div class="card"><h2>Начать</h2>' +
      '<div class="modes" role="radiogroup" aria-label="Режим">' +
      '<label class="mode"><input type="radio" name="md" value="learn" checked><span class="ic">' + ic("idea") + '</span><span><b>Обучение</b><small>Ответ и объяснение сразу после выбора, без таймера</small></span></label>' +
      '<label class="mode"><input type="radio" name="md" value="exam"><span class="ic">' + ic("clock") + "</span><span><b>Экзамен</b><small>Таймер " + Z.minutes + " мин, переход между вопросами, итог в конце</small></span></label></div>" +
      '<form id="sf" novalidate><label class="l" for="nm">Фамилия и имя</label><input class="in" id="nm" maxlength="60" autocomplete="name" placeholder="Например, Каримова Малика" value="' + esc(person.name) + '">' +
      '<label class="l" for="em">E-mail <small>— необязательно, для сертификата</small></label><input class="in" id="em" type="email" maxlength="80" autocomplete="email" placeholder="name@mail.uz" value="' + esc(person.email) + '">' +
      '<p class="err" id="se" aria-live="polite"></p><button class="btn w" type="submit">Начать тест ' + ic("right") + "</button></form>" +
      '<p class="hint">Клавиши: <kbd>1</kbd>–<kbd>4</kbd> выбор ответа, <kbd>Enter</kbd> дальше, <kbd>←</kbd> <kbd>→</kbd> навигация в экзамене.</p></div></div></div>' +
      "<footer>" + esc(Z.source || "") + "</footer>"
    );
    if (Z.slides) { $("#pth").onclick = () => slides(0); $("#pop").onclick = () => slides(0); }
    $("#sf").onsubmit = (e) => {
      e.preventDefault();
      const nm = $("#nm").value.trim().replace(/\s+/g, " "), em = $("#em").value.trim();
      if (nm.split(" ").length < 2) { $("#nm").classList.add("bad"); $("#se").textContent = "Впишите фамилию и имя"; $("#nm").focus(); return; }
      if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { $("#em").classList.add("bad"); $("#se").textContent = "Проверьте адрес почты"; $("#em").focus(); return; }
      person.name = nm; person.email = em; store.set("tsul-person", person);
      begin($("input[name=md]:checked").value, mix(Z.questions.map((_, i) => i)));
    };
  }

  function begin(mode, ids) {
    S = { mode, ids, full: ids.length === N, cur: 0, ans: {}, flags: {}, opt: {}, t0: Date.now(), t1: 0, done: false };
    ids.forEach((q) => (S.opt[q] = mix(Z.questions[q].o.map((_, k) => k))));
    clearInterval(tick);
    tick = setInterval(() => {
      const el = $("#tm"); if (!el || S.done) return;
      const used = (Date.now() - S.t0) / 1000;
      if (S.mode === "exam") { const left = Z.minutes * 60 - used; el.lastChild.textContent = fmt(left); el.classList.toggle("low", left < 120); if (left <= 0) finish(true); }
      else el.lastChild.textContent = fmt(used);
    }, 500);
    render();
  }

  // ---------- вопрос ----------
  function segClass(i) {
    const q = S.ids[i], a = S.ans[q];
    let c = i === S.cur ? "cur " : "";
    if (S.mode === "learn") { if (a !== undefined) c += a === 0 ? "ok" : "no"; }
    else { if (S.flags[q]) c += "f"; else if (a !== undefined) c += "a"; }
    return c;
  }
  function render() {
    const q = S.ids[S.cur], x = Z.questions[q], a = S.ans[q], learnDone = S.mode === "learn" && a !== undefined;
    const answered = Object.keys(S.ans).length;
    view(
      '<div class="bar"><div class="in2"><span class="cnt">Вопрос ' + (S.cur + 1) + " из " + S.ids.length + (S.mode === "exam" ? " · отвечено " + answered : "") + '</span>' +
      '<span class="timer" id="tm" aria-label="Время">' + ic("clock") + "<span>" + (S.mode === "exam" ? fmt(Z.minutes * 60 - (Date.now() - S.t0) / 1000) : fmt((Date.now() - S.t0) / 1000)) + "</span></span>" +
      (S.mode === "exam" ? '<button class="ib" id="ng" type="button" style="color:var(--ink);border-color:var(--line);background:var(--card)" title="Все вопросы" aria-label="Все вопросы">' + ic("grid") + "</button>" : "") +
      '</div><div class="segs">' + S.ids.map((_, i) => '<button type="button" class="' + segClass(i) + '" data-i="' + i + '" aria-label="Вопрос ' + (i + 1) + '"' + (S.mode === "learn" ? " tabindex=-1" : "") + "></button>").join("") + "</div></div>" +
      '<div class="card"><div class="qhead"><span class="eyebrow">' + ic("law") + " " + esc(x.t) + "</span>" +
      (S.mode === "exam" ? '<button class="flag' + (S.flags[q] ? " on" : "") + '" id="fl" type="button" aria-pressed="' + !!S.flags[q] + '">' + ic("flag") + "Отметить</button>" : "") + "</div>" +
      (x.c ? '<div class="case"><b>' + ic("case") + "Ситуация</b>" + esc(x.c) + "</div>" : "") +
      '<p class="qt">' + esc(x.q) + "</p>" +
      '<div class="ops' + (learnDone ? " locked" : "") + '" id="ops" role="group">' +
      S.opt[q].map((k, p) => {
        let c = "opt";
        if (S.mode === "exam" && a === k) c += " sel";
        if (learnDone) { if (k === 0) c += " ok"; else if (a === k) c += " no"; }
        const mk = learnDone && k === 0 ? ic("ok") : learnDone && a === k ? ic("no") : "";
        return '<button type="button" class="' + c + '" data-k="' + k + '" aria-pressed="' + (a === k) + '"><span class="k">' + L[p] + '</span><span class="tx">' + esc(x.o[k]) + '</span><span class="mk">' + mk + "</span></button>";
      }).join("") + "</div>" +
      (learnDone ? '<div class="fb ' + (a === 0 ? "ok" : "no") + '" aria-live="polite"><strong>' + (a === 0 ? "Верно!" : "Неверно. Правильно: " + esc(x.o[0])) + "</strong>" + esc(x.e) + '<br><span class="art">' + ic("book") + esc(x.a) + "</span></div>" : "") +
      '<div class="nav">' +
      (S.mode === "exam" ? '<button class="btn ghost" id="pv" type="button"' + (S.cur ? "" : " disabled") + ' aria-label="Назад">' + ic("left") + "</button>" : "") +
      (S.mode === "exam"
        ? (S.cur < S.ids.length - 1 ? '<button class="btn" id="nx" type="button">Далее ' + ic("right") + "</button>" : '<button class="btn gold" id="fin" type="button">Завершить тест</button>')
        : learnDone ? '<button class="btn" id="nx" type="button">' + (S.cur < S.ids.length - 1 ? "Следующий вопрос " + ic("right") : "Показать результат " + ic("right")) + "</button>" : "") +
      "</div>" +
      (S.mode === "exam" && S.cur < S.ids.length - 1 ? '<p class="hint" style="text-align:center"><a href="#" id="fin2">Завершить досрочно</a></p>' : "") +
      "</div>"
    );
    document.querySelectorAll("#ops .opt").forEach((b) => (b.onclick = () => pick(+b.dataset.k)));
    if (S.mode === "exam") document.querySelectorAll(".segs button").forEach((b) => (b.onclick = () => go(+b.dataset.i)));
    const on = (id, f) => { const e = $("#" + id); if (e) e.onclick = (ev) => { ev.preventDefault(); f(); }; };
    on("nx", next); on("pv", () => go(S.cur - 1)); on("fin", askFinish); on("fin2", askFinish); on("ng", navigator_);
    on("fl", () => { S.flags[q] = !S.flags[q]; render(); });
    if (learnDone) setTimeout(() => { const n = $("#nx"); n && n.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 120);
  }
  function pick(k) {
    const q = S.ids[S.cur];
    if (S.mode === "learn") { if (S.ans[q] !== undefined) return; S.ans[q] = k; render(); }
    else { S.ans[q] = k; render(); }
  }
  function go(i) { if (i < 0 || i >= S.ids.length) return; S.cur = i; render(); }
  function next() { if (S.cur < S.ids.length - 1) go(S.cur + 1); else if (S.mode === "learn") finish(); else askFinish(); }

  function navigator_() {
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="card" role="dialog" aria-modal="true" aria-label="Все вопросы"><h2>Все вопросы</h2><div class="navg">' +
      S.ids.map((q, i) => '<button type="button" data-i="' + i + '" class="' + (S.ans[q] !== undefined ? "a " : "") + (S.flags[q] ? "f " : "") + (i === S.cur ? "cur" : "") + '">' + (i + 1) + "</button>").join("") +
      '</div><div class="legend"><span><i style="background:var(--accent)"></i>Отвечен</span><span><i style="background:var(--flag)"></i>Отмечен</span><span><i style="border:1.5px solid var(--line)"></i>Без ответа</span></div>' +
      '<div class="row" style="margin-top:16px"><button class="btn ghost" type="button" id="mc">Закрыть</button><button class="btn gold" type="button" id="mf">Завершить тест</button></div></div>';
    document.body.appendChild(m);
    m.onclick = (e) => { if (e.target === m) m.remove(); };
    m.querySelectorAll(".navg button").forEach((b) => (b.onclick = () => { m.remove(); go(+b.dataset.i); }));
    $("#mc", m).onclick = () => m.remove();
    $("#mf", m).onclick = () => { m.remove(); askFinish(); };
  }
  function askFinish() {
    const left = S.ids.filter((q) => S.ans[q] === undefined).length, fl = S.ids.filter((q) => S.flags[q]).length;
    if (!left && !fl) return finish();
    const m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="card" role="dialog" aria-modal="true"><h2>Завершить тест?</h2><p class="lead">' +
      (left ? "Без ответа: <b>" + left + "</b>. Такие вопросы засчитываются как неверные. " : "") + (fl ? "Отмечено для проверки: <b>" + fl + "</b>." : "") +
      '</p><div class="row"><button class="btn ghost" type="button" id="mc">Вернуться</button><button class="btn gold" type="button" id="mf">Завершить</button></div></div>';
    document.body.appendChild(m);
    $("#mc", m).onclick = () => m.remove();
    $("#mf", m).onclick = () => { m.remove(); finish(); };
  }

  // ---------- клавиатура ----------
  document.addEventListener("keydown", (e) => {
    if (!S || S.done || $(".modal") || $(".sv") || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const n = "1234".indexOf(e.key);
    if (n >= 0) { const b = document.querySelectorAll("#ops .opt")[n]; if (b) b.click(); }
    else if (e.key === "Enter") { const b = $("#nx") || $("#fin"); if (b) { e.preventDefault(); b.click(); } }
    else if (S.mode === "exam" && e.key === "ArrowRight") go(S.cur + 1);
    else if (S.mode === "exam" && e.key === "ArrowLeft") go(S.cur - 1);
  });

  // ---------- итог ----------
  function finish(timeUp) {
    if (S.done) return;
    S.done = true; S.t1 = Date.now(); clearInterval(tick);
    const tot = S.ids.length, right = S.ids.filter((q) => S.ans[q] === 0).length, pct = Math.round((right / tot) * 100);
    let streak = 0, best = 0; S.ids.forEach((q) => { if (S.ans[q] === 0) { streak++; best = Math.max(best, streak); } else streak = 0; });
    const secs = Math.round((S.t1 - S.t0) / 1000), pass = S.full && pct >= PASS;
    S.res = { tot, right, pct, secs, best, pass };
    if (S.full) {
      const h = store.get(KEY, { best: null, n: 0 }); h.n++; h.best = Math.max(h.best || 0, right); store.set(KEY, h);
      if (pass) S.cert = { n: person.name, s: right, t: tot, d: new Date().toISOString().slice(0, 10), id: certId(), m: S.mode };
      report({ type: "result" });
    }
    if (timeUp) toast("Время вышло — тест завершён");
    results();
  }
  function certId() { const d = new Date(), p = (x) => String(x).padStart(2, "0"); return "TSUL-" + Z.code + "-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }

  function results() {
    const R = S.res, col = R.pct >= 85 ? "var(--ok)" : R.pct >= PASS ? "var(--accent)" : R.pct >= 50 ? "var(--warn)" : "var(--bad)";
    const grade = R.pct >= 93 ? "Отлично" : R.pct >= 73 ? "Хорошо" : R.pct >= 53 ? "Удовлетворительно" : "Нужно повторить тему";
    // темы
    const tp = {}; S.ids.forEach((q) => { const t = Z.questions[q].t; tp[t] = tp[t] || [0, 0]; tp[t][1]++; if (S.ans[q] === 0) tp[t][0]++; });
    const wrong = S.ids.filter((q) => S.ans[q] !== 0);
    view(
      '<div class="card"><div class="res-top"><div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" stroke-width="10"/><circle id="arc" cx="60" cy="60" r="52" fill="none" stroke="' + col + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="326.7" style="transition:stroke-dashoffset 1.2s ease"/></svg><div class="v"><b>' + R.pct + "%</b><span>" + R.right + " из " + R.tot + "</span></div></div>" +
      '<div><span class="eyebrow">' + (S.mode === "exam" ? "Экзамен" : "Обучение") + (S.full ? "" : " · работа над ошибками") + "</span><h1 style=\"font-size:clamp(24px,5.5vw,32px)\">" + esc(person.name) + "</h1>" +
      (S.full ? '<span class="verdict ' + (R.pass ? "pass" : "fail") + '">' + (R.pass ? ic("ok") + "Тест сдан · " + grade : ic("no") + "Не сдан · нужно " + PASS + "%") + "</span>" : '<span class="verdict pass">' + ic("redo") + grade + "</span>") +
      '<div class="stats"><div class="stat"><b>' + fmt(R.secs) + '</b><span>Время</span></div><div class="stat"><b>' + R.right + "/" + R.tot + '</b><span>Верных ответов</span></div><div class="stat"><b>' + R.best + '</b><span>Лучшая серия</span></div><div class="stat"><b>' + PASS + '%</b><span>Проходной балл</span></div></div></div></div></div>' +
      (S.cert ? '<div class="card" id="cbox"><h2>' + ic("cert") + ' Ваш сертификат</h2><p class="lead">Скачайте его, отправьте на почту или поделитесь в соцсетях.</p><div id="cimg" class="lead">Готовим сертификат…</div></div>' : "") +
      (S.full && !R.pass ? '<div class="card"><h2>Сертификат</h2><p class="lead" style="margin:0">Сертификат выдаётся при результате от ' + PASS + "% при прохождении всех " + N + " вопросов. Посмотрите разбор ниже и попробуйте ещё раз.</p></div>" : "") +
      '<div class="card"><h2>Результат по темам</h2><div class="tb">' + Object.keys(tp).map((t) => '<div class="r">' + esc(t) + "<span>" + tp[t][0] + "/" + tp[t][1] + '</span><div class="tr"><i data-w="' + Math.round((tp[t][0] / tp[t][1]) * 100) + '" style="width:0"></i></div></div>').join("") + "</div></div>" +
      '<div class="card"><h2>Разбор ответов</h2><div class="tabs" role="tablist"><button type="button" class="on" data-f="all">Все · ' + R.tot + '</button><button type="button" data-f="no">Ошибки · ' + wrong.length + '</button><button type="button" data-f="ok">Верные · ' + R.right + '</button></div><div id="rv"></div></div>' +
      '<div class="row" style="margin-top:16px"><button class="btn" type="button" id="again">' + ic("redo") + "Пройти заново</button>" + (wrong.length ? '<button class="btn ghost" type="button" id="redo">Работа над ошибками</button>' : "") + '<button class="btn ghost" type="button" id="home">К началу</button></div>'
    );
    setTimeout(() => { $("#arc").style.strokeDashoffset = 326.7 * (1 - R.pct / 100); document.querySelectorAll(".tr i").forEach((i) => (i.style.width = i.dataset.w + "%")); }, 60);
    const draw = (f) => {
      $("#rv").innerHTML = S.ids.filter((q) => f === "all" || (f === "ok") === (S.ans[q] === 0)).map((q) => {
        const x = Z.questions[q], a = S.ans[q], ok = a === 0;
        return '<div class="ri ' + (ok ? "ok" : "no") + '"><div class="h">' + (ok ? ic("ok") : ic("no")) + "<span>" + (x.c ? esc(x.c) + " " : "") + esc(x.q) + "</span></div>" +
          (ok ? '<p class="c">' + esc(x.o[0]) + "</p>" : '<p class="y">Ваш ответ: ' + (a === undefined ? "нет ответа" : esc(x.o[a])) + '</p><p class="c">Правильно: ' + esc(x.o[0]) + "</p>") +
          '<p class="e">' + esc(x.e) + " (" + esc(x.a) + ")</p></div>";
      }).join("") || '<p class="lead">Здесь пусто.</p>';
    };
    draw("all");
    document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b)); draw(b.dataset.f); }));
    $("#again").onclick = () => begin(S.mode, mix(Z.questions.map((_, i) => i)));
    const rd = $("#redo"); if (rd) rd.onclick = () => begin("learn", mix(wrong));
    $("#home").onclick = start;
    if (S.cert) { certPanel(S.cert); confetti(); }
  }

  // ---------- сертификат ----------
  const certLink = (c) => baseUrl() + "#cert=" + b64u.enc(c);
  let LOGO = null;
  async function logo() { if (LOGO) return LOGO; LOGO = new Image(); LOGO.src = KIT + "logo-white.png"; try { await LOGO.decode(); } catch (e) {} return LOGO; }
  async function drawCert(c) {
    try { await Promise.all([document.fonts.load('700 90px "PT Serif"', "СЕРТИФИКАТ"), document.fonts.load('400 30px "PT Sans"', "Сертификат"), document.fonts.load('700 30px "PT Sans"', "Сертификат")]); } catch (e) {}
    const lg = await logo();
    const W = 2000, H = 1414, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d"), SER = '"PT Serif",Georgia,serif', SAN = '"PT Sans",Arial,sans-serif';
    const ls = (v) => { if ("letterSpacing" in x) x.letterSpacing = v; };
    const tx = (s, px, py, f, col, al, sp) => { x.font = f; x.fillStyle = col; x.textAlign = al || "left"; ls(sp || "0px"); x.fillText(s, px, py); ls("0px"); };
    const fit = (s, f0, max, w) => { let f = f0; x.font = w.replace("$", f); while (x.measureText(s).width > max && f > 40) { f -= 3; x.font = w.replace("$", f); } return w.replace("$", f); };
    // фон
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
    // левая панель
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#14213d"); g.addColorStop(1, "#1c2f57");
    x.fillStyle = g; x.fillRect(0, 0, 560, H);
    x.globalAlpha = 0.07; x.strokeStyle = "#e8d39a"; x.lineWidth = 2;
    for (let r = 80; r < 900; r += 46) { x.beginPath(); x.arc(560, H, r, Math.PI, 1.5 * Math.PI); x.stroke(); }
    x.globalAlpha = 1;
    if (lg.naturalWidth) x.drawImage(lg, 150, 140, 260, 260);
    tx("ТАШКЕНТСКИЙ", 280, 470, "700 27px " + SAN, "#e8d39a", "center", "6px");
    tx("ГОСУДАРСТВЕННЫЙ", 280, 510, "700 27px " + SAN, "#e8d39a", "center", "6px");
    tx("ЮРИДИЧЕСКИЙ", 280, 550, "700 27px " + SAN, "#e8d39a", "center", "6px");
    tx("УНИВЕРСИТЕТ", 280, 590, "700 27px " + SAN, "#e8d39a", "center", "6px");
    // печать с баллом
    const pc = Math.round((c.s / c.t) * 100);
    x.save(); x.translate(280, 860);
    x.fillStyle = "#c9a24a"; x.beginPath();
    for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r = i % 2 ? 150 : 165; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
    x.fillStyle = "#e8d39a"; x.beginPath(); x.arc(0, 0, 128, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "#a07c2c"; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 116, 0, Math.PI * 2); x.stroke();
    tx(pc + "%", 0, 22, "700 76px " + SER, "#14213d", "center");
    tx(c.s + " ИЗ " + c.t, 0, 72, "700 26px " + SAN, "#5a4410", "center", "3px");
    x.restore();
    // QR
    const url = certLink(c);
    if (window.qrcode) {
      const q = window.qrcode(0, "M"); q.addData(url); q.make();
      const n = q.getModuleCount(), size = 230, cell = size / n, ox = 165, oy = 1080;
      x.fillStyle = "#ffffff"; x.fillRect(ox - 14, oy - 14, size + 28, size + 28);
      x.fillStyle = "#14213d";
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(ox + k * cell, oy + r * cell, Math.ceil(cell), Math.ceil(cell));
    }
    tx("Проверить сертификат", 280, 1370, "400 22px " + SAN, "#c9cfdd", "center");
    // правая часть
    const L0 = 680, R0 = 1880;
    x.strokeStyle = "#e3dcc6"; x.lineWidth = 2; x.strokeRect(610, 50, 1340, H - 100);
    tx("СЕРТИФИКАТ", L0, 250, "700 112px " + SER, "#14213d", "left", "10px");
    tx("О ПРОХОЖДЕНИИ ТЕСТА", L0, 315, "700 32px " + SAN, "#c9a24a", "left", "8px");
    tx("Настоящий сертификат выдан", L0, 445, "400 36px " + SAN, "#5d6779");
    x.fillStyle = "#1c2f57"; x.font = fit(c.n, 104, R0 - L0, "700 $px " + SER); x.textAlign = "left"; x.fillText(c.n, L0, 570);
    x.fillStyle = "#c9a24a"; x.fillRect(L0, 612, 180, 6);
    tx("за успешное прохождение теста", L0, 700, "400 36px " + SAN, "#5d6779");
    // название теста с переносом
    x.font = "700 52px " + SER; x.fillStyle = "#141a28";
    const words = ("«" + Z.title + "»").split(" "); let line = "", y = 775;
    for (const w of words) { const t = line ? line + " " + w : w; if (x.measureText(t).width > R0 - L0 && line) { x.fillText(line, L0, y); line = w; y += 62; } else line = t; }
    x.fillText(line, L0, y);
    tx(Z.subject + " · " + (c.m === "exam" ? "режим экзамена" : "режим обучения"), L0, y + 58, "400 32px " + SAN, "#5d6779");
    // низ
    const dt = new Date(c.d + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    // описание теста
    x.font = "400 30px " + SAN; x.fillStyle = "#8a93a6";
    let dl = "", dy = y + 130, dn = 0;
    for (const w of (Z.description || "").split(" ")) { const t = dl ? dl + " " + w : w; if (x.measureText(t).width > R0 - L0 && dl) { if (dn < 2) x.fillText(dl, L0, dy); dl = w; dy += 42; dn++; } else dl = t; }
    if (dn < 3) x.fillText(dl, L0, dy);
    const by = 1200;
    x.strokeStyle = "#c9cfdd"; x.lineWidth = 2;
    [[L0, 330, dt, "ДАТА ВЫДАЧИ"], [L0 + 380, 420, c.id, "НОМЕР СЕРТИФИКАТА"]].forEach(([px, w, top, lab]) => {
      tx(top, px, by, "700 30px " + SAN, "#141a28");
      x.beginPath(); x.moveTo(px, by + 26); x.lineTo(px + w, by + 26); x.stroke();
      tx(lab, px, by + 66, "700 22px " + SAN, "#8a93a6", "left", "3px");
    });
    tx("Платформа тестов ТГЮУ", R0, by, "italic 400 30px " + SER, "#1c2f57", "right");
    x.beginPath(); x.moveTo(R0 - 320, by + 26); x.lineTo(R0, by + 26); x.stroke();
    tx("ВЫДАН АВТОМАТИЧЕСКИ", R0, by + 66, "700 22px " + SAN, "#8a93a6", "right", "3px");
    return cv;
  }
  const toBlob = (cv, type, q) => new Promise((ok) => cv.toBlob(ok, type, q));
  const fileBase = (c) => "sertifikat-" + Z.code.toLowerCase() + "-" + c.n.replace(/[^\p{L}\p{N}]+/gu, "-");
  function save(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 6000); }

  async function certPanel(c, mount) {
    const cv = await drawCert(c), link = certLink(c), pc = Math.round((c.s / c.t) * 100);
    const text = "Мой результат в тесте «" + Z.title + "» (" + Z.subject + ", ТГЮУ): " + pc + "% — " + c.s + " из " + c.t + ". Сертификат №" + c.id;
    const enc = encodeURIComponent, d = new Date(c.d);
    const li = "https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=" + enc(Z.subject + ": " + Z.title) + "&organizationName=" + enc(ORG) + "&issueYear=" + d.getFullYear() + "&issueMonth=" + (d.getMonth() + 1) + "&certUrl=" + enc(link) + "&certId=" + enc(c.id);
    const box = mount || $("#cimg");
    const canShareFile = !!(navigator.canShare && window.File);
    box.className = "";
    box.innerHTML =
      '<img class="certimg" alt="Сертификат: ' + esc(c.n) + '" src="' + cv.toDataURL("image/jpeg", 0.9) + '">' +
      '<div class="row" style="margin-top:12px"><button class="btn" type="button" id="dpng">' + ic("img") + 'PNG</button><button class="btn" type="button" id="dpdf">' + ic("pdf") + "PDF</button>" +
      (canShareFile ? '<button class="btn gold" type="button" id="nshare">' + ic("share") + "Поделиться</button>" : "") + "</div>" +
      '<h3 style="margin-top:20px">Поделиться в соцсетях</h3><div class="share">' +
      '<a class="sh tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + enc(link) + "&text=" + enc(text) + '">' + ic("tg") + "Telegram</a>" +
      '<a class="sh wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + enc(text + "\n" + link) + '">' + ic("wa") + "WhatsApp</a>" +
      '<a class="sh li" target="_blank" rel="noopener" href="' + li + '">' + ic("li") + "В профиль LinkedIn</a>" +
      '<a class="sh li" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + enc(link) + '">' + ic("plus") + "Пост в LinkedIn</a>" +
      '<a class="sh fb" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + enc(link) + '">' + ic("fb") + "Facebook</a>" +
      '<a class="sh x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + enc(text) + "&url=" + enc(link) + '">' + ic("x") + "X</a>" +
      '<a class="sh vk" target="_blank" rel="noopener" href="https://vk.com/share.php?url=' + enc(link) + "&title=" + enc(text) + '">' + ic("vk") + "VK</a>" +
      '<button class="sh cp" type="button" id="cpy">' + ic("link") + "Копировать ссылку</button></div>" +
      '<p class="note">В Instagram и другие приложения удобнее отправить сам файл: кнопка «Поделиться» на телефоне или скачанный PNG.</p>' +
      '<h3 style="margin-top:20px">Отправить на почту</h3><div class="mailrow"><input class="in" id="mto" type="email" placeholder="name@mail.uz" value="' + esc(person.email) + '" aria-label="E-mail"><button class="btn" type="button" id="msend">' + ic("send") + "Отправить</button></div>" +
      '<p class="note" id="mnote">' + (Z.sheetUrl ? "Сертификат придёт письмом с вложением." : "Откроется ваша почтовая программа со ссылкой на сертификат.") + "</p>";
    $("#dpng").onclick = async () => save(await toBlob(cv, "image/png"), fileBase(c) + ".png");
    $("#dpdf").onclick = async () => {
      const b = $("#dpdf"); b.disabled = true;
      try {
        if (!window.jspdf) await loadScript(KIT + "jspdf.umd.min.js");
        const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "px", format: [2000, 1414], hotfixes: ["px_scaling"] });
        pdf.setProperties({ title: "Сертификат " + c.id, author: ORG, subject: Z.title });
        pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 2000, 1414);
        pdf.save(fileBase(c) + ".pdf");
      } catch (e) { toast("Не удалось создать PDF, скачайте PNG"); }
      b.disabled = false;
    };
    const ns = $("#nshare");
    if (ns) ns.onclick = async () => {
      try {
        const f = new File([await toBlob(cv, "image/png")], fileBase(c) + ".png", { type: "image/png" });
        const data = navigator.canShare({ files: [f] }) ? { files: [f], title: "Сертификат", text: text + "\n" + link } : { title: "Сертификат", text, url: link };
        await navigator.share(data);
      } catch (e) { if (e && e.name !== "AbortError") toast("Не удалось поделиться"); }
    };
    $("#cpy").onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Ссылка скопирована"); } catch (e) { prompt("Скопируйте ссылку:", link); } };
    $("#msend").onclick = async () => {
      const to = $("#mto").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { $("#mto").classList.add("bad"); $("#mto").focus(); return; }
      $("#mto").classList.remove("bad"); person.email = to; store.set("tsul-person", person);
      if (Z.sheetUrl) {
        const sm = document.createElement("canvas"); sm.width = 1400; sm.height = 990; sm.getContext("2d").drawImage(cv, 0, 0, 1400, 990);
        const img = sm.toDataURL("image/jpeg", 0.85).split(",")[1];
        $("#msend").disabled = true; $("#mnote").textContent = "Отправляем…";
        const ok = await report({ type: "email", to, img, link, cert: c.id, pct: pc });
        $("#msend").disabled = false;
        $("#mnote").textContent = ok ? "Готово! Письмо с сертификатом отправлено на " + to + ". Проверьте также папку «Спам»." : "Не получилось отправить. Попробуйте ещё раз.";
      } else {
        const body = "Здравствуйте!\n\n" + text + ".\n\nСертификат: " + link + "\n\n(Если нужен файл, приложите скачанный PNG или PDF.)";
        location.href = "mailto:" + encodeURIComponent(to) + "?subject=" + enc("Сертификат: " + Z.title) + "&body=" + enc(body);
      }
    };
  }

  // ---------- отчёт в таблицу ----------
  function report(extra) {
    if (!Z.sheetUrl || !S) return Promise.resolve(false);
    const R = S.res || {};
    const d = Object.assign({ test: Z.title, code: Z.code, name: person.name, email: person.email, mode: S.mode, score: R.right, total: R.tot, pct: R.pct, secs: R.secs, pass: !!R.pass, cert: S.cert ? S.cert.id : "" }, extra);
    return fetch(Z.sheetUrl, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(d) }).then(() => true).catch(() => false);
  }

  // ---------- конфетти ----------
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = document.createElement("canvas"); c.id = "confetti"; document.body.appendChild(c);
    const x = c.getContext("2d"), W = (c.width = innerWidth), H = (c.height = innerHeight), cols = ["#c9a24a", "#e8d39a", "#1c2f57", "#2e7d4f", "#ffffff"];
    const P = [...Array(140)].map(() => ({ x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.3, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, r: Math.random() * 6 + 4, c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6 }));
    let f = 0;
    (function loop() {
      x.clearRect(0, 0, W, H);
      P.forEach((p) => { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += 0.2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
      if (++f < 160) requestAnimationFrame(loop); else c.remove();
    })();
  }

  // ---------- просмотр сертификата по ссылке ----------
  async function certView(c) {
    view('<div class="card"><span class="eyebrow">' + ic("cert") + ' Сертификат участника</span><h1>' + esc(c.n) + '</h1><p class="lead">Тест «' + esc(Z.title) + "» · " + Math.round((c.s / c.t) * 100) + "% (" + c.s + " из " + c.t + ") · №" + esc(c.id) + '</p><div id="cv1" class="lead">Загружаем сертификат…</div></div>' +
      '<div class="card"><h2>Хотите проверить себя?</h2><p class="lead">' + esc(Z.description) + '</p><a class="btn w" href="' + esc(baseUrl()) + '">Пройти тест ' + ic("right") + "</a></div>");
    const cv = await drawCert(c);
    $("#cv1").innerHTML = '<img class="certimg" alt="Сертификат" src="' + cv.toDataURL("image/jpeg", 0.9) + '"><div class="row" style="margin-top:12px"><button class="btn" type="button" id="d1">' + ic("img") + "Скачать PNG</button></div>";
    $("#d1").onclick = async () => save(await toBlob(cv, "image/png"), fileBase(c) + ".png");
  }


  // ---------- презентация ----------
  function slideSrc(i) { return "slides/s-" + String(i + 1).padStart(2, "0") + ".jpg"; }
  function slides(from) {
    if ($(".sv")) return;
    const n = Z.slides.n; let i = from || 0;
    const v = document.createElement("div"); v.className = "sv"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Презентация");
    v.innerHTML = '<div class="svtop"><b>' + esc(Z.title) + '</b><span id="svc"></span>' +
      (Z.slides.pptx ? '<a class="ib" href="' + esc(Z.slides.pptx) + '" download title="Скачать PPTX" aria-label="Скачать PPTX">' + ic("dl") + "</a>" : "") +
      '<button class="ib" type="button" id="svx" title="Закрыть" aria-label="Закрыть">' + ic("close") + '</button></div>' +
      '<div class="svstage"><button class="svnav l" type="button" id="svp" aria-label="Предыдущий слайд">' + ic("left") + '</button><img id="svi" alt=""><button class="svnav r" type="button" id="svn" aria-label="Следующий слайд">' + ic("right") + "</button></div>" +
      '<div class="svbottom"><div class="svthumbs">' + [...Array(n)].map((_, k) => '<button type="button" data-k="' + k + '" aria-label="Слайд ' + (k + 1) + '"><img src="' + slideSrc(k) + '" alt="" loading="lazy"></button>').join("") + "</div>" +
      '<button class="btn gold sm" type="button" id="svgo">Перейти к тесту ' + ic("right") + "</button></div>";
    document.body.appendChild(v); document.body.style.overflow = "hidden";
    const img = $("#svi", v), th = v.querySelectorAll(".svthumbs button");
    const show = (k) => {
      i = Math.max(0, Math.min(n - 1, k));
      img.src = slideSrc(i); img.alt = "Слайд " + (i + 1) + " из " + n;
      $("#svc", v).textContent = (i + 1) + " / " + n;
      $("#svp", v).disabled = i === 0; $("#svn", v).disabled = i === n - 1;
      th.forEach((b, k2) => b.classList.toggle("on", k2 === i));
      th[i].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      [i - 1, i + 1].forEach((k2) => { if (k2 >= 0 && k2 < n) new Image().src = slideSrc(k2); });
      $("#svgo", v).classList.toggle("pulse", i === n - 1);
    };
    const close = () => { v.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
    const key = (e) => { if (e.key === "Escape") close(); else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(i + 1); } else if (e.key === "ArrowLeft") show(i - 1); };
    document.addEventListener("keydown", key);
    $("#svx", v).onclick = close;
    $("#svp", v).onclick = () => show(i - 1);
    $("#svn", v).onclick = () => show(i + 1);
    th.forEach((b) => (b.onclick = () => show(+b.dataset.k)));
    $("#svgo", v).onclick = () => { close(); if (!S || S.done) { start(); setTimeout(() => { const f = $("#nm"); f && f.focus(); }, 50); } };
    let x0 = null;
    img.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    img.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
    img.onclick = (e) => { const r = img.getBoundingClientRect(); show(i + (e.clientX - r.left > r.width / 2 ? 1 : -1)); };
    show(i); $("#svx", v).focus();
  }

  // ---------- запуск ----------
  function route() {
    const m = location.hash.match(/^#cert=([\w-]+)/);
    if (m) { try { const c = b64u.dec(m[1]); if (c && c.n && c.id) return certView(c); } catch (e) {} }
    start();
  }
  window.addEventListener("hashchange", route);
  route();
})();
