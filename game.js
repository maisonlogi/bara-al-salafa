(() => {
  "use strict";

  const STORAGE_KEY = "bara-al-salafa-settings-v1";
  const app = document.getElementById("app");

  const DEFAULT_CATEGORIES = [
    { id: "characters", title: "شخصيات أنمي", desc: "+50 شخصية معروفة", builtin: true },
    { id: "animes", title: "أسماء أنميات", desc: "+30 أنمي مشهور", builtin: true },
    { id: "footballClubs", title: "أندية كرة قدم", desc: "أندية عالمية وعربية", builtin: true },
    { id: "footballPlayers", title: "لاعبين كرة قدم", desc: "أشهر 100 لاعب حالياً", builtin: true },
    { id: "celebrities", title: "شخصيات مشهورة", desc: "مشاهير عالميين جداً", builtin: true },
    { id: "countries", title: "أسماء دول", desc: "دول من حول العالم", builtin: true },
    { id: "algerianFood", title: "أكلات جزائرية", desc: "أطباق جزائرية أصيلة", builtin: true },
  ];

  const state = {
    gameMode: "pick", // pick | bara | whoami | forbidden
    step: "pick",
    playerCount: 3,
    players: ["", "", ""],
    category: null,
    secret: null,
    outsiderIndex: null,
    revealIndex: 0,
    revealOpen: false,
    votes: [],
    currentVoter: 0,
    selectedVote: null,
    selectedGuess: null,
    guessOptions: [],
    outsiderGuess: null,
    discussSeconds: 180,
    discussTimerId: null,
    settingsCatId: null,
    settingsQuery: "",
    settingsReturn: "home",
    editingIndex: null,
  };

  let whoamiState = window.WhoAmI ? window.WhoAmI.createState() : null;
  let forbiddenState = window.ForbiddenWord ? window.ForbiddenWord.createState() : null;

  let store = loadStore();

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { overrides: {}, custom: [] };
      const parsed = JSON.parse(raw);
      return {
        overrides: parsed.overrides && typeof parsed.overrides === "object" ? parsed.overrides : {},
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      };
    } catch {
      return { overrides: {}, custom: [] };
    }
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getAllCategories() {
    const customs = store.custom.map((c) => ({
      id: c.id,
      title: c.title,
      desc: `${(c.items || []).length} عنصر · موضوعك`,
      builtin: false,
    }));
    return [...DEFAULT_CATEGORIES, ...customs];
  }

  function getItems(catId) {
    if (store.overrides[catId]) return [...store.overrides[catId]];
    const custom = store.custom.find((c) => c.id === catId);
    if (custom) return [...(custom.items || [])];
    const base = window.GAME_DATA[catId];
    return base ? [...base] : [];
  }

  function setItems(catId, items) {
    const cleaned = items.map((x) => String(x).trim()).filter(Boolean);
    const customIdx = store.custom.findIndex((c) => c.id === catId);
    if (customIdx >= 0) {
      store.custom[customIdx].items = cleaned;
    } else {
      store.overrides[catId] = cleaned;
    }
    saveStore();
  }

  function isBuiltin(catId) {
    return DEFAULT_CATEGORIES.some((c) => c.id === catId);
  }

  function categoryMeta(catId) {
    return getAllCategories().find((c) => c.id === catId) || null;
  }

  function categoryLabel() {
    const found = categoryMeta(state.category);
    return found ? found.title : "";
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickSecretAndOutsider() {
    const pool = getItems(state.category);
    state.secret = pool[Math.floor(Math.random() * pool.length)];
    state.outsiderIndex = Math.floor(Math.random() * state.playerCount);
    const decoys = shuffle(pool.filter((x) => x !== state.secret)).slice(0, 6);
    state.guessOptions = shuffle([state.secret, ...decoys]);
  }

  function resetRoundKeepPlayers() {
    clearDiscussTimer();
    state.secret = null;
    state.outsiderIndex = null;
    state.revealIndex = 0;
    state.revealOpen = false;
    state.votes = [];
    state.currentVoter = 0;
    state.selectedVote = null;
    state.selectedGuess = null;
    state.guessOptions = [];
    state.outsiderGuess = null;
    state.discussSeconds = 180;
  }

  function clearDiscussTimer() {
    if (state.discussTimerId) {
      clearInterval(state.discussTimerId);
      state.discussTimerId = null;
    }
  }

  function formatTime(total) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function majorityVoteTarget() {
    const counts = Array(state.playerCount).fill(0);
    state.votes.forEach((v) => {
      counts[v] += 1;
    });
    let best = 0;
    let max = -1;
    counts.forEach((c, i) => {
      if (c > max) {
        max = c;
        best = i;
      }
    });
    const ties = counts.filter((c) => c === max).length;
    return { index: best, count: max, tied: ties > 1, counts };
  }

  function computeOutcome() {
    const vote = majorityVoteTarget();
    const caught = !vote.tied && vote.index === state.outsiderIndex;
    const guessed = state.outsiderGuess === state.secret;
    let winner = "outsider";
    let message = "";

    if (guessed) {
      winner = "outsider";
      message = "اللي برا السالفة خمّن صح!";
    } else if (caught) {
      winner = "group";
      message = "المجموعة كشفت اللي برا السالفة!";
    } else {
      winner = "outsider";
      message = vote.tied
        ? "التعادل أنقذ اللي برا السالفة!"
        : "التصويت راح على الشخص الغلط!";
    }

    return { vote, caught, guessed, winner, message };
  }

  function setPlayersCount(n) {
    state.playerCount = n;
    while (state.players.length < n) state.players.push("");
    state.players = state.players.slice(0, n);
    render();
  }

  function go(step) {
    state.step = step;
    render();
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function topBar(showSettings = true) {
    return `
      <div class="topbar">
        <button class="icon-btn" data-action="to-pick" type="button" aria-label="الألعاب">الألعاب</button>
        ${
          showSettings
            ? `<button class="icon-btn" data-action="open-settings" type="button" aria-label="إعدادات">
                <span>إعدادات</span>
              </button>`
            : `<button class="icon-btn" data-action="close-settings" type="button">إغلاق</button>`
        }
      </div>
    `;
  }

  function render() {
    app.innerHTML = "";
    app.classList.toggle("ltr-app", state.gameMode === "whoami");

    if (state.gameMode === "pick") {
      app.appendChild(renderPick());
      return;
    }

    if (state.gameMode === "whoami" && window.WhoAmI && whoamiState) {
      window.__whoamiRerender = () => render();
      const node = window.WhoAmI.render(whoamiState, { el, escapeHtml, escapeAttr });
      app.appendChild(node);
      return;
    }

    if (state.gameMode === "forbidden" && window.ForbiddenWord && forbiddenState) {
      window.__forbiddenRerender = () => render();
      const node = window.ForbiddenWord.render(forbiddenState, { el, escapeHtml, escapeAttr });
      app.appendChild(node);
      return;
    }

    const map = {
      home: renderHome,
      setup: renderSetup,
      category: renderCategory,
      pass: renderPass,
      role: renderRole,
      discuss: renderDiscuss,
      votePass: renderVotePass,
      vote: renderVote,
      outsiderIntro: renderOutsiderIntro,
      guess: renderGuess,
      result: renderResult,
      settings: renderSettings,
      settingsEdit: renderSettingsEdit,
      settingsNew: renderSettingsNew,
    };
    const view = map[state.step];
    if (view) app.appendChild(view());
  }

  function renderPick() {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "اختر اللعبة";

    return el(`
      <section class="screen">
        <header class="brand">
          <h1>ألعابنا</h1>
          <p>اختاروا اللعبة وبلّوا الجوال</p>
        </header>

        <div class="game-pick">
          <button class="game-card" data-action="pick-bara" type="button">
            <span class="game-card-kicker">عربي</span>
            <strong>برا السالفة</strong>
            <span>واحد برا السالفة… والباقي يعرفون السر. صوّتوا وخمّنوا.</span>
          </button>
          <button class="game-card game-card-en" data-action="pick-whoami" type="button">
            <span class="game-card-kicker">English</span>
            <strong>Who Am I?</strong>
            <span>Top 800 footballers by market value, with photos. You see everyone else — never yourself.</span>
          </button>
          <button class="game-card" data-action="pick-forbidden" type="button">
            <span class="game-card-kicker">عربي</span>
            <strong>الكلمة الممنوعة</strong>
            <span>اشرح الكلمة بدون ما تقول الممنوعات. بطاقات عشوائية من 100+ موضوع.</span>
          </button>
        </div>
      </section>
    `);
  }

  function steps(active) {
    return `
      <div class="step-dots" aria-hidden="true">
        ${[0, 1, 2, 3].map((i) => `<span class="${i === active ? "on" : ""}"></span>`).join("")}
      </div>
    `;
  }

  function renderHome() {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "برا السالفة";
    return el(`
      <section class="screen">
        ${topBar(true)}
        <header class="brand">
          <h1>برا السالفة</h1>
          <p>لعبة تمرير الجوال: واحد ما يعرف الموضوع… والباقي يحاولون يكشفونه.</p>
        </header>

        <div class="panel">
          <h2>كيف تلعبون؟</h2>
          <ul class="howto">
            <li>
              <span class="num">1</span>
              <div>
                <strong>اختاروا اللاعبين والموضوع</strong>
                <p>3 أو 4 لاعبين، ثم اختاروا موضوع الجولة.</p>
              </div>
            </li>
            <li>
              <span class="num">2</span>
              <div>
                <strong>مرّروا الجوال</strong>
                <p>كل واحد يشوف دوره لوحده: إما يشوف السر، أو يطلع برا السالفة.</p>
              </div>
            </li>
            <li>
              <span class="num">3</span>
              <div>
                <strong>ناقشوا وصوّتوا</strong>
                <p>بعد التصويت، اللي برا السالفة يختار من 7 اقتراحات.</p>
              </div>
            </li>
          </ul>
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="start">ابدأ اللعبة</button>
          <button class="btn btn-secondary" data-action="open-settings">إعدادات المواضيع</button>
        </div>
        <p class="footer-note">عدّل أي عنصر ما تعرفونه أو أضيفوا موضوعكم من الإعدادات</p>
      </section>
    `);
  }

  function renderSetup() {
    const fields = state.players
      .map(
        (name, i) => `
        <div class="field">
          <label for="p${i}">اللاعب ${i + 1}</label>
          <input id="p${i}" data-player="${i}" maxlength="20" placeholder="اكتب الاسم" value="${escapeAttr(name)}" autocomplete="off" />
        </div>`
      )
      .join("");

    const screen = el(`
      <section class="screen">
        ${topBar(true)}
        ${steps(0)}
        <header class="brand compact">
          <h1>اللاعبين</h1>
          <p>حدّدوا العدد والأسماء</p>
        </header>

        <div class="panel">
          <h2>عدد اللاعبين</h2>
          <div class="choice-grid" style="margin-bottom:16px">
            <button class="choice ${state.playerCount === 3 ? "selected" : ""}" data-count="3">
              <strong>3 لاعبين</strong>
              <span>جولة سريعة ومكثّفة</span>
            </button>
            <button class="choice ${state.playerCount === 4 ? "selected" : ""}" data-count="4">
              <strong>4 لاعبين</strong>
              <span>يزيد لاعب إضافي للنقاش</span>
            </button>
          </div>
          <h2>الأسماء</h2>
          <p class="hint">خلّ الأسماء واضحة عشان التصويت يكون سهل.</p>
          ${fields}
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="to-category">التالي</button>
          <button class="btn btn-ghost" data-action="home">رجوع</button>
        </div>
      </section>
    `);

    screen.querySelectorAll("[data-count]").forEach((btn) => {
      btn.addEventListener("click", () => setPlayersCount(Number(btn.dataset.count)));
    });

    screen.querySelectorAll("[data-player]").forEach((input) => {
      input.addEventListener("input", (e) => {
        state.players[Number(e.target.dataset.player)] = e.target.value;
      });
    });

    return screen;
  }

  function renderCategory() {
    const choices = getAllCategories()
      .map((c) => {
        const count = getItems(c.id).length;
        return `
      <button class="choice ${state.category === c.id ? "selected" : ""}" data-cat="${c.id}">
        <strong>${escapeHtml(c.title)}</strong>
        <span>${escapeHtml(c.desc)} · ${count} عنصر</span>
      </button>`;
      })
      .join("");

    return el(`
      <section class="screen">
        ${topBar(true)}
        ${steps(1)}
        <header class="brand compact">
          <h1>الموضوع</h1>
          <p>اختاروا نوع الموضوع لهذه الجولة</p>
        </header>

        <div class="panel">
          <p class="hint">كل اللي داخل السالفة يشوفون نفس السر. واحد فقط برا السالفة.</p>
          <div class="choice-grid">${choices}</div>
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="begin-round" ${state.category ? "" : "disabled"}>ابدأ توزيع الأدوار</button>
          <button class="btn btn-secondary" data-action="open-settings">تعديل المواضيع</button>
          <button class="btn btn-ghost" data-action="setup">رجوع</button>
        </div>
      </section>
    `);
  }

  function renderSettings() {
    const cats = getAllCategories()
      .map((c) => {
        const n = getItems(c.id).length;
        const badge = c.builtin ? "أساسي" : "خاص";
        return `
          <button class="settings-row" data-action="edit-cat" data-id="${c.id}">
            <div>
              <strong>${escapeHtml(c.title)}</strong>
              <span>${n} عنصر · ${badge}</span>
            </div>
            <span class="chev">تعديل</span>
          </button>`;
      })
      .join("");

    return el(`
      <section class="screen">
        ${topBar(false)}
        <header class="brand compact">
          <h1>الإعدادات</h1>
          <p>عدّل العناصر أو أضف موضوع تحبونه</p>
        </header>

        <div class="panel">
          <h2>المواضيع</h2>
          <div class="settings-list">${cats}</div>
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="new-topic">+ إضافة موضوع جديد</button>
          <button class="btn btn-ghost" data-action="close-settings">رجوع</button>
        </div>
      </section>
    `);
  }

  function renderSettingsEdit() {
    const meta = categoryMeta(state.settingsCatId);
    if (!meta) {
      state.step = "settings";
      return renderSettings();
    }

    const items = getItems(state.settingsCatId);
    const q = state.settingsQuery.trim().toLowerCase();
    const filtered = items
      .map((text, index) => ({ text, index }))
      .filter((row) => !q || row.text.toLowerCase().includes(q));

    const rows = filtered
      .map((row) => {
        if (state.editingIndex === row.index) {
          return `
            <div class="item-row editing" data-index="${row.index}">
              <input class="item-input" data-edit-input maxlength="60" value="${escapeAttr(row.text)}" />
              <button class="mini-btn ok" data-action="save-item" data-index="${row.index}">حفظ</button>
              <button class="mini-btn" data-action="cancel-edit">إلغاء</button>
            </div>`;
        }
        return `
          <div class="item-row" data-index="${row.index}">
            <span class="item-text">${escapeHtml(row.text)}</span>
            <button class="mini-btn" data-action="start-edit" data-index="${row.index}">تعديل</button>
            <button class="mini-btn danger" data-action="delete-item" data-index="${row.index}">حذف</button>
          </div>`;
      })
      .join("");

    const screen = el(`
      <section class="screen">
        ${topBar(false)}
        <header class="brand compact">
          <h1>${escapeHtml(meta.title)}</h1>
          <p>${items.length} عنصر — احذف أو عدّل اللي ما تعرفونه</p>
        </header>

        <div class="panel">
          ${
            !meta.builtin
              ? `<div class="field">
                  <label for="cat-title">اسم الموضوع</label>
                  <input id="cat-title" data-cat-title maxlength="40" value="${escapeAttr(meta.title)}" />
                </div>`
              : ""
          }
          <div class="field">
            <label for="search-items">بحث</label>
            <input id="search-items" data-settings-search placeholder="ابحث عن عنصر..." value="${escapeAttr(state.settingsQuery)}" />
          </div>

          <div class="add-inline">
            <input data-new-item maxlength="60" placeholder="أضف عنصر جديد..." />
            <button class="btn btn-secondary" data-action="add-item" type="button">إضافة</button>
          </div>

          <div class="items-editor">${rows || `<p class="hint">ما في نتائج</p>`}</div>
        </div>

        <div class="actions">
          ${
            meta.builtin
              ? `<button class="btn btn-secondary" data-action="reset-cat">استرجاع القائمة الأصلية</button>`
              : `<button class="btn btn-danger" data-action="delete-cat">حذف الموضوع</button>`
          }
          <button class="btn btn-ghost" data-action="back-settings">رجوع للمواضيع</button>
        </div>
      </section>
    `);

    const search = screen.querySelector("[data-settings-search]");
    if (search) {
      search.addEventListener("input", (e) => {
        state.settingsQuery = e.target.value;
        const keep = e.target.selectionStart;
        render();
        const again = app.querySelector("[data-settings-search]");
        if (again) {
          again.focus();
          again.setSelectionRange(keep, keep);
        }
      });
    }

    const titleInput = screen.querySelector("[data-cat-title]");
    if (titleInput) {
      titleInput.addEventListener("change", (e) => {
        const title = e.target.value.trim();
        if (!title) return;
        const idx = store.custom.findIndex((c) => c.id === state.settingsCatId);
        if (idx >= 0) {
          store.custom[idx].title = title;
          saveStore();
          render();
        }
      });
    }

    const editInput = screen.querySelector("[data-edit-input]");
    if (editInput) {
      requestAnimationFrame(() => {
        editInput.focus();
        editInput.select();
      });
      editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          saveItemEdit(Number(editInput.closest("[data-index]").dataset.index), editInput.value);
        }
      });
    }

    const newItem = screen.querySelector("[data-new-item]");
    if (newItem) {
      newItem.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addItem(newItem.value);
        }
      });
    }

    return screen;
  }

  function renderSettingsNew() {
    const screen = el(`
      <section class="screen">
        ${topBar(false)}
        <header class="brand compact">
          <h1>موضوع جديد</h1>
          <p>سمّ الموضوع واكتب العناصر (سطر لكل عنصر)</p>
        </header>

        <div class="panel">
          <div class="field">
            <label for="new-title">اسم الموضوع</label>
            <input id="new-title" data-new-title maxlength="40" placeholder="مثال: أكلات تونسية" />
          </div>
          <div class="field">
            <label for="new-items">العناصر</label>
            <textarea id="new-items" data-new-items rows="10" placeholder="عنصر 1&#10;عنصر 2&#10;عنصر 3"></textarea>
          </div>
          <p class="hint">لازم على الأقل 7 عناصر عشان تخمين البرا يشتغل صح.</p>
        </div>

        <div class="actions">
          <button class="btn btn-primary" data-action="create-topic">حفظ الموضوع</button>
          <button class="btn btn-ghost" data-action="back-settings">إلغاء</button>
        </div>
      </section>
    `);
    return screen;
  }

  function renderPass() {
    const name = state.players[state.revealIndex];
    return el(`
      <section class="screen">
        ${steps(2)}
        <div class="cover-card">
          <div class="pulse-ring" aria-hidden="true"></div>
          <div class="eyebrow">مرّر الجوال بسرية</div>
          <h2>${escapeHtml(name)}</h2>
          <p>أعطِ الجوال لـ <strong>${escapeHtml(name)}</strong> فقط. الباقي ما يشوفون الشاشة.</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="open-role">أنا ${escapeHtml(name)} — أظهر دوري</button>
          ${state.revealIndex === 0 ? `<button class="btn btn-ghost" data-action="category">رجوع</button>` : ""}
        </div>
      </section>
    `);
  }

  function renderRole() {
    const i = state.revealIndex;
    const name = state.players[i];
    const isOut = i === state.outsiderIndex;

    const body = isOut
      ? `
        <div class="role-pill out">أنت برا السالفة</div>
        <p class="hint" style="text-align:center">ما عندك السر. استمع للنقاش وحاول تندمج بدون ما ينكشف أمرك.</p>
        <div class="secret-word" style="border-color:rgba(255,93,108,.4)">؟ ؟ ؟</div>
        <p class="hint" style="text-align:center;margin:0">بعد التصويت راح تحصل 7 اقتراحات تخمّن منها.</p>
      `
      : `
        <div class="role-pill in">أنت داخل السالفة</div>
        <p class="hint" style="text-align:center">احفظ السر، وتكلم عنه بدون ما توضّحه زيادة.</p>
        <div class="secret-word">${escapeHtml(state.secret)}</div>
        <p class="hint" style="text-align:center;margin:0">الموضوع: ${escapeHtml(categoryLabel())}</p>
      `;

    const nextLabel =
      i >= state.playerCount - 1 ? "انتهينا — ابدأوا النقاش" : "اخفِ ومرّر للجوال التالي";

    return el(`
      <section class="screen">
        ${steps(2)}
        <div class="panel role-reveal">
          <div class="eyebrow" style="color:var(--muted);font-size:.9rem;margin-bottom:6px">${escapeHtml(name)}</div>
          ${body}
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="next-reveal">${nextLabel}</button>
        </div>
      </section>
    `);
  }

  function renderDiscuss() {
    return el(`
      <section class="screen">
        ${steps(3)}
        <header class="brand compact">
          <h1>النقاش</h1>
          <p>اسألوا بعض أسئلة ذكية بدون ما تفضحوا السر.</p>
        </header>
        <div class="panel" style="text-align:center">
          <p class="hint" style="margin-bottom:8px">مؤقّت اختياري</p>
          <div class="timer" data-timer>${formatTime(state.discussSeconds)}</div>
          <p class="hint" style="margin:12px 0 0">لما تحسون إنكم جاهزين، ابدأوا التصويت.</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="start-vote">ابدأ التصويت</button>
          <button class="btn btn-secondary" data-action="toggle-timer">
            ${state.discussTimerId ? "إيقاف المؤقّت" : "تشغيل 3 دقائق"}
          </button>
        </div>
      </section>
    `);
  }

  function renderVotePass() {
    const name = state.players[state.currentVoter];
    return el(`
      <section class="screen">
        <div class="cover-card">
          <div class="eyebrow">دور التصويت</div>
          <h2>${escapeHtml(name)}</h2>
          <p>أعطوا الجوال لـ <strong>${escapeHtml(name)}</strong> عشان يصوّت بسرية: مين برا السالفة؟</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="open-vote">أنا ${escapeHtml(name)} — أصوّت</button>
        </div>
      </section>
    `);
  }

  function renderVote() {
    const voter = state.currentVoter;
    const options = state.players
      .map((name, i) => {
        if (i === voter) return "";
        const selected = state.selectedVote === i ? "selected" : "";
        return `<button class="vote-btn ${selected}" data-vote="${i}">${escapeHtml(name)}</button>`;
      })
      .join("");

    return el(`
      <section class="screen">
        <div class="panel">
          <h2>${escapeHtml(state.players[voter])}</h2>
          <p class="hint">مين في رأيك برا السالفة؟</p>
          <div class="vote-list">${options}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="confirm-vote" ${state.selectedVote === null ? "disabled" : ""}>تأكيد التصويت</button>
        </div>
      </section>
    `);
  }

  function renderOutsiderIntro() {
    const outsider = state.players[state.outsiderIndex];
    return el(`
      <section class="screen">
        <div class="cover-card">
          <div class="eyebrow">فرصة أخيرة</div>
          <h2>${escapeHtml(outsider)}</h2>
          <p>أعطوا الجوال للي برا السالفة. راح يطلع له 7 اقتراحات ويختار واحد.</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="open-guess">أنا ${escapeHtml(outsider)} — أعرض الاقتراحات</button>
        </div>
      </section>
    `);
  }

  function renderGuess() {
    const options = state.guessOptions
      .map((opt) => {
        const selected = state.selectedGuess === opt ? "selected" : "";
        return `<button class="guess-btn ${selected}" data-guess="${escapeAttr(opt)}">${escapeHtml(opt)}</button>`;
      })
      .join("");

    return el(`
      <section class="screen">
        <div class="panel">
          <h2>خمّن السر</h2>
          <p class="hint">واحد من هالسبعة هو السر الحقيقي. اختار بدقّة.</p>
          <div class="guess-list">${options}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="confirm-guess" ${state.selectedGuess ? "" : "disabled"}>تأكيد التخمين</button>
        </div>
      </section>
    `);
  }

  function renderResult() {
    const outcome = computeOutcome();
    const outsider = state.players[state.outsiderIndex];
    const accused = state.players[outcome.vote.index];
    const winTag = outcome.winner === "group" ? "win" : "lose";
    const winText = outcome.winner === "group" ? "فوز المجموعة" : "فوز اللي برا السالفة";

    const voteLines = state.players
      .map((name, i) => {
        const c = outcome.vote.counts[i];
        return `<div class="stat-row"><span>${escapeHtml(name)}</span><span>${c} صوت</span></div>`;
      })
      .join("");

    return el(`
      <section class="screen">
        <div class="panel result-hero">
          <span class="tag ${winTag}">${winText}</span>
          <h2>${escapeHtml(outcome.message)}</h2>
          <p class="hint">الموضوع كان: ${escapeHtml(categoryLabel())}</p>
          <div class="stats">
            <div class="stat-row"><span>اللي برا السالفة</span><span>${escapeHtml(outsider)}</span></div>
            <div class="stat-row"><span>السر</span><span>${escapeHtml(state.secret)}</span></div>
            <div class="stat-row"><span>الأكثر أصواتاً</span><span>${escapeHtml(accused)}${outcome.vote.tied ? " (تعادل)" : ""}</span></div>
            <div class="stat-row"><span>تخمين البرا</span><span>${escapeHtml(state.outsiderGuess || "—")}${outcome.guessed ? " ✓" : " ✗"}</span></div>
          </div>
        </div>
        <div class="panel">
          <h2>نتائج التصويت</h2>
          <div class="stats">${voteLines}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="again">جولة جديدة بنفس اللاعبين</button>
          <button class="btn btn-secondary" data-action="setup">تغيير اللاعبين</button>
          <button class="btn btn-ghost" data-action="home">القائمة</button>
        </div>
      </section>
    `);
  }

  function escapeHtml(str) {
    return String(str)
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).split("'").join("&#39;");
  }

  function validateNames() {
    const cleaned = state.players.map((p) => p.trim());
    if (cleaned.some((p) => !p)) return { ok: false, msg: "اكتب أسماء كل اللاعبين" };
    const lower = cleaned.map((p) => p.toLowerCase());
    if (new Set(lower).size !== lower.length) return { ok: false, msg: "الأسماء لازم تكون مختلفة" };
    state.players = cleaned;
    return { ok: true };
  }

  function addItem(value) {
    const text = String(value || "").trim();
    if (!text) return;
    const items = getItems(state.settingsCatId);
    if (items.some((x) => x.toLowerCase() === text.toLowerCase())) {
      shakeAndAlert("العنصر موجود مسبقاً");
      return;
    }
    items.push(text);
    setItems(state.settingsCatId, items);
    state.editingIndex = null;
    render();
  }

  function saveItemEdit(index, value) {
    const text = String(value || "").trim();
    if (!text) {
      shakeAndAlert("ما ينفع يكون فاضي");
      return;
    }
    const items = getItems(state.settingsCatId);
    if (items.some((x, i) => i !== index && x.toLowerCase() === text.toLowerCase())) {
      shakeAndAlert("العنصر موجود مسبقاً");
      return;
    }
    items[index] = text;
    setItems(state.settingsCatId, items);
    state.editingIndex = null;
    render();
  }

  function deleteItem(index) {
    const items = getItems(state.settingsCatId);
    if (items.length <= 7) {
      shakeAndAlert("لازم يبقى على الأقل 7 عناصر");
      return;
    }
    items.splice(index, 1);
    setItems(state.settingsCatId, items);
    state.editingIndex = null;
    render();
  }

  function startDiscussTimer() {
    clearDiscussTimer();
    state.discussSeconds = 180;
    state.discussTimerId = setInterval(() => {
      state.discussSeconds -= 1;
      const node = document.querySelector("[data-timer]");
      if (node) node.textContent = formatTime(Math.max(0, state.discussSeconds));
      if (state.discussSeconds <= 0) clearDiscussTimer();
    }, 1000);
    render();
  }

  app.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-action], [data-cat], [data-vote], [data-guess], [data-wa-guess]"
    );
    if (!t) return;

    if (t.dataset.waGuess !== undefined && state.gameMode === "whoami" && whoamiState) {
      window.WhoAmI.selectGuess(whoamiState, t.dataset.waGuess);
      render();
      return;
    }

    if (t.dataset.cat) {
      state.category = t.dataset.cat;
      render();
      return;
    }

    if (t.dataset.vote !== undefined) {
      state.selectedVote = Number(t.dataset.vote);
      render();
      return;
    }

    if (t.dataset.guess !== undefined) {
      state.selectedGuess = t.dataset.guess;
      render();
      return;
    }

    const action = t.dataset.action;
    if (!action) return;

    if (action === "pick-bara") {
      state.gameMode = "bara";
      state.step = "home";
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
      render();
      return;
    }

    if (action === "pick-whoami") {
      if (!window.WhoAmI) {
        shakeAndAlert("Who Am I failed to load — refresh the page");
        return;
      }
      state.gameMode = "whoami";
      state.step = "wa-home";
      whoamiState = window.WhoAmI.createState();
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
      document.title = "Who Am I?";
      render();
      return;
    }

    if (action === "pick-forbidden") {
      if (!window.ForbiddenWord) {
        shakeAndAlert("اللعبة ما تحمّلت — حدّث الصفحة");
        return;
      }
      state.gameMode = "forbidden";
      state.step = "fw-home";
      forbiddenState = window.ForbiddenWord.createState();
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
      document.title = "الكلمة الممنوعة";
      render();
      return;
    }

    if (action === "to-pick") {
      clearDiscussTimer();
      state.gameMode = "pick";
      state.step = "pick";
      whoamiState = window.WhoAmI ? window.WhoAmI.createState() : null;
      forbiddenState = window.ForbiddenWord ? window.ForbiddenWord.createState() : null;
      document.documentElement.lang = "ar";
      document.documentElement.dir = "rtl";
      document.title = "اختر اللعبة";
      render();
      return;
    }

    if (state.gameMode === "forbidden" && window.ForbiddenWord && forbiddenState && action.startsWith("fw-")) {
      const handled = window.ForbiddenWord.handleAction(action, forbiddenState, {
        onExit: () => {
          state.gameMode = "pick";
          state.step = "pick";
          document.documentElement.lang = "ar";
          document.documentElement.dir = "rtl";
          document.title = "اختر اللعبة";
          render();
        },
        alert: shakeAndAlert,
      });
      if (handled && action !== "fw-exit") render();
      return;
    }

    if (state.gameMode === "whoami" && window.WhoAmI && whoamiState && action.startsWith("wa-")) {
      const handled = window.WhoAmI.handleAction(action, whoamiState, {
        onExit: () => {
          state.gameMode = "pick";
          state.step = "pick";
          document.documentElement.lang = "ar";
          document.documentElement.dir = "rtl";
          document.title = "اختر اللعبة";
          render();
        },
        alert: shakeAndAlert,
      });
      if (handled && action !== "wa-exit") render();
      return;
    }

    switch (action) {
      case "start":
      case "setup":
        go("setup");
        break;
      case "home":
        clearDiscussTimer();
        go("home");
        break;
      case "open-settings":
        state.settingsReturn = ["home", "setup", "category"].includes(state.step)
          ? state.step
          : "home";
        state.settingsCatId = null;
        state.settingsQuery = "";
        state.editingIndex = null;
        go("settings");
        break;
      case "close-settings":
        go(state.settingsReturn || "home");
        break;
      case "back-settings":
        state.settingsCatId = null;
        state.settingsQuery = "";
        state.editingIndex = null;
        go("settings");
        break;
      case "edit-cat":
        state.settingsCatId = t.dataset.id;
        state.settingsQuery = "";
        state.editingIndex = null;
        go("settingsEdit");
        break;
      case "new-topic":
        go("settingsNew");
        break;
      case "create-topic": {
        const titleEl = app.querySelector("[data-new-title]");
        const itemsEl = app.querySelector("[data-new-items]");
        const title = (titleEl && titleEl.value ? titleEl.value : "").trim();
        const items = String(itemsEl && itemsEl.value ? itemsEl.value : "")
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        if (!title) {
          shakeAndAlert("اكتب اسم الموضوع");
          return;
        }
        if (items.length < 7) {
          shakeAndAlert("أضف على الأقل 7 عناصر");
          return;
        }
        const id = `custom_${Date.now()}`;
        store.custom.push({ id, title, items });
        saveStore();
        state.settingsCatId = id;
        state.settingsQuery = "";
        go("settingsEdit");
        break;
      }
      case "add-item": {
        const input = app.querySelector("[data-new-item]");
        addItem((input && input.value) || "");
        break;
      }
      case "start-edit":
        state.editingIndex = Number(t.dataset.index);
        render();
        break;
      case "cancel-edit":
        state.editingIndex = null;
        render();
        break;
      case "save-item": {
        const input = app.querySelector("[data-edit-input]");
        saveItemEdit(Number(t.dataset.index), (input && input.value) || "");
        break;
      }
      case "delete-item":
        deleteItem(Number(t.dataset.index));
        break;
      case "reset-cat":
        if (!isBuiltin(state.settingsCatId)) return;
        delete store.overrides[state.settingsCatId];
        saveStore();
        state.editingIndex = null;
        render();
        break;
      case "delete-cat": {
        if (isBuiltin(state.settingsCatId)) return;
        store.custom = store.custom.filter((c) => c.id !== state.settingsCatId);
        if (state.category === state.settingsCatId) state.category = null;
        saveStore();
        state.settingsCatId = null;
        go("settings");
        break;
      }
      case "to-category": {
        const v = validateNames();
        if (!v.ok) {
          shakeAndAlert(v.msg);
          return;
        }
        go("category");
        break;
      }
      case "category":
        go("category");
        break;
      case "begin-round": {
        if (!state.category) return;
        const pool = getItems(state.category);
        if (pool.length < 7) {
          shakeAndAlert("الموضوع يحتاج على الأقل 7 عناصر — عدّله من الإعدادات");
          return;
        }
        resetRoundKeepPlayers();
        pickSecretAndOutsider();
        go("pass");
        break;
      }
      case "open-role":
        state.revealOpen = true;
        go("role");
        break;
      case "next-reveal":
        if (state.revealIndex >= state.playerCount - 1) {
          go("discuss");
        } else {
          state.revealIndex += 1;
          state.revealOpen = false;
          go("pass");
        }
        break;
      case "toggle-timer":
        if (state.discussTimerId) {
          clearDiscussTimer();
          render();
        } else {
          startDiscussTimer();
        }
        break;
      case "start-vote":
        clearDiscussTimer();
        state.votes = [];
        state.currentVoter = 0;
        state.selectedVote = null;
        go("votePass");
        break;
      case "open-vote":
        state.selectedVote = null;
        go("vote");
        break;
      case "confirm-vote":
        if (state.selectedVote === null) return;
        state.votes[state.currentVoter] = state.selectedVote;
        if (state.currentVoter >= state.playerCount - 1) {
          go("outsiderIntro");
        } else {
          state.currentVoter += 1;
          state.selectedVote = null;
          go("votePass");
        }
        break;
      case "open-guess":
        state.selectedGuess = null;
        go("guess");
        break;
      case "confirm-guess":
        if (!state.selectedGuess) return;
        state.outsiderGuess = state.selectedGuess;
        go("result");
        break;
      case "again":
        go("category");
        break;
      default:
        break;
    }
  });

  function shakeAndAlert(msg) {
    const panel = app.querySelector(".panel");
    if (panel) {
      panel.classList.remove("shake");
      void panel.offsetWidth;
      panel.classList.add("shake");
    }
    let note = app.querySelector("[data-error]");
    if (!note) {
      note = document.createElement("p");
      note.dataset.error = "1";
      note.style.cssText =
        "margin:0;text-align:center;color:var(--danger);font-weight:700;font-size:.95rem";
      const actions = app.querySelector(".actions");
      if (actions) actions.before(note);
      else app.appendChild(note);
    }
    note.textContent = msg;
  }

  render();
})();
