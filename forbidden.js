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

  function deck() {
    return window.FORBIDDEN_CARDS || [];
  }

  function createState() {
    return {
      step: "fw-home",
      playerCount: 3,
      players: ["", "", ""],
      scores: [0, 0, 0],
      explainer: 0,
      cards: [],
      cardIndex: 0,
      seconds: 60,
      timerId: null,
      turnGot: 0,
      turnSkip: 0,
      turnTaboo: 0,
      finishedTurns: 0,
    };
  }

  function startMatch(state) {
    state.scores = [];
    for (let i = 0; i < state.playerCount; i += 1) state.scores.push(0);
    state.explainer = 0;
    state.finishedTurns = 0;
    state.cards = shuffle(deck());
    state.cardIndex = 0;
  }

  function startTurn(state) {
    clearTimer(state);
    state.seconds = 60;
    state.turnGot = 0;
    state.turnSkip = 0;
    state.turnTaboo = 0;
    if (state.cardIndex >= state.cards.length - 5) {
      state.cards = state.cards.concat(shuffle(deck()));
    }
  }

  function currentCard(state) {
    return state.cards[state.cardIndex] || null;
  }

  function nextCard(state) {
    state.cardIndex += 1;
    if (state.cardIndex >= state.cards.length) {
      state.cards = state.cards.concat(shuffle(deck()));
    }
  }

  function clearTimer(state) {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer(state, onTick) {
    clearTimer(state);
    state.timerId = setInterval(function () {
      state.seconds -= 1;
      if (onTick) onTick();
      if (state.seconds <= 0) {
        clearTimer(state);
        state.step = "fw-turn-end";
        if (window.__forbiddenRerender) window.__forbiddenRerender();
      }
    }, 1000);
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
      "fw-card": renderCard,
      "fw-turn-end": renderTurnEnd,
      "fw-final": renderFinal,
    };
    return (map[state.step] || renderHome)(state, ctx);
  }

  function renderHome(state, ctx) {
    return ctx.el(
      '<section class="screen">' +
        topBar() +
        '<header class="brand">' +
        "<h1>الكلمة الممنوعة</h1>" +
        "<p>اشرح الكلمة لرفاقك… بدون ما تنطقها ولا تنطق الكلمات الممنوعة.</p>" +
        "</header>" +
        '<div class="panel">' +
        "<h2>كيف تلعبون؟</h2>" +
        '<ul class="howto">' +
        '<li><span class="num">1</span><div><strong>دور الشارح</strong><p>الجوال عنده وحده. الباقي يخمنون وما يشوفون الشاشة.</p></div></li>' +
        '<li><span class="num">2</span><div><strong>بطاقة عشوائية</strong><p>كلمة ذهبية تشرحها، وتحتها كلمات حمراء ممنوع تقولها.</p></div></li>' +
        '<li><span class="num">3</span><div><strong>60 ثانية</strong><p>صح = نقطة. تخطي = بطاقة جديدة. إذا نطقت ممنوعة = ما تحسب.</p></div></li>' +
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
        '<header class="brand compact"><h1>اللاعبين</h1><p>2 أو 3 أو 4 — البطاقات تجي عشوائية</p></header>' +
        '<div class="panel"><h2>العدد</h2>' +
        '<div class="choice-grid" style="margin-bottom:16px">' +
        countBtn(state, 2, "واحد يشرح والثاني يخمن") +
        countBtn(state, 3, "واحد يشرح والاثنين يخمنون") +
        countBtn(state, 4, "دور يلف على الكل") +
        "</div><h2>الأسماء</h2>" +
        fields +
        "</div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-start">ابدأ الأدوار</button>' +
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
    const name = state.players[state.explainer];
    return ctx.el(
      '<section class="screen">' +
        '<div class="cover-card">' +
        '<div class="pulse-ring" aria-hidden="true"></div>' +
        '<div class="eyebrow">دور الشرح — 60 ثانية</div>' +
        "<h2>" +
        ctx.escapeHtml(name) +
        "</h2>" +
        "<p>أعطوا الجوال لـ <strong>" +
        ctx.escapeHtml(name) +
        "</strong> فقط. الباقي يخمنون وما يشوفون البطاقة.</p>" +
        "</div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-open-card">أنا ' +
        ctx.escapeHtml(name) +
        " — ابدأ</button>" +
        "</div></section>"
    );
  }

  function renderCard(state, ctx) {
    const card = currentCard(state);
    if (!card) {
      return ctx.el('<section class="screen"><p>ما في بطاقات</p></section>');
    }
    const taboos = (card.taboo || [])
      .map(function (w) {
        return '<li>' + ctx.escapeHtml(w) + "</li>";
      })
      .join("");

    return ctx.el(
      '<section class="screen">' +
        '<div class="taboo-top">' +
        '<div class="timer" data-fw-timer>' +
        formatTime(state.seconds) +
        "</div>" +
        '<p class="hint">' +
        ctx.escapeHtml(state.players[state.explainer]) +
        " يشرح · صح " +
        state.turnGot +
        "</p></div>" +
        '<article class="taboo-card">' +
        '<p class="taboo-topic">' +
        ctx.escapeHtml(card.topic) +
        "</p>" +
        "<h2>" +
        ctx.escapeHtml(card.word) +
        "</h2>" +
        '<p class="taboo-label">ممنوع تقول</p>' +
        '<ul class="taboo-list">' +
        taboos +
        "</ul></article>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-correct">صح — خمّنوا</button>' +
        '<button class="btn btn-secondary" data-action="fw-skip">تخطي</button>' +
        '<button class="btn btn-danger" data-action="fw-taboo">قال كلمة ممنوعة</button>' +
        "</div></section>"
    );
  }

  function renderTurnEnd(state, ctx) {
    const name = state.players[state.explainer];
    const more = state.finishedTurns + 1 < state.playerCount;
    return ctx.el(
      '<section class="screen">' +
        '<div class="panel result-hero">' +
        '<span class="tag win">انتهى الوقت</span>' +
        "<h2>" +
        ctx.escapeHtml(name) +
        "</h2>" +
        '<div class="stats">' +
        '<div class="stat-row"><span>صح</span><span>' +
        state.turnGot +
        "</span></div>" +
        '<div class="stat-row"><span>تخطي</span><span>' +
        state.turnSkip +
        "</span></div>" +
        '<div class="stat-row"><span>كلمة ممنوعة</span><span>' +
        state.turnTaboo +
        "</span></div>" +
        '<div class="stat-row"><span>مجموع النقاط</span><span>' +
        state.scores[state.explainer] +
        "</span></div></div></div>" +
        '<div class="actions">' +
        (more
          ? '<button class="btn btn-primary" data-action="fw-next-turn">دور اللاعب التالي</button>'
          : '<button class="btn btn-primary" data-action="fw-final">النتيجة النهائية</button>') +
        "</div></section>"
    );
  }

  function renderFinal(state, ctx) {
    let best = 0;
    for (let i = 1; i < state.playerCount; i += 1) {
      if (state.scores[i] > state.scores[best]) best = i;
    }
    const rows = state.players
      .map(function (name, i) {
        return (
          '<div class="stat-row"><span>' +
          ctx.escapeHtml(name) +
          '</span><span>' +
          state.scores[i] +
          " نقطة</span></div>"
        );
      })
      .join("");

    return ctx.el(
      '<section class="screen">' +
        '<div class="panel result-hero">' +
        '<span class="tag win">الفائز</span>' +
        "<h2>" +
        ctx.escapeHtml(state.players[best]) +
        "</h2>" +
        '<div class="stats">' +
        rows +
        "</div></div>" +
        '<div class="actions">' +
        '<button class="btn btn-primary" data-action="fw-again">جولة جديدة</button>' +
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
      case "fw-start": {
        const v = validateNames(state);
        if (!v.ok) {
          ctx.alert(v.msg);
          return true;
        }
        if (deck().length < 20) {
          ctx.alert("البطاقات ما تحمّلت — حدّث الصفحة");
          return true;
        }
        startMatch(state);
        startTurn(state);
        state.step = "fw-pass";
        return true;
      }
      case "fw-open-card":
        startTurn(state);
        startTimer(state, function () {
          const node = document.querySelector("[data-fw-timer]");
          if (node) node.textContent = formatTime(Math.max(0, state.seconds));
        });
        state.step = "fw-card";
        return true;
      case "fw-correct":
        state.turnGot += 1;
        state.scores[state.explainer] += 1;
        nextCard(state);
        return true;
      case "fw-skip":
        state.turnSkip += 1;
        nextCard(state);
        return true;
      case "fw-taboo":
        state.turnTaboo += 1;
        nextCard(state);
        return true;
      case "fw-next-turn":
        clearTimer(state);
        state.finishedTurns += 1;
        state.explainer = (state.explainer + 1) % state.playerCount;
        startTurn(state);
        state.step = "fw-pass";
        return true;
      case "fw-final":
        clearTimer(state);
        state.finishedTurns += 1;
        state.step = "fw-final";
        return true;
      case "fw-again":
        clearTimer(state);
        startMatch(state);
        startTurn(state);
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
