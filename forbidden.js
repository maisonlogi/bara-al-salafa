(() => {
  "use strict";

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function uniqueCards() {
    const seen = {};
    const out = [];
    (window.FORBIDDEN_CARDS || []).forEach(function (c) {
      const key = (c.word || "").trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({ topic: c.topic, word: key });
    });
    return out;
  }

  function createState() {
    return {
      step: "fw-home",
      playerCount: 3,
      players: ["", "", ""],
      assignments: [],
      revealIndex: 0,
      playSeconds: 180,
      playTimerId: null,
    };
  }

  function deal(state) {
    const pool = shuffle(uniqueCards());
    state.assignments = pool.slice(0, state.playerCount);
    state.revealIndex = 0;
    state.playSeconds = 180;
    clearTimer(state);
  }

  function clearTimer(state) {
    if (state.playTimerId) {
      clearInterval(state.playTimerId);
      state.playTimerId = null;
    }
  }

  function formatTime(total) {
    const m = Math.floor(Math.max(0, total) / 60);
    const s = Math.max(0, total) % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function topBar() {
    return (
      '<div class="topbar">' +
      '<div class="topbar-brand">الكلمة الممنوعة</div>' +
      '<button class="icon-btn" data-action="fw-exit" type="button">الألعاب</button>' +
      "</div>"
    );
  }

  function render(state, ctx) {
    const map = {
      "fw-home": renderHome,
      "fw-setup": renderSetup,
      "fw-pass": renderPass,
      "fw-role": renderRole,
      "fw-play": renderPlay,
      "fw-reveal": renderReveal,
    };
    return (map[state.step] || renderHome)(state, ctx);
  }

  function renderHome(state, ctx) {
    return ctx.el(
      '<section class="screen">' +
        topBar() +
        '<header class="brand">' +
        "<h1>الكلمة الممنوعة</h1>" +
        "<p>كل واحد عنده كلمة واحدة ممنوعة. هو ما يشوفها — الباقي يعرفونها ويحاولون يستدرجوه.</p>" +
        "</header>" +
        '<div class="panel"><h2>كيف تلعبون؟</h2><ul class="howto">' +
        '<li><span class="num">1</span><div><strong>توزّع الكلمات عشوائي</strong><p>ما تختارون موضوع. كل لاعب يأخذ كلمة ممنوعة واحدة.</p></div></li>' +
        '<li><span class="num">2</span><div><strong>مرّروا الجوال</strong><p>تشوف كلمة كل واحد من الباقي. كلمتك أنت مخفية.</p></div></li>' +
        '<li><span class="num">3</span><div><strong>تكلّموا مع بعض</strong><p>حاولوا تخلّونه ينطق كلمته، وهو كذلك معكم. اللي ينطق خسر.</p></div></li>' +
        "</ul></div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-setup">ابدأ</button>' +
        '<button class="btn btn-ghost" data-action="fw-exit">رجوع للألعاب</button>' +
        "</div></section>"
    );
  }

  function renderSetup(state, ctx) {
    const fields = state.players
      .map(function (name, i) {
        return (
          '<div class="field"><label for="fw-p' +
          i +
          '">اللاعب ' +
          (i + 1) +
          "</label>" +
          '<input id="fw-p' +
          i +
          '" data-fw-player="' +
          i +
          '" maxlength="20" placeholder="اكتب الاسم" value="' +
          ctx.escapeAttr(name) +
          '" autocomplete="off" /></div>'
        );
      })
      .join("");

    const screen = ctx.el(
      '<section class="screen">' +
        topBar() +
        '<header class="brand compact"><h1>اللاعبين</h1><p>2 أو 3 أو 4 — الكلمات تتوزع عشوائي</p></header>' +
        '<div class="panel"><h2>العدد</h2>' +
        '<div class="choice-grid" style="margin-bottom:16px">' +
        countBtn(state, 2, "كل واحد يعرف كلمة الثاني") +
        countBtn(state, 3, "كل واحد يعرف كلمتين") +
        countBtn(state, 4, "كل واحد يعرف ثلاث كلمات") +
        "</div><h2>الأسماء</h2>" +
        fields +
        "</div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-deal">وزّع الكلمات</button>' +
        '<button class="btn btn-ghost" data-action="fw-home">رجوع</button>' +
        "</div></section>"
    );

    screen.querySelectorAll("[data-fw-count]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const n = Number(btn.getAttribute("data-fw-count"));
        state.playerCount = n;
        while (state.players.length < n) state.players.push("");
        state.players = state.players.slice(0, n);
        if (window.__forbiddenRerender) window.__forbiddenRerender();
      });
    });
    screen.querySelectorAll("[data-fw-player]").forEach(function (input) {
      input.addEventListener("input", function (e) {
        state.players[Number(e.target.getAttribute("data-fw-player"))] = e.target.value;
      });
    });
    return screen;
  }

  function countBtn(state, n, hint) {
    const on = state.playerCount === n ? " selected" : "";
    return (
      '<button class="choice' +
      on +
      '" data-fw-count="' +
      n +
      '" type="button"><strong>' +
      n +
      " لاعبين</strong><span>" +
      hint +
      "</span></button>"
    );
  }

  function renderPass(state, ctx) {
    const name = state.players[state.revealIndex];
    return ctx.el(
      '<section class="screen">' +
        '<div class="cover-card">' +
        '<div class="pulse-ring" aria-hidden="true"></div>' +
        '<div class="eyebrow">مرّر الجوال بسرية</div>' +
        "<h2>" +
        ctx.escapeHtml(name) +
        "</h2>" +
        "<p>أعطِ الجوال لـ <strong>" +
        ctx.escapeHtml(name) +
        "</strong> فقط. الباقي ما يشوفون الشاشة.</p></div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-open-role">أنا ' +
        ctx.escapeHtml(name) +
        " — أظهر الكلمات</button>" +
        (state.revealIndex === 0
          ? '<button class="btn btn-ghost" data-action="fw-setup">رجوع</button>'
          : "") +
        "</div></section>"
    );
  }

  function renderRole(state, ctx) {
    const i = state.revealIndex;
    const viewer = state.players[i];
    const others = state.players
      .map(function (name, idx) {
        return { name: name, item: state.assignments[idx], idx: idx };
      })
      .filter(function (row) {
        return row.idx !== i;
      });

    const cards = others
      .map(function (row) {
        return (
          '<article class="taboo-card">' +
          '<p class="taboo-topic">' +
          ctx.escapeHtml(row.name) +
          " ممنوع يقول</p>" +
          "<h2>" +
          ctx.escapeHtml(row.item.word) +
          "</h2></article>"
        );
      })
      .join("");

    const last = i >= state.playerCount - 1;
    return ctx.el(
      '<section class="screen">' +
        '<div class="panel" style="text-align:center">' +
        '<p class="hint">' +
        ctx.escapeHtml(viewer) +
        "</p>" +
        '<div class="role-pill out">كلمتك الممنوعة مخفية</div>' +
        '<p class="hint">ما تشوف كلمتك. احفظ كلمة كل واحد من الباقي.</p></div>' +
        '<div class="forbid-list">' +
        cards +
        "</div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-next-reveal">' +
        (last ? "انتهينا — ابدأوا اللعب" : "اخفِ ومرّر للتالي") +
        "</button></div></section>"
    );
  }

  function renderPlay(state, ctx) {
    return ctx.el(
      '<section class="screen">' +
        '<header class="brand compact"><h1>اللعب</h1><p>تكلّموا مع بعض. لا تقول الكلمة الممنوعة اللي عليك.</p></header>' +
        '<div class="panel" style="text-align:center">' +
        '<div class="timer" data-fw-timer>' +
        formatTime(state.playSeconds) +
        "</div>" +
        '<p class="hint" style="margin:12px 0 0">إذا أحد نطق كلمته، وقّفوا وكشّفوا.</p></div>' +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-reveal">كشف الكلمات</button>' +
        '<button class="btn btn-secondary" data-action="fw-toggle-timer">' +
        (state.playTimerId ? "إيقاف المؤقّت" : "تشغيل 3 دقائق") +
        "</button></div></section>"
    );
  }

  function renderReveal(state, ctx) {
    const rows = state.players
      .map(function (name, i) {
        return (
          '<div class="stat-row"><span>' +
          ctx.escapeHtml(name) +
          "</span><span>" +
          ctx.escapeHtml(state.assignments[i].word) +
          "</span></div>"
        );
      })
      .join("");

    return ctx.el(
      '<section class="screen">' +
        '<div class="panel result-hero">' +
        '<span class="tag lose">كشف</span>' +
        "  <h2>الكلمات الممنوعة</h2>" +
        '  <div class="stats">' +
        rows +
        "</div></div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-again">وزّع من جديد</button>' +
        '<button class="btn btn-secondary" data-action="fw-setup">تغيير اللاعبين</button>' +
        '<button class="btn btn-ghost" data-action="fw-exit">الألعاب</button>' +
        "</div></section>"
    );
  }

  function validateNames(state) {
    const cleaned = state.players.map(function (p) {
      return p.trim();
    });
    if (
      cleaned.some(function (p) {
        return !p;
      })
    )
      return { ok: false, msg: "اكتب أسماء كل اللاعبين" };
    const lower = cleaned.map(function (p) {
      return p.toLowerCase();
    });
    const uniq = [];
    lower.forEach(function (x) {
      if (uniq.indexOf(x) === -1) uniq.push(x);
    });
    if (uniq.length !== lower.length) return { ok: false, msg: "الأسماء لازم تكون مختلفة" };
    state.players = cleaned;
    return { ok: true };
  }

  function handleAction(action, state, ctx) {
    switch (action) {
      case "fw-home":
        clearTimer(state);
        state.step = "fw-home";
        return true;
      case "fw-setup":
        clearTimer(state);
        state.step = "fw-setup";
        return true;
      case "fw-exit":
        clearTimer(state);
        ctx.onExit();
        return true;
      case "fw-deal": {
        const v = validateNames(state);
        if (!v.ok) {
          ctx.alert(v.msg);
          return true;
        }
        if (uniqueCards().length < state.playerCount) {
          ctx.alert("الكلمات ما تحمّلت — حدّث الصفحة");
          return true;
        }
        deal(state);
        state.step = "fw-pass";
        return true;
      }
      case "fw-open-role":
        state.step = "fw-role";
        return true;
      case "fw-next-reveal":
        if (state.revealIndex >= state.playerCount - 1) {
          state.step = "fw-play";
        } else {
          state.revealIndex += 1;
          state.step = "fw-pass";
        }
        return true;
      case "fw-toggle-timer":
        if (state.playTimerId) {
          clearTimer(state);
        } else {
          state.playSeconds = 180;
          state.playTimerId = setInterval(function () {
            state.playSeconds -= 1;
            const node = document.querySelector("[data-fw-timer]");
            if (node) node.textContent = formatTime(Math.max(0, state.playSeconds));
            if (state.playSeconds <= 0) clearTimer(state);
          }, 1000);
        }
        return true;
      case "fw-reveal":
        clearTimer(state);
        state.step = "fw-reveal";
        return true;
      case "fw-again":
        clearTimer(state);
        deal(state);
        state.step = "fw-pass";
        return true;
      default:
        return false;
    }
  }

  window.ForbiddenWord = {
    createState: createState,
    render: render,
    handleAction: handleAction,
  };
})();
