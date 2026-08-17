(() => {
  "use strict";

  const imageCache = Object.create(null);

  function fallbackAvatar(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d2a32&color=ffb454&size=256&bold=true`;
  }

  async function loadImage(player) {
    if (!player) return fallbackAvatar("?");
    if (player.image) {
      imageCache[player.wiki || player.name] = player.image;
      return player.image;
    }
    const key = player.wiki || player.name;
    if (imageCache[key]) return imageCache[key];
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(player.wiki)}`
      );
      if (!res.ok) throw new Error("wiki");
      const data = await res.json();
      const url = (data.thumbnail && data.thumbnail.source) || fallbackAvatar(player.name);
      imageCache[key] = url;
      return url;
    } catch {
      const url = fallbackAvatar(player.name);
      imageCache[key] = url;
      return url;
    }
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function createState() {
    return {
      step: "wa-home",
      playerCount: 2,
      players: ["", ""],
      identities: [],
      revealIndex: 0,
      currentGuesser: 0,
      guesses: [],
      selectedGuess: null,
      guessOptions: [],
    };
  }

  function assignIdentities(state) {
    const pool = shuffle(window.WHOAMI_PLAYERS || []);
    state.identities = pool.slice(0, state.playerCount);
  }

  function topBar(onBackLabel = "Games") {
    return `
      <div class="topbar ltr-bar">
        <div class="topbar-brand whoami-brand">Who Am I?</div>
        <button class="icon-btn" data-action="wa-exit" type="button">${onBackLabel}</button>
      </div>
    `;
  }

  function render(state, { el, escapeHtml, escapeAttr }) {
    const map = {
      "wa-home": renderHome,
      "wa-setup": renderSetup,
      "wa-pass": renderPass,
      "wa-role": renderRole,
      "wa-ask": renderAsk,
      "wa-guess-pass": renderGuessPass,
      "wa-guess": renderGuess,
      "wa-result": renderResult,
    };
    const fn = map[state.step] || renderHome;
    return fn(state, { el, escapeHtml, escapeAttr });
  }

  function renderHome(state, { el }) {
    return el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        ${topBar()}
        <header class="brand whoami-hero">
          <p class="eyebrow">Football legends</p>
          <h1>Who Am I?</h1>
          <p>You never see your own player — only everyone else's. Ask smart questions and figure out who you are.</p>
        </header>
        <div class="panel">
          <ul class="howto">
            <li>
              <span class="num">1</span>
              <div>
                <strong>2 or 3 players</strong>
                <p>Each person gets a secret football star from the top 800 by market value.</p>
              </div>
            </li>
            <li>
              <span class="num">2</span>
              <div>
                <strong>Pass the phone</strong>
                <p>You see the others' players with photos — never your own.</p>
              </div>
            </li>
            <li>
              <span class="num">3</span>
              <div>
                <strong>Ask & guess</strong>
                <p>Ask yes/no questions about yourself, then guess who you are.</p>
              </div>
            </li>
          </ul>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-setup">Play</button>
          <button class="btn btn-ghost" data-action="wa-exit">Back to games</button>
        </div>
      </section>
    `);
  }

  function renderSetup(state, { el, escapeAttr }) {
    const fields = state.players
      .map(
        (name, i) => `
        <div class="field">
          <label for="wa-p${i}">Player ${i + 1}</label>
          <input id="wa-p${i}" data-wa-player="${i}" maxlength="20" placeholder="Name" value="${escapeAttr(name)}" autocomplete="off" />
        </div>`
      )
      .join("");

    const screen = el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        ${topBar()}
        <header class="brand compact whoami-hero">
          <h1>Players</h1>
          <p>Choose 2 or 3 friends and enter names</p>
        </header>
        <div class="panel">
          <h2>How many?</h2>
          <div class="choice-grid" style="margin-bottom:16px">
            <button class="choice ${state.playerCount === 2 ? "selected" : ""}" data-wa-count="2" type="button">
              <strong>2 players</strong>
              <span>You know theirs — they know yours</span>
            </button>
            <button class="choice ${state.playerCount === 3 ? "selected" : ""}" data-wa-count="3" type="button">
              <strong>3 players</strong>
              <span>Each sees the other two stars</span>
            </button>
          </div>
          <h2>Names</h2>
          ${fields}
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-start">Deal identities</button>
          <button class="btn btn-ghost" data-action="wa-home">Back</button>
        </div>
      </section>
    `);

    screen.querySelectorAll("[data-wa-count]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.waCount);
        state.playerCount = n;
        while (state.players.length < n) state.players.push("");
        state.players = state.players.slice(0, n);
        window.__whoamiRerender && window.__whoamiRerender();
      });
    });

    screen.querySelectorAll("[data-wa-player]").forEach((input) => {
      input.addEventListener("input", (e) => {
        state.players[Number(e.target.dataset.waPlayer)] = e.target.value;
      });
    });

    return screen;
  }

  function renderPass(state, { el, escapeHtml }) {
    const name = state.players[state.revealIndex];
    return el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <div class="cover-card">
          <div class="pulse-ring" aria-hidden="true"></div>
          <div class="eyebrow">Pass the phone</div>
          <h2>${escapeHtml(name)}</h2>
          <p>Give the phone to <strong>${escapeHtml(name)}</strong> only. Others look away.</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-open-role">I am ${escapeHtml(name)} — show me</button>
        </div>
      </section>
    `);
  }

  function renderRole(state, { el, escapeHtml }) {
    const i = state.revealIndex;
    const viewer = state.players[i];
    const others = state.players
      .map((name, idx) => ({ name, player: state.identities[idx], idx }))
      .filter((row) => row.idx !== i);

    const cards = others
      .map(
        (row) => `
        <article class="player-card" data-wiki="${escapeHtml(row.player.wiki)}">
          <div class="player-photo-wrap">
            <img class="player-photo" alt="${escapeHtml(row.player.name)}" src="${fallbackAvatar(row.player.name)}" data-photo-wiki="${escapeHtml(row.player.wiki)}" />
            <span class="era-tag ${row.player.era}">${row.player.era === "retired" ? "Legend" : "Active"}</span>
          </div>
          <div class="player-meta">
            <p class="player-owner">${escapeHtml(row.name)} is</p>
            <h3>${escapeHtml(row.player.name)}</h3>
          </div>
        </article>`
      )
      .join("");

    const nextLabel =
      i >= state.playerCount - 1 ? "Everyone ready — start asking" : "Hide & pass to next";

    const screen = el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <div class="panel">
          <p class="hint" style="margin-bottom:8px">${escapeHtml(viewer)} — you are NOT shown below</p>
          <h2 class="wa-secret-title">Your secret stays hidden</h2>
          <p class="hint">Memorize who the others are, then pass the phone.</p>
          <div class="player-cards">${cards}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-next-reveal">${nextLabel}</button>
        </div>
      </section>
    `);

    hydratePhotos(screen);
    return screen;
  }

  function hydratePhotos(root) {
    root.querySelectorAll("[data-photo-wiki]").forEach(async (img) => {
      const wiki = img.getAttribute("data-photo-wiki");
      const player = (window.WHOAMI_PLAYERS || []).find((p) => p.wiki === wiki);
      if (!player) return;
      const url = await loadImage(player);
      img.src = url;
    });
  }

  function renderAsk(state, { el }) {
    return el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <header class="brand compact whoami-hero">
          <h1>Ask away</h1>
          <p>Yes / no questions only. Don't say the name out loud if you know it.</p>
        </header>
        <div class="panel">
          <ul class="howto">
            <li>
              <span class="num">?</span>
              <div>
                <strong>Examples</strong>
                <p>“Am I a striker?”, “Did I play for Real Madrid?”, “Am I retired?”</p>
              </div>
            </li>
          </ul>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-start-guess">Time to guess</button>
        </div>
      </section>
    `);
  }

  function renderGuessPass(state, { el, escapeHtml }) {
    const name = state.players[state.currentGuesser];
    return el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <div class="cover-card">
          <div class="eyebrow">Guessing round</div>
          <h2>${escapeHtml(name)}</h2>
          <p>Pass the phone to <strong>${escapeHtml(name)}</strong> to pick who they think they are.</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-open-guess">I am ${escapeHtml(name)} — guess</button>
        </div>
      </section>
    `);
  }

  function renderGuess(state, { el, escapeHtml, escapeAttr }) {
    const options = state.guessOptions
      .map((p) => {
        const selected = state.selectedGuess === p.name ? "selected" : "";
        return `
          <button class="guess-player ${selected}" data-wa-guess="${escapeAttr(p.name)}" type="button">
            <img alt="" src="${fallbackAvatar(p.name)}" data-photo-wiki="${escapeHtml(p.wiki)}" />
            <span>${escapeHtml(p.name)}</span>
          </button>`;
      })
      .join("");

    const screen = el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <div class="panel">
          <h2>${escapeHtml(state.players[state.currentGuesser])}</h2>
          <p class="hint">Who do you think you are?</p>
          <div class="guess-players">${options}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-confirm-guess" ${state.selectedGuess ? "" : "disabled"}>Lock guess</button>
        </div>
      </section>
    `);
    hydratePhotos(screen);
    return screen;
  }

  function renderResult(state, { el, escapeHtml }) {
    const rows = state.players
      .map((name, i) => {
        const real = state.identities[i];
        const guess = state.guesses[i];
        const ok = guess === real.name;
        return `
          <article class="result-player ${ok ? "ok" : "no"}">
            <img alt="" src="${fallbackAvatar(real.name)}" data-photo-wiki="${escapeHtml(real.wiki)}" />
            <div>
              <strong>${escapeHtml(name)}</strong>
              <p>Was: ${escapeHtml(real.name)}</p>
              <p>Guessed: ${escapeHtml(guess || "—")} ${ok ? "✓" : "✗"}</p>
            </div>
          </article>`;
      })
      .join("");

    const correct = state.guesses.filter((g, i) => g === state.identities[i].name).length;

    const screen = el(`
      <section class="screen whoami-screen" dir="ltr" lang="en">
        <div class="panel result-hero">
          <span class="tag ${correct === state.playerCount ? "win" : "lose"}">${correct}/${state.playerCount} correct</span>
          <h2>Reveal</h2>
          <p class="hint">Here is who everyone really was</p>
          <div class="result-players">${rows}</div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" data-action="wa-again">Play again</button>
          <button class="btn btn-secondary" data-action="wa-setup">Change players</button>
          <button class="btn btn-ghost" data-action="wa-exit">All games</button>
        </div>
      </section>
    `);
    hydratePhotos(screen);
    return screen;
  }

  function validateNames(state) {
    const cleaned = state.players.map((p) => p.trim());
    if (cleaned.some((p) => !p)) return { ok: false, msg: "Enter every player name" };
    const lower = cleaned.map((p) => p.toLowerCase());
    if (new Set(lower).size !== lower.length) return { ok: false, msg: "Names must be different" };
    state.players = cleaned;
    return { ok: true };
  }

  function buildGuessOptions(state, guesserIndex) {
    const real = state.identities[guesserIndex];
    const decoys = shuffle(
      (window.WHOAMI_PLAYERS || []).filter((p) => p.name !== real.name)
    ).slice(0, 7);
    return shuffle([real, ...decoys]);
  }

  function handleAction(action, state, ctx) {
    switch (action) {
      case "wa-home":
        state.step = "wa-home";
        return true;
      case "wa-setup":
        state.step = "wa-setup";
        return true;
      case "wa-exit":
        ctx.onExit();
        return true;
      case "wa-start": {
        const v = validateNames(state);
        if (!v.ok) {
          ctx.alert(v.msg);
          return true;
        }
        if (!(window.WHOAMI_PLAYERS && window.WHOAMI_PLAYERS.length >= state.playerCount + 7)) {
          ctx.alert("Player database missing");
          return true;
        }
        assignIdentities(state);
        state.revealIndex = 0;
        state.guesses = [];
        state.currentGuesser = 0;
        state.selectedGuess = null;
        state.step = "wa-pass";
        return true;
      }
      case "wa-open-role":
        state.step = "wa-role";
        return true;
      case "wa-next-reveal":
        if (state.revealIndex >= state.playerCount - 1) {
          state.step = "wa-ask";
        } else {
          state.revealIndex += 1;
          state.step = "wa-pass";
        }
        return true;
      case "wa-start-guess":
        state.currentGuesser = 0;
        state.guesses = [];
        state.selectedGuess = null;
        state.guessOptions = buildGuessOptions(state, 0);
        state.step = "wa-guess-pass";
        return true;
      case "wa-open-guess":
        state.selectedGuess = null;
        state.guessOptions = buildGuessOptions(state, state.currentGuesser);
        state.step = "wa-guess";
        return true;
      case "wa-confirm-guess":
        if (!state.selectedGuess) return true;
        state.guesses[state.currentGuesser] = state.selectedGuess;
        if (state.currentGuesser >= state.playerCount - 1) {
          state.step = "wa-result";
        } else {
          state.currentGuesser += 1;
          state.selectedGuess = null;
          state.step = "wa-guess-pass";
        }
        return true;
      case "wa-again":
        assignIdentities(state);
        state.revealIndex = 0;
        state.guesses = [];
        state.currentGuesser = 0;
        state.selectedGuess = null;
        state.step = "wa-pass";
        return true;
      default:
        return false;
    }
  }

  window.WhoAmI = {
    createState,
    render,
    handleAction,
    selectGuess(state, name) {
      state.selectedGuess = name;
    },
  };
})();
