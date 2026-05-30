// ══════════════════════════════════════════════════════════════
// Laye5lo — Lebanese Card Games (Lee5a + Tarneeb 400)
// ══════════════════════════════════════════════════════════════

const BACKEND_URL = "https://laye5lo-server.onrender.com";
const socket = io(BACKEND_URL);

// ── CONFIG ───────────────────────────────────────────────────
const CONFIG = {
  winScore: 101,
  tarneebWinScore: 400,
  handSize: 13,
  giftCount: 3,
  timerSeconds: 20,
  botDelayMs: 680,
  trickDelayMs: 1150,
};

// ── SOUND ENGINE (Web Audio API) ─────────────────────────────
let soundEnabled = localStorage.getItem('laye5lo-sound') !== 'off';
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playCardSound() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.08);
}
function playTrickWinSound() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15 + i * 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.05);
    osc.stop(ctx.currentTime + 0.15 + i * 0.05);
  });
}
function playLee5aSound() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.connect(gain).connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.3);
}

// ── THEME ────────────────────────────────────────────────────
let darkMode = localStorage.getItem('laye5lo-theme') !== 'light';
function applyTheme() {
  document.getElementById('game').classList.toggle('light-mode', !darkMode);
}

// ── LEE5A CONSTANTS ──────────────────────────────────────────
const COLOR_ORDER = ['red', 'blue', 'green', 'yellow'];
const STRENGTH = { '1': 13, 'skip': 12, 'draw2': 11, 'reverse': 10, '0': 9, '9': 8, '8': 7, '7': 6, '6': 5, '5': 4, '4': 3, '3': 2, '2': 1 };
const COLOR_CLASS = { red: 'cr', blue: 'cb', green: 'cg', yellow: 'cy' };
const COLOR_PIP = { red: '♦', blue: '●', green: '▲', yellow: '★' };
const AVATARS = ['Y', 'B1', 'B2', 'B3'];
const DEFAULT_NAMES = ['You', 'Bot 1', 'Bot 2', 'Bot 3'];

// ── TARNEEB CONSTANTS ────────────────────────────────────────
const TARNEEB_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const TARNEEB_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const TARNEEB_RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const SUIT_SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_COLOR = { spades: '#222', hearts: '#cc1111', diamonds: '#cc1111', clubs: '#222' };
const SUIT_CLASS = { spades: 'cs', hearts: 'ch', diamonds: 'cd', clubs: 'cc' };

// ── SOCKET EVENTS ────────────────────────────────────────────
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  const saved = sessionStorage.getItem('laye5lo-room');
  if (saved) {
    const { roomCode, seatIndex, name } = JSON.parse(saved);
    socket.emit('rejoinRoom', { roomCode, seatIndex, name });
  }
});
socket.on("disconnect", () => console.log("Disconnected"));

socket.on("roomCreated", (data) => {
  G = { ...G, phase: "roomLobby", modal: null, roomCode: data.roomCode, isHost: true,
    roomMsg: "Room created! Share this code: " + data.roomCode, roomPlayers: mapOnlineSeats(data.seats) };
  render();
});

socket.on("roomUpdated", (data) => {
  const weAreHost = data.hostId === socket.id;
  G = { ...G, phase: "roomLobby", modal: null, roomCode: data.roomCode, isHost: weAreHost,
    roomMsg: weAreHost ? "Lobby updated. Players: " + data.seats.filter(Boolean).length : "Waiting for host...",
    roomPlayers: mapOnlineSeats(data.seats) };
  render();
});

socket.on("gameStarted", (data) => {
  const gs = data.gameState;
  playerNames = [...gs.playerNames];
  mySeatIndex = data.mySeatIndex;
  sessionStorage.setItem('laye5lo-room', JSON.stringify({ roomCode: data.roomCode, seatIndex: mySeatIndex, name: playerNames[mySeatIndex] }));
  nextRoundStarter = 0;
  resolving = false;
  giftedIds = new Set();
  stopTimer();
  G = { ...gs, phase: 'dealing', roomCode: data.roomCode, isHost: G.isHost, giftSubmitted: false, roomMsg: '' };
  render();
  runDealAnimation(() => { G.phase = gs.phase; render(); });
});

socket.on("gameState", (data) => {
  const gs = data.gameState;
  const wasGift = G.phase === 'gift';
  const wasRoundEnd = G.phase === 'roundEnd' || G.phase === 'gameEnd';
  const nowPlay = gs.phase === 'play';
  const nowGift = gs.phase === 'gift';
  if (wasRoundEnd && nowGift) { stopTimer(); giftedIds = new Set(); resolving = false; }
  playerNames = [...gs.playerNames];
  mySeatIndex = data.mySeatIndex;
  G = { ...gs, roomCode: data.roomCode, isHost: G.isHost,
    giftSubmitted: gs.phase === 'gift' ? (G.giftSubmitted || false) : false,
    roomMsg: gs.phase === 'gift' ? (G.roomMsg || '') : '' };
  if (wasGift && nowPlay) {
    resolving = false; stopTimer();
    if (gs.receivedGiftCardIdsBySeat && gs.receivedGiftCardIdsBySeat[data.mySeatIndex]) {
      giftedIds = new Set(gs.receivedGiftCardIdsBySeat[data.mySeatIndex]);
      setTimeout(() => { giftedIds = new Set(); render(); }, 3000);
    } else { giftedIds = new Set(); }
    if (G.currentPlayer === mySeatIndex) startTimer();
  }
  render();
});

socket.on("lobbyError", (message) => { G.roomMsg = message; render(); });
socket.on("joinError", (message) => alert(message));

// Tarneeb socket events
socket.on("tarneeb:gameStarted", (data) => {
  playerNames = [...data.gameState.playerNames];
  mySeatIndex = data.mySeatIndex;
  sessionStorage.setItem('laye5lo-room', JSON.stringify({ roomCode: data.roomCode, seatIndex: mySeatIndex, name: playerNames[mySeatIndex] }));
  TG = { ...data.gameState };
  G = { phase: 'tarneeb', roomCode: data.roomCode, isHost: G.isHost, modal: null };
  render();
});

socket.on("tarneeb:state", (data) => {
  TG = { ...data.gameState };
  mySeatIndex = data.mySeatIndex;
  G = { ...G, phase: 'tarneeb', roomCode: data.roomCode };
  render();
});

// Reactions
socket.on("reaction", (data) => {
  showFloatingReaction(data.seatIndex, data.emoji);
});

function mapOnlineSeats(seats) {
  const mapped = (seats || []).map(s => s ? { type: s.type, name: s.name, id: s.id } : null);
  while (mapped.length < 4) mapped.push(null);
  return mapped.slice(0, 4);
}

// ── LEE5A DECK & HELPERS ─────────────────────────────────────
function buildDeck() {
  const d = [];
  COLOR_ORDER.forEach(col => ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'draw2', 'reverse'].forEach(t => d.push({ color: col, type: t, id: `${col}-${t}` })));
  return d;
}
function shuffle(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = 0 | Math.random() * (i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function str(c) { return STRENGTH[c.type] || 0; }
function pts(c) { if (c.color === 'blue' && c.type === 'draw2') return 13; if (c.color === 'yellow' && c.type === '0') return 10; if (c.color === 'red') return 1; return 0; }
function isLee(c) { return (c.color === 'blue' && c.type === 'draw2') || (c.color === 'yellow' && c.type === '0'); }
function lbl(c) { if (c.type === 'draw2') return '+2'; if (c.type === 'skip') return '&#8856;'; if (c.type === 'reverse') return '&#8634;'; return c.type; }
function sortHand(h) { return [...h].sort((a, b) => { const ci = COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color); return ci || str(b) - str(a); }); }

function giftViolatesColor(hand, sel) {
  if (!hand.some(c => isLee(c))) return false;
  const selIds = new Set(sel.map(c => c.id));
  const groups = {};
  hand.forEach(c => { (groups[c.color] = groups[c.color] || []).push(c); });
  return Object.values(groups).some(cards => cards.every(c => selIds.has(c.id)));
}
function colorCounts(hand) { return COLOR_ORDER.reduce((m, col) => { m[col] = hand.filter(c => c.color === col).length; return m; }, {}); }
function isLeeColor(color) { return color === 'blue' || color === 'yellow'; }

function scoreGiftCandidate(card, hand, selected, difficulty) {
  const counts = colorCounts(hand);
  const selectedColorCount = selected.filter(c => c.color === card.color).length;
  const afterColorCount = counts[card.color] - selectedColorCount - 1;
  const hasLee = hand.some(isLee);
  const hasLeeInColor = hand.some(c => isLee(c) && c.color === card.color);
  const unknownSameColor = 13 - counts[card.color];
  const avgPerOpponent = unknownSameColor / 3;
  let score = pts(card) * 3.5 + str(card) * 0.18;
  if (difficulty === 'medium') score += Math.random() * 0.4;
  if (hasLee) {
    if (isLee(card)) { if (counts[card.color] <= 3) score += 22; else if (counts[card.color] === 4) score -= 46; else score -= 48; if (afterColorCount <= 1) score -= 8; }
    else if (hasLeeInColor) { score -= counts[card.color] >= 4 ? 10 : 24; if (pts(card) > 0) score += 10; if (counts[card.color] > 5) score += 3; }
    else { if (card.color === 'green') score += 6; else if (card.color === 'red') score += 3; else score += 2; }
    if (afterColorCount <= 1) score -= difficulty === 'hard' ? 12 : 6;
    if (difficulty === 'hard' && hasLeeInColor) { score += counts[card.color] > avgPerOpponent + 1 ? 4 : -8; }
  } else {
    if (isLeeColor(card.color)) { score += counts[card.color] <= 3 ? -12 : 2; if (difficulty === 'hard' && counts[card.color] < avgPerOpponent) score -= 8; }
    else { score += card.color === 'green' ? 5 : 4; }
    if (afterColorCount === 0) score -= difficulty === 'hard' ? 12 : 6;
  }
  return score;
}
function chooseSmartGift(hand, difficulty) {
  if (difficulty === 'easy') {
    const hasLee = hand.some(c => isLee(c));
    const sorted = [...hand].sort((a, b) => pts(b) - pts(a) || str(b) - str(a));
    if (hasLee) {
      const chosen = [];
      for (const c of sorted) { if (chosen.length === 3) break; if (!giftViolatesColor(hand, [...chosen, c])) chosen.push(c); }
      while (chosen.length < 3) { const c = sorted.find(x => !chosen.includes(x)); if (c) chosen.push(c); else break; }
      return chosen;
    }
    return sorted.slice(0, 3);
  }
  const chosen = [];
  while (chosen.length < 3) {
    const candidates = hand.filter(c => !chosen.includes(c) && !giftViolatesColor(hand, [...chosen, c]));
    const pool = candidates.length ? candidates : hand.filter(c => !chosen.includes(c));
    if (!pool.length) break;
    pool.sort((a, b) => scoreGiftCandidate(b, hand, chosen, difficulty) - scoreGiftCandidate(a, hand, chosen, difficulty));
    chosen.push(pool[0]);
  }
  return chosen;
}

function trickWinner(table, leadColor) {
  const lead = table.filter(t => t.card.color === leadColor);
  let w = lead[0]; lead.forEach(t => { if (str(t.card) > str(w.card)) w = t; }); return w;
}
function hasBothLees(table) { return table.filter(t => isLee(t.card)).length === 2; }
function hasNextTrickPlayer(p) {
  const alreadyPlayed = new Set(G.table.map(t => t.pi));
  for (let i = 1; i <= 4; i++) { const n = (p + i) % 4; if (G.hands[n].length > 0 && !alreadyPlayed.has(n)) return true; }
  return false;
}

// ── AUTH STATE ───────────────────────────────────────────────
let authToken = localStorage.getItem('laye5lo-token') || null;
let currentUser = null;

function authHeaders() {
  return authToken ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken } : { 'Content-Type': 'application/json' };
}

async function apiCall(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BACKEND_URL + path, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function loadCurrentUser() {
  if (!authToken) return;
  const { ok, data } = await apiCall('GET', '/api/user/profile');
  if (ok) { currentUser = data.user; }
  else { authToken = null; currentUser = null; localStorage.removeItem('laye5lo-token'); }
}

window.authLogout = function() {
  authToken = null; currentUser = null;
  localStorage.removeItem('laye5lo-token');
  localStorage.removeItem('laye5lo-name');
  render();
};

// Called at startup to restore session
loadCurrentUser().then(() => render());

// ── AUTH HTML BUILDERS ───────────────────────────────────────
function buildAuthHTML(mode) {
  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isVerify = mode === 'verify';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  let title, fields, submitLabel, links;

  if (isLogin) {
    title = 'Sign In';
    fields = `
      <input class="auth-field" id="af-email" type="email" placeholder="Email" autocomplete="email">
      <input class="auth-field" id="af-pass" type="password" placeholder="Password" autocomplete="current-password">`;
    submitLabel = 'Sign In';
    links = `<span class="auth-link" onclick="showAuth('forgot')">Forgot password?</span>
      <span class="auth-sep">·</span>
      <span class="auth-link" onclick="showAuth('register')">Create account</span>`;
  } else if (isRegister) {
    title = 'Create Account';
    fields = `
      <input class="auth-field" id="af-username" type="text" placeholder="Username (3–20 chars)" autocomplete="username" maxlength="20">
      <input class="auth-field" id="af-email" type="email" placeholder="Email" autocomplete="email">
      <input class="auth-field" id="af-pass" type="password" placeholder="Password (6+ chars)" autocomplete="new-password">`;
    submitLabel = 'Register';
    links = `<span class="auth-link" onclick="showAuth('login')">Already have an account?</span>`;
  } else if (isVerify) {
    title = 'Verify Email';
    fields = `
      <p style="font-size:11px;color:rgba(255,255,255,0.65);text-align:center">Enter the 6-digit code sent to your email.</p>
      <input class="auth-field" id="af-code" type="text" placeholder="123456" maxlength="6" style="text-align:center;letter-spacing:8px;font-size:22px">`;
    submitLabel = 'Verify';
    links = `<span class="auth-link" onclick="authResendCode()">Resend code</span>
      <span class="auth-sep">·</span>
      <span class="auth-link" onclick="showAuth('login')">Back to login</span>`;
  } else if (isForgot) {
    title = 'Reset Password';
    fields = `
      <input class="auth-field" id="af-email" type="email" placeholder="Email address" autocomplete="email">`;
    submitLabel = 'Send Code';
    links = `<span class="auth-link" onclick="showAuth('login')">Back to login</span>`;
  } else if (isReset) {
    title = 'New Password';
    fields = `
      <input class="auth-field" id="af-code" type="text" placeholder="Reset code" maxlength="6" style="text-align:center;letter-spacing:8px">
      <input class="auth-field" id="af-pass" type="password" placeholder="New password (6+ chars)" autocomplete="new-password">`;
    submitLabel = 'Set Password';
    links = `<span class="auth-link" onclick="showAuth('forgot')">Re-send code</span>`;
  }

  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back to menu">&lsaquo;</button>
<div class="menu-screen room-screen">
  <div class="room-panel" style="gap:12px">
    <h1 style="font-size:26px">${title}</h1>
    ${fields}
    <div class="auth-error" id="auth-err"></div>
    <div class="auth-success" id="auth-ok"></div>
    <button class="menu-btn primary" id="auth-submit-btn" onclick="authSubmit('${mode}')">${submitLabel}</button>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center">
      ${links}
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.1);width:100%;padding-top:10px;text-align:center">
      <span class="auth-link" onclick="backToMenu()">Continue as guest</span>
    </div>
  </div>
</div>`;
}

window.showAuth = function(mode) {
  G._authMode = mode;
  G._authEmail = G._authEmail || '';
  G.phase = 'auth';
  render();
};

window.authSubmit = async function(mode) {
  const btn = document.getElementById('auth-submit-btn');
  const errEl = document.getElementById('auth-err');
  const okEl = document.getElementById('auth-ok');
  if (!errEl) return;
  errEl.textContent = ''; okEl.textContent = '';
  if (btn) btn.disabled = true;

  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  try {
    if (mode === 'login') {
      const email = val('af-email'), pass = val('af-pass');
      if (!email || !pass) { errEl.textContent = 'Please fill in all fields.'; return; }
      const { ok, data } = await apiCall('POST', '/api/auth/login', { email, password: pass });
      if (ok) {
        authToken = data.token; currentUser = data.user;
        localStorage.setItem('laye5lo-token', authToken);
        localStorage.setItem('laye5lo-name', data.user.username);
        if (!data.user.isVerified) {
          G._authEmail = data.user.email; G._authMode = 'verify';
          okEl.textContent = 'Login successful! Please verify your email.';
          setTimeout(() => { G.phase = 'auth'; render(); }, 1200);
        } else {
          initMenu();
        }
      } else { errEl.textContent = data.error || 'Login failed.'; }

    } else if (mode === 'register') {
      const username = val('af-username'), email = val('af-email'), pass = val('af-pass');
      if (!username || !email || !pass) { errEl.textContent = 'Please fill in all fields.'; return; }
      const { ok, data } = await apiCall('POST', '/api/auth/register', { username, email, password: pass });
      if (ok) {
        authToken = data.token; currentUser = data.user;
        localStorage.setItem('laye5lo-token', authToken);
        localStorage.setItem('laye5lo-name', data.user.username);
        G._authEmail = email; G._authMode = 'verify';
        okEl.textContent = 'Check your email for a verification code!';
        setTimeout(() => { G.phase = 'auth'; render(); }, 1200);
      } else { errEl.textContent = data.error || 'Registration failed.'; }

    } else if (mode === 'verify') {
      const code = val('af-code');
      if (!code || code.length < 6) { errEl.textContent = 'Enter the 6-digit code.'; return; }
      const email = G._authEmail || (currentUser && currentUser.email) || '';
      const { ok, data } = await apiCall('POST', '/api/auth/verify', { email, code });
      if (ok) {
        if (currentUser) currentUser.isVerified = true;
        okEl.textContent = 'Email verified! Welcome.';
        setTimeout(() => initMenu(), 900);
      } else { errEl.textContent = data.error || 'Invalid code.'; }

    } else if (mode === 'forgot') {
      const email = val('af-email');
      if (!email) { errEl.textContent = 'Enter your email.'; return; }
      G._authEmail = email;
      const { ok, data } = await apiCall('POST', '/api/auth/forgot-password', { email });
      okEl.textContent = data.message || 'If the account exists, a code was sent.';
      setTimeout(() => { G._authMode = 'reset'; G.phase = 'auth'; render(); }, 1500);

    } else if (mode === 'reset') {
      const code = val('af-code'), pass = val('af-pass');
      if (!code || !pass) { errEl.textContent = 'Fill in both fields.'; return; }
      const email = G._authEmail || '';
      const { ok, data } = await apiCall('POST', '/api/auth/reset-password', { email, code, newPassword: pass });
      if (ok) {
        okEl.textContent = 'Password reset! Please log in.';
        setTimeout(() => { G._authMode = 'login'; G.phase = 'auth'; render(); }, 1200);
      } else { errEl.textContent = data.error || 'Reset failed.'; }
    }
  } catch (e) {
    errEl.textContent = 'Network error. Please try again.';
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.authResendCode = async function() {
  const errEl = document.getElementById('auth-err');
  const okEl = document.getElementById('auth-ok');
  const email = G._authEmail || (currentUser && currentUser.email) || '';
  if (!email) { if (errEl) errEl.textContent = 'No email on file.'; return; }
  const { ok, data } = await apiCall('POST', '/api/auth/resend-code', { email });
  if (ok) { if (okEl) okEl.textContent = 'Code resent!'; }
  else { if (errEl) errEl.textContent = data.error || 'Failed to resend.'; }
};

// ── DEALING ANIMATION ────────────────────────────────────────
function runDealAnimation(onDone) {
  const gameEl = document.getElementById('game');
  if (!gameEl) { onDone(); return; }
  const overlay = document.createElement('div');
  overlay.className = 'dealing-overlay';
  gameEl.appendChild(overlay);

  const W = gameEl.offsetWidth || 360;
  const H = gameEl.offsetHeight || 620;
  const cx = W / 2, cy = H / 2;

  // Destination centers for each relative position (bottom=me, right, top, left)
  const dests = [
    [cx, H * 0.82],   // bottom
    [W * 0.85, cy],   // right
    [cx, H * 0.10],   // top
    [W * 0.15, cy],   // left
  ];

  const totalCards = 52;
  let done = 0;

  for (let i = 0; i < totalCards; i++) {
    const seat = i % 4;
    const relPos = (seat - mySeatIndex + 4) % 4;
    const [dx, dy] = dests[relPos];
    const delay = i * 30;
    const dur = 380;

    const el = document.createElement('div');
    el.className = 'deal-fly card cback';
    // Start at center, fly to destination
    el.style.cssText = `left:${cx - 27}px;top:${cy - 41}px;width:54px;height:82px;` +
      `--deal-sx:0px;--deal-sy:0px;--deal-dur:${dur}ms;--deal-delay:${delay}ms;`;
    // Override keyframe to go from center to dest using JS animation
    el.animate([
      { transform: 'translate(0,0) scale(0.5)', opacity: 0.8 },
      { transform: `translate(${dx - cx}px,${dy - cy}px) scale(1)`, opacity: 1 }
    ], { duration: dur, delay, fill: 'both', easing: 'cubic-bezier(0.22,0.61,0.36,1)' });

    overlay.appendChild(el);

    setTimeout(() => {
      el.remove();
      done++;
      if (done === totalCards) { overlay.remove(); onDone(); }
    }, delay + dur + 60);
  }
}

// ── GAME STATE ───────────────────────────────────────────────
let G = { phase: 'menu', modal: null, roomCode: null, roomMsg: '', gameMode: localStorage.getItem('laye5lo-mode') || '' };
let TG = null; // Tarneeb state
let mySeatIndex = 0;
let resolving = false;
let turnTimer = null;
let turnTimeLeft = CONFIG.timerSeconds;
let giftedIds = new Set();
let playerNames = [...DEFAULT_NAMES];
let nextRoundStarter = 0;
let botDifficulty = 'easy';
let lastTrick = null;
let lastHoveredCard = null;

function initMenu() {
  stopTimer();
  mySeatIndex = 0;
  G = { phase: 'menu', modal: null, roomCode: null, roomMsg: '', gameMode: G.gameMode || '' };
  TG = null;
  resolving = false; giftedIds = new Set(); render();
}

function initGame(names = [...DEFAULT_NAMES]) {
  playerNames = [...names];
  nextRoundStarter = 0;
  lastTrick = null;
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  G = { phase: 'dealing', gameMode: 'lee5a', hands: hands.map(sortHand), gifts: [null, null, null, null], table: [],
    currentPlayer: 0, leadColor: null, scores: [0, 0, 0, 0], roundPts: [0, 0, 0, 0],
    selected: [], statusMsg: `Choose 3 cards to gift to ${pname(1)}`, botThought: '', playedCards: [], knownGiftedLees: [], modal: null };
  resolving = false; giftedIds = new Set(); stopTimer();
  render();
  runDealAnimation(() => { G.phase = 'gift'; render(); });
}

// ── TARNEEB DECK & HELPERS ───────────────────────────────────
function buildTarneebDeck() {
  const d = [];
  TARNEEB_SUITS.forEach(suit => TARNEEB_RANKS.forEach(rank => d.push({ suit, rank, id: `${suit}-${rank}`, val: TARNEEB_RANK_VAL[rank] })));
  return d;
}
function sortTarneebHand(h) {
  const suitOrder = TARNEEB_SUITS;
  return [...h].sort((a, b) => {
    const si = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    return si || b.val - a.val;
  });
}

function initTarneeb(names = [...DEFAULT_NAMES]) {
  playerNames = [...names];
  const deck = shuffle(buildTarneebDeck());
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  TG = {
    phase: 'bid', hands: hands.map(sortTarneebHand),
    dealer: 0, currentBidder: 1, highBid: { amount: 0, seat: -1 },
    passes: 0, trump: null, biddingTeam: null, bidAmount: 0,
    currentPlayer: 0, table: [], leadSuit: null,
    scores: [0, 0], tricksTaken: [0, 0], roundHistory: [],
    bidLog: [], playerNames: [...names]
  };
  G = { phase: 'dealing', gameMode: 'tarneeb', modal: null, roomCode: null, roomMsg: '' };
  resolving = false; stopTimer();
  render();
  runDealAnimation(() => { G.phase = 'tarneeb'; render(); if (TG.currentBidder !== mySeatIndex) setTimeout(tarneebBotTurn, CONFIG.botDelayMs); });
}

function getPlayableTarneeb(seatIdx) {
  const hand = TG.hands[seatIdx];
  if (!TG.leadSuit) return hand;
  const suited = hand.filter(c => c.suit === TG.leadSuit);
  if (suited.length) return suited;
  return hand;
}

function tarneebTrickWinner(table, leadSuit, trump) {
  let best = table[0];
  for (let i = 1; i < table.length; i++) {
    const c = table[i];
    const bestIsTrump = best.card.suit === trump;
    const cIsTrump = c.card.suit === trump;
    if (cIsTrump && !bestIsTrump) { best = c; }
    else if (cIsTrump && bestIsTrump) { if (c.card.val > best.card.val) best = c; }
    else if (!cIsTrump && !bestIsTrump && c.card.suit === leadSuit && best.card.suit === leadSuit) {
      if (c.card.val > best.card.val) best = c;
    } else if (!cIsTrump && !bestIsTrump && c.card.suit === leadSuit && best.card.suit !== leadSuit) {
      best = c;
    }
  }
  return best;
}

function teamOf(seat) { return seat % 2; }

// Tarneeb bot bidding AI
function botBid(seatIdx) {
  const hand = TG.hands[seatIdx];
  let est = 0;
  const suitCounts = {};
  TARNEEB_SUITS.forEach(s => { suitCounts[s] = hand.filter(c => c.suit === s).length; });
  hand.forEach(c => {
    if (c.val === 14) est += 1;
    else if (c.val === 13) est += 0.7;
    else if (c.val === 12) est += 0.4;
  });
  const longest = Math.max(...Object.values(suitCounts));
  est += Math.max(0, longest - 4) * 0.6;
  const bid = Math.max(7, Math.round(est));
  if (bid > TG.highBid.amount) return Math.min(bid, 13);
  return 0; // pass
}

// Tarneeb bot trump selection
function botSelectTrump(seatIdx) {
  const hand = TG.hands[seatIdx];
  const suitStrength = {};
  TARNEEB_SUITS.forEach(s => {
    const cards = hand.filter(c => c.suit === s);
    suitStrength[s] = cards.length * 2 + cards.reduce((sum, c) => sum + (c.val >= 12 ? 2 : c.val >= 10 ? 1 : 0), 0);
  });
  return TARNEEB_SUITS.reduce((best, s) => suitStrength[s] > suitStrength[best] ? s : best, 'spades');
}

// Tarneeb bot play AI
function botPlayTarneeb(seatIdx) {
  const playable = getPlayableTarneeb(seatIdx);
  if (playable.length === 1) return playable[0];
  const team = teamOf(seatIdx);
  const biddingTeam = TG.biddingTeam;
  const needTricks = team === biddingTeam;

  if (!TG.leadSuit) {
    // Leading
    if (needTricks) {
      const trumpCards = playable.filter(c => c.suit === TG.trump).sort((a, b) => b.val - a.val);
      if (trumpCards.length && trumpCards[0].val >= 13) return trumpCards[0];
      const highCards = playable.filter(c => c.val >= 13).sort((a, b) => b.val - a.val);
      if (highCards.length) return highCards[0];
    }
    return playable.sort((a, b) => a.val - b.val)[0];
  }

  // Following
  const isLast = TG.table.length === 3;
  if (isLast) {
    const currentWinner = tarneebTrickWinner(TG.table, TG.leadSuit, TG.trump);
    const partnerIsWinning = teamOf(currentWinner.pi) === team;
    if (partnerIsWinning) return playable.sort((a, b) => a.val - b.val)[0];
    const winners = playable.filter(c => {
      const testTable = [...TG.table, { pi: seatIdx, card: c }];
      return tarneebTrickWinner(testTable, TG.leadSuit, TG.trump).pi === seatIdx;
    });
    if (winners.length) return winners.sort((a, b) => a.val - b.val)[0];
    return playable.sort((a, b) => a.val - b.val)[0];
  }

  if (needTricks) {
    const canWin = playable.filter(c => c.suit === TG.leadSuit || c.suit === TG.trump).sort((a, b) => b.val - a.val);
    if (canWin.length && canWin[0].val >= 12) return canWin[0];
  }
  return playable.sort((a, b) => a.val - b.val)[0];
}

// ── LEE5A PLAY LOGIC ─────────────────────────────────────────
function getPlayable(idx) {
  const h = G.hands[idx];
  if (!G.leadColor) return h;
  const s = h.filter(c => c.color === G.leadColor);
  if (s.length) return s;
  const l = h.filter(c => isLee(c));
  if (l.length) return l;
  return h;
}

function executePlay(pi, card, reason = '') {
  stopTimer();
  playCardSound();
  G.botThought = pi !== 0 && reason ? `${pname(pi)} chose ${lbl(card)} because ${reason}.` : '';
  if (!G.playedCards) G.playedCards = [];
  G.playedCards.push(card);
  G.table.push({ pi, card });
  G.hands[pi] = sortHand(G.hands[pi].filter(c => c.id !== card.id));
  if (!G.leadColor) G.leadColor = card.color;
  G.selected = [];
  if (hasBothLees(G.table) || G.table.length === 4 || !hasNextTrickPlayer(G.currentPlayer)) {
    resolving = true;
    G.statusMsg = hasBothLees(G.table) ? 'Both Lee5as taken! Round ends now.' : 'Trick complete...';
    render();
    setTimeout(finishTrick, CONFIG.trickDelayMs);
  } else {
    G.currentPlayer = nextTrickP(G.currentPlayer);
    setStatus(); render();
    if (G.currentPlayer === mySeatIndex) startTimer();
    else setTimeout(aiPlay, CONFIG.botDelayMs);
  }
}
function nextP(p) { return (p + 1) % 4; }
function nextActiveP(p) { for (let i = 1; i <= 4; i++) { const n = (p + i) % 4; if (G.hands[n].length > 0) return n; } return p; }
function rightOf(p) { return (p + 1) % 4; }
function nextTrickP(p) {
  const alreadyPlayed = new Set(G.table.map(t => t.pi));
  for (let i = 1; i <= 4; i++) { const n = (p + i) % 4; if (G.hands[n].length > 0 && !alreadyPlayed.has(n)) return n; }
  return nextActiveP(p);
}
function currentWinnerInfo(card) {
  if (!G.leadColor) return { winner: null, rank: 0 };
  const lead = G.table.filter(t => t.card.color === G.leadColor);
  let winner = lead[0] || null;
  lead.forEach(t => { if (str(t.card) > str(winner.card)) winner = t; });
  const cardWins = card.color === G.leadColor && (!winner || str(card) > str(winner.card));
  return { winner: cardWins ? { pi: G.currentPlayer, card } : winner, rank: winner ? str(winner.card) : 0 };
}
function wouldWinTrick(card) {
  if (!G.leadColor) return false;
  if (card.color !== G.leadColor) return false;
  const lead = G.table.filter(t => t.card.color === G.leadColor);
  if (!lead.length) return true;
  return str(card) > Math.max(...lead.map(t => str(t.card)));
}
function trickDangerWith(card) {
  const cards = [...G.table.map(t => t.card), card];
  const points = cards.reduce((s, c) => s + pts(c), 0);
  return cards.filter(c => isLee(c)).length === 2 ? 37 : points;
}
function playedCount(color) { return (G.playedCards || []).filter(c => c.color === color).length; }
function cardWasPlayed(color, type) { return (G.playedCards || []).some(c => c.color === color && c.type === type); }
function hiddenLeeIntel(idx) {
  const own = G.hands[idx] || [];
  return [{ color: 'blue', type: 'draw2', name: 'blue +2' }, { color: 'yellow', type: '0', name: 'yellow 0' }].map(lee => {
    const ownCount = own.filter(c => c.color === lee.color).length;
    const ownHas = own.some(c => c.color === lee.color && c.type === lee.type);
    const played = playedCount(lee.color);
    const leePlayed = cardWasPlayed(lee.color, lee.type);
    return { ...lee, played, ownCount, ownHas, hidden: !leePlayed && !ownHas, unknown: Math.max(0, 13 - played - ownCount) };
  });
}
function knownGiftedLeeFor(idx, color) {
  return (G.knownGiftedLees || []).find(g => g.from === idx && g.color === color && !cardWasPlayed(g.color, g.type));
}

function pickEasyCard(pl) {
  let c;
  if (!G.leadColor) { const ns = pl.filter(x => pts(x) === 0); c = (ns.length ? ns : pl).sort((a, b) => str(a) - str(b))[0]; }
  else {
    const same = pl.filter(x => x.color === G.leadColor);
    if (same.length) {
      const tm = Math.max(...G.table.map(t => str(t.card)));
      const safe = same.filter(x => str(x) < tm);
      c = safe.length ? safe.sort((a, b) => str(b) - str(a))[0] : same.sort((a, b) => str(a) - str(b))[0];
    } else {
      const sc = pl.filter(x => pts(x) > 0), isLast = G.table.length === 3;
      if (isLast && sc.length) {
        const lp = G.table.filter(t => t.card.color === G.leadColor);
        const lm = lp.length ? Math.max(...lp.map(t => str(t.card))) : 0;
        const ww = pl.filter(x => x.color === G.leadColor && str(x) > lm).length > 0;
        c = ww ? pl.sort((a, b) => str(a) - str(b))[0] : sc.sort((a, b) => pts(b) - pts(a))[0];
      } else if (sc.length) c = sc.sort((a, b) => pts(b) - pts(a))[0];
      else c = pl.sort((a, b) => str(b) - str(a))[0];
    }
  }
  return { card: c || pl[0], reason: 'easy bot follows the basic safe-card rule' };
}

function scoreBotCard(card, idx, difficulty) {
  const isLast = G.table.length === 3 || !hasNextTrickPlayer(idx);
  const danger = trickDangerWith(card);
  const wins = wouldWinTrick(card);
  const hasLeeOnTable = G.table.some(t => isLee(t.card));
  const ownLeeInLead = G.leadColor && G.hands[idx].some(c => isLee(c) && c.color === G.leadColor);
  const leadLeeStrength = G.leadColor === 'blue' ? str({ type: 'draw2' }) : G.leadColor === 'yellow' ? str({ type: '0' }) : 0;
  const intel = difficulty === 'hard' ? hiddenLeeIntel(idx) : [];
  const hiddenLee = intel.filter(x => x.hidden && !knownGiftedLeeFor(idx, x.color));
  const pressuredGift = G.leadColor ? knownGiftedLeeFor(idx, G.leadColor) : null;
  let score = 0; const reasons = [];

  if (!G.leadColor) {
    score -= pts(card) * 3; score -= str(card) * 0.25;
    const giftedPressure = knownGiftedLeeFor(idx, card.color);
    if (difficulty === 'hard' && card.color === 'green') { score += str(card) * 1.3 + 8; reasons.push('sheds a high green while no Lee5a can be attached to green'); }
    if (difficulty === 'hard' && giftedPressure) { score += 18 + str(card) * 0.35; reasons.push(`pressures ${pname(giftedPressure.to)} after gifting ${giftedPressure.name}`); }
    if (difficulty === 'hard') {
      const sameHidden = hiddenLee.find(x => x.color === card.color);
      if (sameHidden && sameHidden.unknown <= 2 && !isLee(card)) { score += str(card) <= 4 ? 12 : -10; reasons.push(`counts ${sameHidden.name} as likely hidden`); }
      if (hiddenLee.length && str(card) >= 10 && card.color !== 'green' && !giftedPressure) { score -= 8; reasons.push('avoids leading high while hidden Lee5a cards remain'); }
    }
    if (isLee(card)) { score -= difficulty === 'hard' ? 18 : 10; reasons.push('keeps Lee5a out of the lead'); }
    else reasons.push('opens with a low-risk card');
  } else if (card.color === G.leadColor) {
    if (ownLeeInLead && !isLee(card) && leadLeeStrength) {
      if (str(card) > leadLeeStrength && !wins) { score += difficulty === 'hard' ? 16 : 6; reasons.push('sheds a high cover card under a stronger lead'); }
      else if (str(card) > leadLeeStrength) { score -= difficulty === 'hard' ? 24 : 10; reasons.push('does not reveal Lee5a cover with a higher card'); }
      else if (!wins) { score += difficulty === 'hard' ? 12 : 5; reasons.push('uses a low cover card below its Lee5a'); }
    }
    if (ownLeeInLead && isLee(card) && !isLast) { score -= difficulty === 'hard' ? 22 : 12; reasons.push('keeps the Lee5a protected for later'); }
    if (wins) {
      score -= danger * (difficulty === 'hard' ? 5 : 3); score -= isLast ? 8 : 3;
      if (difficulty === 'hard' && !isLast && hiddenLee.length) {
        const leadPlayed = playedCount(G.leadColor);
        const pressure = leadPlayed >= 8 ? 18 : leadPlayed >= 6 ? 10 : 4;
        score -= pressure + hiddenLee.reduce((s, x) => s + (x.unknown <= 2 ? 10 : 4), 0);
        reasons.push('counts hidden Lee5a risk before taking control');
      }
      if (difficulty === 'hard' && pressuredGift && !hiddenLee.some(x => x.color === G.leadColor && x.unknown <= 2)) { score += 18 + str(card) * 0.4; reasons.push(`takes control to keep pressuring ${pressuredGift.name}`); }
      if (difficulty === 'hard' && G.leadColor === 'green') { score += 10; reasons.push('can safely win green because green has no Lee5a'); }
      if (!reasons.length) reasons.push(`avoids winning ${danger} point danger`);
    } else { score += 8 + str(card) * 0.2; if (!reasons.length) reasons.push('stays under the current winner'); }
  } else {
    if (pts(card) > 0 && !isLast) { score += pts(card) * 4; reasons.push('feeds points to someone else'); }
    if (hasLeeOnTable && isLee(card)) { score += difficulty === 'hard' ? 25 : 12; reasons.push('pushes the second Lee5a onto the current taker'); }
    else if (isLee(card)) { score += difficulty === 'hard' ? 8 : 4; reasons.push('gets rid of a dangerous Lee5a'); }
    if (difficulty === 'hard' && hiddenLee.some(x => x.color === card.color && x.unknown <= 2)) { score += 10; reasons.push('uses counting to dump a likely hidden danger color'); }
    score += str(card) * 0.1;
  }
  if (isLast && wins) score -= danger * (difficulty === 'hard' ? 7 : 4);
  if (difficulty === 'hard') {
    const remainingLee = G.hands[idx].filter(isLee).length;
    if (remainingLee && isLee(card)) { score += 10; reasons.push('reduces future Lee5a risk'); }
    if (!wins && danger > 0) { score += danger; reasons.push('lets another player absorb the points'); }
  }
  return { card, score, reason: reasons[0] || 'best expected risk score' };
}
function pickSmartCard(idx, pl, difficulty) {
  const scored = pl.map(c => scoreBotCard(c, idx, difficulty)).sort((a, b) => b.score - a.score || pts(b.card) - pts(a.card) || str(a.card) - str(b.card));
  return scored[0] || { card: pl[0], reason: 'no better move available' };
}

function finishTrick() {
  resolving = false;
  const lc = G.leadColor;
  const w = trickWinner(G.table, lc);
  const wi = w.pi;
  const tCards = G.table.map(t => t.card);
  const leeCount = tCards.filter(c => isLee(c)).length;
  const blueDraw2Taken = tCards.some(c => c.color === 'blue' && c.type === 'draw2');
  if (blueDraw2Taken) nextRoundStarter = rightOf(wi);
  let p = tCards.reduce((s, c) => s + pts(c), 0);
  if (leeCount === 2) { p = 37; playLee5aSound(); } else { playTrickWinSound(); }
  G.roundPts[wi] += p;
  lastTrick = { cards: [...G.table], winner: wi, pts: p };
  G.statusMsg = p === 37 ? `${pname(wi)} took both Lee5as! +37 pts - round over!` : `${pname(wi)} wins trick${p > 0 ? ' (+' + p + 'pts)' : ''}`;
  G.table = []; G.leadColor = null;
  if (leeCount === 2) { endRound(); return; }
  if (G.hands.every(h => h.length === 0)) { endRound(); return; }
  G.currentPlayer = G.hands[wi].length > 0 ? wi : nextActiveP(wi);
  setStatus(); render();
  if (G.currentPlayer === mySeatIndex) startTimer();
  else setTimeout(aiPlay, 720);
}
function pname(i) { return playerNames[i] || DEFAULT_NAMES[i]; }
function setStatus() {
  G.statusMsg = G.currentPlayer === mySeatIndex ? `Your turn!${G.leadColor ? ' - follow ' + G.leadColor : ''}` : pname(G.currentPlayer) + ' is playing...';
}
function endRound() {
  G.scores = G.scores.map((s, i) => s + G.roundPts[i]);
  const over = Math.max(...G.scores) >= CONFIG.winScore;
  G.modal = { type: over ? 'gameEnd' : 'roundEnd', rp: [...G.roundPts], sc: [...G.scores] };
  G.roundPts = [0, 0, 0, 0]; G.phase = over ? 'gameEnd' : 'roundEnd'; render();
}

function doGifts() {
  const nh = G.hands.map(h => [...h]);
  const gs = [G.gifts[0]];
  for (let i = 1; i < 4; i++) gs.push(chooseSmartGift(nh[i], botDifficulty));
  G.knownGiftedLees = [];
  for (let i = 1; i < 4; i++) {
    gs[i].filter(isLee).forEach(c => { G.knownGiftedLees.push({ from: i, to: (i + 1) % 4, color: c.color, type: c.type, name: c.color === 'blue' ? 'blue +2' : 'yellow 0' }); });
  }
  for (let i = 0; i < 4; i++) gs[i].forEach(c => { nh[i] = nh[i].filter(x => x.id !== c.id); });
  for (let i = 0; i < 4; i++) gs[i].forEach(c => nh[(i + 1) % 4].push(c));
  const incomingGift = gs[3];
  G.hands = nh.map(sortHand); G.phase = 'play'; G.currentPlayer = nextRoundStarter; G.leadColor = null; G.table = []; G.selected = [];
  giftedIds = new Set(incomingGift.map(c => c.id));
  setStatus(); render();
  setTimeout(() => { giftedIds = new Set(); render(); }, 5000);
  startTimer();
}

function aiPlay() {
  if (G.roomCode) return;
  if (G.phase !== 'play' || G.currentPlayer === mySeatIndex || resolving) return;
  const idx = G.currentPlayer, pl = getPlayable(idx);
  const choice = botDifficulty === 'easy' ? pickEasyCard(pl) : pickSmartCard(idx, pl, botDifficulty);
  if (botDifficulty === 'hard') G.statusMsg = `${pname(idx)}: ${choice.reason}.`;
  executePlay(idx, choice.card || pl[0], botDifficulty === 'hard' ? choice.reason : '');
}

// ── TARNEEB PLAY LOGIC ───────────────────────────────────────
function tarneebPlayCard(seatIdx, card) {
  playCardSound();
  TG.table.push({ pi: seatIdx, card });
  TG.hands[seatIdx] = sortTarneebHand(TG.hands[seatIdx].filter(c => c.id !== card.id));
  if (!TG.leadSuit) TG.leadSuit = card.suit;

  if (TG.table.length === 4) {
    resolving = true; render();
    setTimeout(() => {
      resolving = false;
      const winner = tarneebTrickWinner(TG.table, TG.leadSuit, TG.trump);
      const wi = winner.pi;
      const team = teamOf(wi);
      TG.tricksTaken[team]++;
      playTrickWinSound();
      TG.table = []; TG.leadSuit = null;
      TG.currentPlayer = wi;

      if (TG.hands.every(h => h.length === 0)) {
        tarneebEndRound();
      } else {
        render();
        if (wi !== mySeatIndex) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
      }
    }, CONFIG.trickDelayMs);
  } else {
    TG.currentPlayer = (seatIdx + 1) % 4;
    render();
    if (TG.currentPlayer !== mySeatIndex && !G.roomCode) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
  }
}

function tarneebBotTurn() {
  if (G.roomCode || resolving) return;
  if (TG.phase === 'bid') {
    const seat = TG.currentBidder;
    if (seat === mySeatIndex) return;
    const bidAmt = botBid(seat);
    tarneebSubmitBid(seat, bidAmt);
  } else if (TG.phase === 'trumpSelect') {
    if (TG.highBid.seat === mySeatIndex) return;
    const suit = botSelectTrump(TG.highBid.seat);
    tarneebDeclareTrump(suit);
  } else if (TG.phase === 'play') {
    if (TG.currentPlayer === mySeatIndex) return;
    const card = botPlayTarneeb(TG.currentPlayer);
    tarneebPlayCard(TG.currentPlayer, card);
  }
}

function tarneebSubmitBid(seat, amount) {
  if (amount === 0) {
    TG.bidLog.push({ seat, action: 'pass' });
    TG.passes++;
    if (TG.passes === 3 && TG.highBid.seat === -1) {
      // Dealer forced to bid 7
      if (seat === TG.dealer) {
        TG.highBid = { amount: 7, seat: TG.dealer };
        TG.bidLog.push({ seat: TG.dealer, action: 'bid', amount: 7 });
      } else {
        TG.currentBidder = (seat + 1) % 4;
        render();
        if (TG.currentBidder !== mySeatIndex) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
        return;
      }
    } else if (TG.passes === 3 && TG.highBid.seat >= 0) {
      // Bidding complete
    } else {
      TG.currentBidder = (seat + 1) % 4;
      render();
      if (TG.currentBidder !== mySeatIndex) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
      return;
    }
  } else {
    TG.highBid = { amount, seat };
    TG.bidLog.push({ seat, action: 'bid', amount });
    TG.passes = 0;
    const nextBidder = (seat + 1) % 4;
    if (amount === 13) {
      // Auto-wins bidding
    } else {
      TG.currentBidder = nextBidder;
      render();
      if (TG.currentBidder !== mySeatIndex) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
      return;
    }
  }
  // Bidding won
  TG.phase = 'trumpSelect';
  TG.bidAmount = TG.highBid.amount;
  TG.biddingTeam = teamOf(TG.highBid.seat);
  render();
  if (TG.highBid.seat !== mySeatIndex && !G.roomCode) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
}

function tarneebDeclareTrump(suit) {
  TG.trump = suit;
  TG.phase = 'play';
  TG.currentPlayer = TG.highBid.seat;
  TG.tricksTaken = [0, 0];
  TG.table = []; TG.leadSuit = null;
  render();
  if (TG.currentPlayer !== mySeatIndex && !G.roomCode) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
}

function tarneebEndRound() {
  const bidTeam = TG.biddingTeam;
  const bidAmt = TG.bidAmount;
  const tricksBid = TG.tricksTaken[bidTeam];
  let bidTeamPts, defTeamPts;
  if (bidAmt === 13 && tricksBid === 13) { bidTeamPts = 26; }
  else if (bidAmt === 13 && tricksBid < 13) { bidTeamPts = -26; }
  else if (tricksBid >= bidAmt) { bidTeamPts = tricksBid; }
  else { bidTeamPts = -bidAmt; }
  defTeamPts = TG.tricksTaken[1 - bidTeam];

  TG.scores[bidTeam] += bidTeamPts;
  TG.scores[1 - bidTeam] += defTeamPts;

  const gameOver = TG.scores[0] >= CONFIG.tarneebWinScore || TG.scores[1] >= CONFIG.tarneebWinScore;
  TG.phase = gameOver ? 'gameEnd' : 'roundEnd';
  TG.roundResult = { bidTeam, bidAmt, tricksBid, bidTeamPts, defTeamPts };
  render();
}

function tarneebNextRound() {
  const scores = [...TG.scores];
  const newDealer = (TG.dealer + 1) % 4;
  const deck = shuffle(buildTarneebDeck());
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  TG = {
    phase: 'bid', hands: hands.map(sortTarneebHand),
    dealer: newDealer, currentBidder: (newDealer + 1) % 4,
    highBid: { amount: 0, seat: -1 }, passes: 0, trump: null,
    biddingTeam: null, bidAmount: 0, currentPlayer: 0,
    table: [], leadSuit: null, scores,
    tricksTaken: [0, 0], bidLog: [], playerNames: [...playerNames]
  };
  G.phase = 'dealing'; G.modal = null;
  render();
  runDealAnimation(() => {
    G.phase = 'tarneeb';
    render();
    if (TG.currentBidder !== mySeatIndex && !G.roomCode) setTimeout(tarneebBotTurn, CONFIG.botDelayMs);
  });
}

// ── CARD HTML ────────────────────────────────────────────────
function cardEl(card, opts = {}) {
  const { selectable = false, playable = true, selected = false, rot = 0, offsuit = false, small = false, gifted = false } = opts;
  const p = pts(card), ptag = p > 0 ? `<span class="ptag">${p}</span>` : '';
  const l = lbl(card);
  const pip = COLOR_PIP[card.color];
  const cc = COLOR_CLASS[card.color];
  const cls = ['card', cc, selected ? 'selected' : '', selectable && playable ? 'playable' : '', selectable && !playable ? 'unplayable' : '', offsuit ? 'offsuit' : '', gifted ? 'gifted' : ''].filter(Boolean).join(' ');
  const w = small ? 40 : 54, h = small ? 62 : 82, fs = small ? 15 : 20;
  const style = `width:${w}px;height:${h}px;font-size:${fs}px;--rot:${rot}deg${rot ? `;transform:rotate(${rot}deg)` : ''}`;
  return `<div class="${cls}" style="${style}" ${selectable ? `data-play="${card.id}" tabindex="0" aria-label="${card.type} of ${card.color}${p ? ', ' + p + ' points' : ''}"` : ''}>
    ${ptag}
    <span class="corner tl">${l}</span>
    <div class="cnum">${l}</div>
    <span class="suit-pip">${pip}</span>
    <div class="csym">${card.color}</div>
    <span class="corner br">${l}</span>
  </div>`;
}

function cardElTarneeb(card, opts = {}) {
  const { selectable = false, playable = true, selected = false, small = false } = opts;
  const sym = SUIT_SYMBOL[card.suit];
  const sc = SUIT_CLASS[card.suit];
  const cls = ['card', 'tarneeb-card', sc, selected ? 'selected' : '', selectable && playable ? 'playable' : '', selectable && !playable ? 'unplayable' : ''].filter(Boolean).join(' ');
  const w = small ? 40 : 54, h = small ? 62 : 82;
  const style = `width:${w}px;height:${h}px`;
  const color = SUIT_COLOR[card.suit];
  return `<div class="${cls}" style="${style};color:${color}" ${selectable ? `data-tarneeb-play="${card.id}" tabindex="0" aria-label="${card.rank} of ${card.suit}"` : ''}>
    <span class="corner tl" style="color:${color}">${card.rank}${sym}</span>
    <div class="rank" style="color:${color}">${card.rank}</div>
    <div class="suit-large">${sym}</div>
    <span class="corner br" style="color:${color}">${card.rank}${sym}</span>
  </div>`;
}

function miniBackCards(n, vertical = false) {
  if (vertical) return Array(Math.min(n, 8)).fill(0).map(() => `<div class="mini-back-v"></div>`).join('');
  return Array(Math.min(n, 13)).fill(0).map((_, i) => `<div class="mini-back" style="margin-right:${i < n - 1 ? '-10px' : '0'};z-index:${i}"></div>`).join('');
}

// ── RENDER ───────────────────────────────────────────────────
function render() {
  const savedFocusId = document.activeElement ? document.activeElement.id || document.activeElement.dataset?.play : null;
  document.getElementById('root').innerHTML = buildHTML();
  attachEvents();
  updateTimerBar();
  applyTheme();
  // Restore focus
  if (savedFocusId) {
    const el = document.getElementById(savedFocusId) || document.querySelector(`[data-play="${savedFocusId}"]`);
    if (el) el.focus();
  }
  // Turn pulse
  const game = document.getElementById('game');
  const isMyTurn = G.phase === 'play' && G.currentPlayer === mySeatIndex && !resolving;
  game.classList.toggle('my-turn', isMyTurn);
}

function buildHTML() {
  const modal = G.modal ? buildModal() : '';
  if (G.phase === 'menu') return buildMenuHTML() + modal;
  if (G.phase === 'auth') return buildAuthHTML(G._authMode || 'login') + modal;
  if (G.phase === 'quickSetup') return buildQuickSetupHTML() + modal;
  if (G.phase === 'customRoom') return buildCustomRoomHTML() + modal;
  if (G.phase === 'roomLobby') return buildRoomLobbyHTML() + modal;
  if (G.phase === 'gift') return buildGiftHTML() + modal;
  if (G.phase === 'dealing') return buildDealingHTML() + modal;
  if (G.phase === 'tarneeb') return buildTarneebHTML() + modal;
  // Lee5a play phase
  return buildPlayHTML() + modal;
}

function buildDealingHTML() {
  return `<div style="width:100%;min-height:600px;display:flex;align-items:center;justify-content:center">
    <div style="text-align:center;color:rgba(255,255,255,0.6);font-size:13px;font-weight:600">Dealing cards...</div>
  </div>`;
}

// ── LEE5A PLAY HTML ──────────────────────────────────────────
function buildPlayHTML() {
  const rel = n => (mySeatIndex + n) % 4;
  const isOnline = !!G.roomCode;
  const isMyTurn = G.currentPlayer === mySeatIndex && !resolving && G.phase === 'play';
  const playableIds = new Set((isMyTurn ? getPlayable(mySeatIndex) : []).map(c => c.id));
  const selIds = new Set(G.selected.map(c => c.id));
  const slotClass = ['slot-bottom', 'slot-right', 'slot-top', 'slot-left'];
  const slotRot = [0, 6, 0, -6];

  let tableCards;
  if (G.table.length === 0) {
    tableCards = `<div class="table-played-empty">Waiting for first card...</div>`;
  } else {
    const slots = {};
    G.table.forEach(t => {
      const relPos = (t.pi - mySeatIndex + 4) % 4;
      const offsuit = G.leadColor && t.card.color !== G.leadColor;
      const rot = slotRot[relPos];
      slots[relPos] = `<div class="played-slot ${slotClass[relPos]}">
        <span class="played-name">${pname(t.pi)}${offsuit ? ' ✦' : ''}</span>
        <div class="table-card" style="transform:rotate(${rot}deg)">${cardEl(t.card, { offsuit })}</div>
      </div>`;
    });
    tableCards = Object.values(slots).join('');
  }

  const myHand = G.hands[mySeatIndex];
  const n = myHand.length;
  const handHTML = myHand.map((c, i) => {
    const offset = n > 1 ? (i / (n - 1) - 0.5) * Math.min(n * 2, 24) : 0;
    const yOff = Math.abs(offset) * 0.3;
    const sel = selIds.has(c.id);
    const play = playableIds.has(c.id);
    const gifted = giftedIds.has(c.id);
    return `<div style="transform:rotate(${offset}deg) translateY(${yOff}px);transform-origin:bottom center;display:inline-block">
      ${cardEl(c, { selectable: isMyTurn, playable: play, selected: sel, gifted })}
    </div>`;
  }).join('');

  const av = (i, letter) => {
    const active = G.currentPlayer === i && !resolving && G.phase === 'play';
    const thinking = active && i !== mySeatIndex;
    return `<div class="avatar${active ? ' active' : ''}">${letter}</div>
      ${thinking ? '<div class="bot-thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' : ''}`;
  };

  const isMyTurnNow = G.currentPlayer === mySeatIndex && !resolving && G.phase === 'play';
  const myTimerId = isMyTurnNow ? ' id="turn-timer-ring"' : '';
  const myTimerClass = isMyTurnNow ? ' timer-ring' + (turnTimeLeft <= 3 ? ' timer-urgent' : '') : '';
  const topSeat = rel(2), leftSeat = rel(3), rightSeat = rel(1), meSeat = mySeatIndex;
  const avatarLabel = i => { if (i === mySeatIndex) return 'You'; const nm = pname(i); return nm.startsWith('Bot') ? nm.replace('Bot ', 'B') : nm.charAt(0).toUpperCase(); };

  // Score strip
  const maxScore = Math.max(...G.scores);
  const scoreStrip = `<div class="score-strip">${[0, 1, 2, 3].map(i => {
    const cls = G.scores[i] === maxScore && maxScore > 0 ? 'leader' : G.scores[i] >= 80 ? 'danger' : '';
    return `<span class="score-strip-item ${cls}">${pname(i).substring(0, 6)}: ${G.scores[i]}</span>`;
  }).join('')}</div>`;

  // Last trick
  const lastTrickHTML = lastTrick ? `<div class="last-trick">Last: ${lastTrick.cards.map(t => `<span class="mini-card ${COLOR_CLASS[t.card.color]}">${lbl(t.card)}</span>`).join('')} → ${pname(lastTrick.winner)}${lastTrick.pts ? ' +' + lastTrick.pts : ''}</div>` : '';

  // Lead chip with color
  const leadChipClass = G.leadColor ? `lead-chip lead-${G.leadColor}` : 'lead-chip';

  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back to menu">&lsaquo;</button>
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">${darkMode ? '☀️' : '🌙'}</button>
<button class="sound-toggle" onclick="toggleSound()" aria-label="Toggle sound">${soundEnabled ? '🔊' : '🔇'}</button>
${isOnline ? '<div class="reaction-bar"><button class="reaction-btn" onclick="sendReaction(\'👏\')">👏</button><button class="reaction-btn" onclick="sendReaction(\'😱\')">😱</button><button class="reaction-btn" onclick="sendReaction(\'😂\')">😂</button><button class="reaction-btn" onclick="sendReaction(\'🎯\')">🎯</button></div>' : ''}
<div id="table-wrap">
  ${scoreStrip}
  <div class="tz-top2">
    <div class="player-zone">
      ${av(topSeat, avatarLabel(topSeat))}
      <span class="pname">${pname(topSeat)}</span>
      <span class="pscore">${G.scores[topSeat]}pts</span>
      <div style="display:flex;margin-top:2px;width:120px;justify-content:center;overflow:hidden">${miniBackCards(G.hands[topSeat].length)}</div>
    </div>
  </div>
  <div class="tz-left">
    <div class="player-zone">
      ${av(leftSeat, avatarLabel(leftSeat))}
      <span class="pname">${pname(leftSeat)}</span>
      <span class="pscore">${G.scores[leftSeat]}pts</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(G.hands[leftSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-mid">
    ${lastTrickHTML}
    ${G.leadColor ? `<div class="${leadChipClass}">Lead: ${G.leadColor} ${COLOR_PIP[G.leadColor]}</div>` : ''}
    <div class="table-played">${G.table.length === 0 ? '' : tableCards}</div>
    ${G.table.length === 0 ? `<div class="table-played-empty">Waiting for first card...</div>` : ''}
    <div class="status-bar" role="status">${G.statusMsg}</div>
    ${G.botThought ? `<div class="thought-chip">${G.botThought}</div>` : ''}
  </div>
  <div class="tz-right">
    <div class="player-zone">
      ${av(rightSeat, avatarLabel(rightSeat))}
      <span class="pname">${pname(rightSeat)}</span>
      <span class="pscore">${G.scores[rightSeat]}pts</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(G.hands[rightSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-btm">
    <div class="my-info">
      ${av(meSeat, 'You')}
      <div class="my-name-ring${myTimerClass}"${myTimerId}>
        <span class="pname">${pname(meSeat)}</span>
        <span class="pscore">${G.scores[meSeat]}pts</span>
      </div>
    </div>
    <div id="my-hand">${handHTML}</div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="chip-btn" onclick="showRules()" aria-label="Show rules">Rules</button>
    </div>
  </div>
</div>`;
}

// ── TARNEEB HTML ─────────────────────────────────────────────
function buildTarneebHTML() {
  if (!TG) return '<div class="menu-screen"><p style="color:#fff">Loading...</p></div>';
  const rel = n => (mySeatIndex + n) % 4;
  const topSeat = rel(2), leftSeat = rel(3), rightSeat = rel(1);
  const avatarLabel = i => { if (i === mySeatIndex) return 'You'; const nm = pname(i); return nm.startsWith('Bot') ? nm.replace('Bot ', 'B') : nm.charAt(0).toUpperCase(); };

  // Score display
  const teamANames = `${pname(0)} & ${pname(2)}`;
  const teamBNames = `${pname(1)} & ${pname(3)}`;
  const scoreInfo = `<div class="score-strip"><span class="score-strip-item${TG.scores[0] > TG.scores[1] ? ' leader' : ''}">${teamANames}: ${TG.scores[0]}</span><span class="score-strip-item${TG.scores[1] > TG.scores[0] ? ' leader' : ''}">${teamBNames}: ${TG.scores[1]}</span></div>`;

  let centerContent = '';

  if (TG.phase === 'bid') {
    const isMyBid = TG.currentBidder === mySeatIndex;
    const minBid = TG.highBid.amount + 1;
    const allPassed = TG.passes >= 3 && TG.highBid.seat === -1;
    const forcedBid = allPassed && TG.currentBidder === TG.dealer;
    const bidButtons = isMyBid ? `<div class="bid-buttons">${
      Array.from({ length: 13 - 7 + 1 }, (_, i) => i + 7).map(n =>
        `<button class="bid-btn" onclick="playerBid(${n})" ${n < minBid && !forcedBid ? 'disabled' : ''}>${n}</button>`
      ).join('')
    }${!forcedBid ? '<button class="bid-btn pass-btn" onclick="playerBid(0)">Pass</button>' : ''}</div>` : '';
    const bidLog = TG.bidLog.map(e => `<div>${pname(e.seat)}: ${e.action === 'pass' ? 'Pass' : 'Bid ' + e.amount}</div>`).join('');
    centerContent = `<div class="bid-panel">
      <h4>Bidding${TG.highBid.seat >= 0 ? ` — Current: ${TG.highBid.amount} by ${pname(TG.highBid.seat)}` : ''}</h4>
      <div style="font-size:11px;color:rgba(255,255,255,0.6)">${isMyBid ? 'Your bid:' : pname(TG.currentBidder) + ' is bidding...'}</div>
      ${bidButtons}
      <div class="bid-log">${bidLog}</div>
    </div>`;
  } else if (TG.phase === 'trumpSelect') {
    const isMySelect = TG.highBid.seat === mySeatIndex;
    centerContent = `<div class="bid-panel">
      <h4>${isMySelect ? 'Choose Trump Suit' : pname(TG.highBid.seat) + ' is choosing trump...'}</h4>
      ${isMySelect ? `<div class="trump-select">
        ${TARNEEB_SUITS.map(s => `<button class="trump-btn" onclick="playerSelectTrump('${s}')" style="color:${SUIT_COLOR[s]}">${SUIT_SYMBOL[s]}</button>`).join('')}
      </div>` : '<div class="bot-thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>'}
    </div>`;
  } else if (TG.phase === 'play') {
    const slotClass = ['slot-bottom', 'slot-right', 'slot-top', 'slot-left'];
    let tableCards = '';
    if (TG.table.length > 0) {
      const slots = {};
      TG.table.forEach(t => {
        const relPos = (t.pi - mySeatIndex + 4) % 4;
        slots[relPos] = `<div class="played-slot ${slotClass[relPos]}">
          <span class="played-name">${pname(t.pi)}</span>
          <div class="table-card">${cardElTarneeb(t.card)}</div>
        </div>`;
      });
      tableCards = Object.values(slots).join('');
    }
    const bidTeamLabel = TG.biddingTeam === 0 ? teamANames : teamBNames;
    centerContent = `
      <div class="trump-chip">Trump: ${SUIT_SYMBOL[TG.trump]} ${TG.trump}</div>
      <div class="bid-tracker">${bidTeamLabel} bid ${TG.bidAmount} | tricks: ${TG.tricksTaken[TG.biddingTeam]}/${TG.bidAmount}</div>
      <div class="table-played">${tableCards || '<div class="table-played-empty">Waiting for first card...</div>'}</div>
      <div class="status-bar" role="status">${TG.currentPlayer === mySeatIndex ? 'Your turn!' : pname(TG.currentPlayer) + ' is playing...'}</div>`;
  } else if (TG.phase === 'roundEnd' || TG.phase === 'gameEnd') {
    const r = TG.roundResult;
    const bidTeamLabel = r.bidTeam === 0 ? teamANames : teamBNames;
    const defTeamLabel = r.bidTeam === 0 ? teamBNames : teamANames;
    const success = r.tricksBid >= r.bidAmt;
    centerContent = `<div class="bid-panel">
      <h4>${TG.phase === 'gameEnd' ? 'Game Over!' : 'Round Over'}</h4>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);line-height:1.8">
        ${bidTeamLabel} bid ${r.bidAmt}, took ${r.tricksBid} tricks<br>
        ${success ? '✓ Success!' : '✗ Failed!'} → ${r.bidTeamPts > 0 ? '+' : ''}${r.bidTeamPts} pts<br>
        ${defTeamLabel}: +${r.defTeamPts} pts
      </div>
      <div style="margin-top:8px;font-size:12px;color:#ffe066;font-weight:700">
        Team A: ${TG.scores[0]} | Team B: ${TG.scores[1]}
      </div>
      <div class="progress-bar" style="margin-top:6px"><div class="progress-bar-fill" style="width:${Math.min(100, TG.scores[0] / CONFIG.tarneebWinScore * 100)}%"></div></div>
      <div class="progress-bar" style="margin-top:4px"><div class="progress-bar-fill" style="width:${Math.min(100, TG.scores[1] / CONFIG.tarneebWinScore * 100)}%"></div></div>
      ${TG.phase === 'gameEnd'
        ? `<div style="margin-top:8px;color:#22ee66;font-size:13px;font-weight:700">${TG.scores[0] >= CONFIG.tarneebWinScore ? teamANames : teamBNames} wins!</div>
           <button class="chip-btn gold" onclick="tarneebNewGame()" style="margin-top:8px">New Game</button>`
        : `<button class="chip-btn gold" onclick="tarneebNextRound()" style="margin-top:8px">Next Hand</button>`}
    </div>`;
  }

  // Hand
  const myHand = TG.hands[mySeatIndex];
  const isMyTurn = TG.phase === 'play' && TG.currentPlayer === mySeatIndex && !resolving;
  const playableIds = new Set((isMyTurn ? getPlayableTarneeb(mySeatIndex) : []).map(c => c.id));
  const handHTML = myHand.map((c, i) => {
    const n = myHand.length;
    const offset = n > 1 ? (i / (n - 1) - 0.5) * Math.min(n * 2, 24) : 0;
    const yOff = Math.abs(offset) * 0.3;
    const play = playableIds.has(c.id);
    return `<div style="transform:rotate(${offset}deg) translateY(${yOff}px);transform-origin:bottom center;display:inline-block">
      ${cardElTarneeb(c, { selectable: isMyTurn, playable: play })}
    </div>`;
  }).join('');

  const av = (i, letter) => {
    const active = TG.phase === 'play' && TG.currentPlayer === i && !resolving;
    return `<div class="avatar${active ? ' active' : ''}">${letter}</div>`;
  };

  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back to menu">&lsaquo;</button>
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">${darkMode ? '☀️' : '🌙'}</button>
<button class="sound-toggle" onclick="toggleSound()" aria-label="Toggle sound">${soundEnabled ? '🔊' : '🔇'}</button>
<div id="table-wrap">
  ${scoreInfo}
  <div class="tz-top2">
    <div class="player-zone">
      ${av(topSeat, avatarLabel(topSeat))}
      <span class="pname">${pname(topSeat)}</span>
      <div style="display:flex;margin-top:2px;width:120px;justify-content:center;overflow:hidden">${miniBackCards(TG.hands[topSeat].length)}</div>
    </div>
  </div>
  <div class="tz-left">
    <div class="player-zone">
      ${av(leftSeat, avatarLabel(leftSeat))}
      <span class="pname">${pname(leftSeat)}</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(TG.hands[leftSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-mid">
    ${centerContent}
  </div>
  <div class="tz-right">
    <div class="player-zone">
      ${av(rightSeat, avatarLabel(rightSeat))}
      <span class="pname">${pname(rightSeat)}</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(TG.hands[rightSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-btm">
    <div class="my-info">
      <div class="avatar${TG.phase === 'play' && TG.currentPlayer === mySeatIndex ? ' active' : ''}">You</div>
      <span class="pname">${pname(mySeatIndex)}</span>
    </div>
    <div id="my-hand">${handHTML}</div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="chip-btn" onclick="showTarneebRules()" aria-label="Show rules">Rules</button>
    </div>
  </div>
</div>`;
}

// ── GIFT PHASE ───────────────────────────────────────────────
function buildGiftHTML() {
  const rel = n => (mySeatIndex + n) % 4;
  const topSeat = rel(2), leftSeat = rel(3), rightSeat = rel(1), meSeat = mySeatIndex;
  const avatarLabel = i => { if (i === mySeatIndex) return 'You'; const n = pname(i); return n.startsWith('Bot') ? n.replace('Bot ', 'B') : n.charAt(0).toUpperCase(); };
  const selSet = new Set(G.selected.map(c => c.id));
  const hand = G.hands[mySeatIndex];
  const canSelectGift = !G.giftSubmitted;
  const violation = G.selected.length > 0 && giftViolatesColor(hand, G.selected);
  const n = hand.length;
  const handHTML = hand.map((c, i) => {
    const offset = n > 1 ? (i / (n - 1) - 0.5) * Math.min(n * 2, 24) : 0;
    const yOff = Math.abs(offset) * 0.3;
    const sel = selSet.has(c.id);
    const p = pts(c), ptag = p > 0 ? `<span class="ptag">${p}</span>` : '';
    const cc = COLOR_CLASS[c.color];
    const pip = COLOR_PIP[c.color];
    return `<div style="transform:rotate(${offset}deg) translateY(${yOff}px);transform-origin:bottom center;display:inline-block">
      <div class="card ${cc}${sel ? ' selected' : ''}" ${canSelectGift ? `data-gift="${c.id}" style="cursor:pointer" tabindex="0" aria-label="${c.type} of ${c.color}"` : 'style="opacity:0.6"'}>
        ${ptag}
        <span class="corner tl">${lbl(c)}</span>
        <div class="cnum">${lbl(c)}</div>
        <span class="suit-pip">${pip}</span>
        <div class="csym">${c.color}</div>
        <span class="corner br">${lbl(c)}</span>
      </div>
    </div>`;
  }).join('');

  const giftTargetName = pname(rightSeat);

  // Gift outbox preview
  const outbox = `<div class="gift-outbox">
    ${[0, 1, 2].map(i => {
      const card = G.selected[i];
      if (card) return `<div class="gift-ghost filled"><span style="font-size:8px;color:${card.color === 'yellow' ? '#1a1200' : '#fff'}">${lbl(card)}</span></div>`;
      return `<div class="gift-ghost">?</div>`;
    }).join('')}
    <span class="gift-arrow"><span class="arrow-icon">→</span>${giftTargetName}</span>
  </div>`;

  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back to menu">&lsaquo;</button>
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">${darkMode ? '☀️' : '🌙'}</button>
<div id="table-wrap">
  <div class="tz-top2">
    <div class="player-zone">
      <div class="avatar">${avatarLabel(topSeat)}</div>
      <span class="pname">${pname(topSeat)}</span>
      <span class="pscore">${G.scores[topSeat]}pts</span>
      <div style="display:flex;margin-top:2px;width:120px;justify-content:center;overflow:hidden">${miniBackCards(G.hands[topSeat].length)}</div>
    </div>
  </div>
  <div class="tz-left">
    <div class="player-zone">
      <div class="avatar">${avatarLabel(leftSeat)}</div>
      <span class="pname">${pname(leftSeat)}</span>
      <span class="pscore">${G.scores[leftSeat]}pts</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(G.hands[leftSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-mid">
    <div style="background:rgba(0,0,0,0.4);border-radius:14px;padding:10px 20px;text-align:center;border:1px solid rgba(255,255,255,0.1)">
      <div style="color:rgba(255,220,100,0.9);font-size:13px;font-weight:600">Gift 3 cards to ${giftTargetName}</div>
      <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:2px">${G.selected.length}/3 selected</div>
      ${violation ? `<div class="warn-chip" style="margin-top:6px">Warning: Holding Lee5a - can't empty a color</div>` : ''}
    </div>
    ${outbox}
  </div>
  <div class="tz-right">
    <div class="player-zone">
      <div class="avatar">${avatarLabel(rightSeat)}</div>
      <span class="pname">${pname(rightSeat)}</span>
      <span class="pscore">${G.scores[rightSeat]}pts</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px;margin-top:2px;min-height:80px">
        ${Array(Math.min(G.hands[rightSeat].length, 8)).fill(0).map((_, i) => `<div class="mini-back-v" style="margin-bottom:-8px;z-index:${i}"></div>`).join('')}
      </div>
    </div>
  </div>
  <div class="tz-btm">
    <div class="my-info">
      <div class="avatar">You</div>
      <span class="pname">${pname(meSeat)}</span>
      <span class="pscore">${G.scores[meSeat]}pts</span>
    </div>
    <div id="my-hand">${handHTML}</div>
    ${G.giftSubmitted
      ? `<div class="room-msg" style="margin-top:6px">Waiting for other players to gift...</div>`
      : `<button class="chip-btn gold${violation ? ' shaking' : ''}" onclick="confirmGift()" ${G.selected.length !== 3 || violation ? 'disabled' : ''} aria-label="Confirm gift">
           Gift selected →
         </button>`}
  </div>
</div>`;
}

// ── MODAL ────────────────────────────────────────────────────
function buildModal() {
  const m = G.modal;
  if (m.type === 'rules') return `<div class="modal-bg" onclick="closeModal()"><div class="modal-box" onclick="event.stopPropagation()">
    <h3>Lee5a Rules</h3>
    <div style="font-size:12px;line-height:1.9;color:rgba(255,255,255,0.75)">
      <b style="color:#ffe066">Goal:</b> Avoid points. First to ${CONFIG.winScore} loses.<br>
      <b style="color:#ffe066">Scoring:</b> Blue +2 = 13pts - Yellow 0 = 10pts - Red = 1pt each<br>
      <b style="color:#ffe066">Gifting:</b> Gift 3 cards right. Holding lee5a? Can't empty any color.<br>
      <b style="color:#ffe066">Winner:</b> Only lead-color cards compete for the trick.<br>
      <b style="color:#ffe066">Strength:</b> 1 > Skip > +2 > Rev > 0 > 9...2<br>
      <b style="color:#ffe066">Lee5a:</b> Both blue +2 and yellow 0 taken in the same trick = 37 pts, and the round ends immediately.
    </div>
    <div style="text-align:center;margin-top:12px"><button class="chip-btn" onclick="closeModal()">Close</button></div>
  </div></div>`;

  if (m.type === 'tarneebRules') return `<div class="modal-bg" onclick="closeModal()"><div class="modal-box" onclick="event.stopPropagation()">
    <h3>Tarneeb 400 Rules</h3>
    <div style="font-size:11px;line-height:1.8;color:rgba(255,255,255,0.75)">
      <b style="color:#ffe066">Teams:</b> 4 players in 2 partnerships (seats 1&3 vs 2&4)<br>
      <b style="color:#ffe066">Deck:</b> Standard 52 cards. 13 cards each.<br>
      <b style="color:#ffe066">Bidding:</b> Bid 7-13 tricks or pass. Winner picks trump suit.<br>
      <b style="color:#ffe066">Play:</b> Must follow suit. Trump beats all. Highest card wins trick.<br>
      <b style="color:#ffe066">Rank:</b> A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2<br>
      <b style="color:#ffe066">Scoring:</b> Win bid = tricks taken as pts. Fail = lose bid amount.<br>
      <b style="color:#ffe066">Win:</b> First team to ${CONFIG.tarneebWinScore} points wins!<br>
      <b style="color:#ffe066">Grand slam:</b> Bid 13, win all 13 = 26 pts. Fail = -26.
    </div>
    <div style="text-align:center;margin-top:12px"><button class="chip-btn" onclick="closeModal()">Close</button></div>
  </div></div>`;

  const isEnd = m.type === 'gameEnd';
  const scores = m.sc;
  const rp = m.rp;
  const sorted = [0, 1, 2, 3].sort((a, b) => rp[b] - rp[a]);
  const maxRp = Math.max(...rp);
  const minRp = Math.min(...rp);
  const hasBothLeesBadge = rp.some(p => p === 37);
  const rows = sorted.map(i => {
    const medal = rp[i] === minRp && rp[i] === 0 ? '🥇' : rp[i] === maxRp ? '💀' : '';
    const bothLees = rp[i] === 37 ? '<div class="badge" style="color:#ff6666">💀 Both Lee5as!</div>' : '';
    const pbar = `<div class="progress-bar"><div class="progress-bar-fill${scores[i] >= 80 ? ' danger-fill' : ''}" style="width:${Math.min(100, scores[i] / CONFIG.winScore * 100)}%"></div></div>`;
    return `<div class="modal-row${scores[i] >= CONFIG.winScore ? ' danger' : ''}">
      <div class="mn">${medal} ${pname(i)}</div>
      <div class="mv">${rp[i] > 0 ? '+' + rp[i] : 0} → ${scores[i]}</div>
      ${bothLees}${pbar}
    </div>`;
  }).join('');

  return `<div class="modal-bg"><div class="modal-box">
    <h3>${isEnd ? 'Game Over!' : 'Round Over'}</h3>
    ${isEnd ? `<div style="color:#ff6666;font-size:12px;text-align:center;margin-bottom:8px">${pname(scores.indexOf(Math.max(...scores)))} reached ${CONFIG.winScore}+!</div>` : ''}
    <div class="modal-rows">${rows}</div>
    <div style="display:flex;justify-content:center;margin-top:12px">
      ${isEnd
        ? `<button class="chip-btn gold" onclick="newGame()">New Game</button>`
        : G.roomCode
          ? (G.isHost ? `<button class="chip-btn gold" onclick="hostNextRound()">Next Round →</button>` : `<div style="font-size:12px;color:rgba(255,255,255,0.5);padding:6px 0">Waiting for host...</div>`)
          : `<button class="chip-btn gold" onclick="nextRound()">Next Round</button>`}
    </div>
  </div></div>`;
}

function attachEvents() {
  document.querySelectorAll('[data-gift]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.gift;
      const card = G.hands[mySeatIndex].find(c => c.id === id);
      if (!card) return;
      const idx = G.selected.findIndex(c => c.id === id);
      if (idx >= 0) G.selected.splice(idx, 1); else if (G.selected.length < 3) G.selected.push(card);
      render();
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
  document.querySelectorAll('[data-play]').forEach(el => {
    el.addEventListener('click', () => {
      if (G.currentPlayer !== mySeatIndex || resolving || G.trickResolving) return;
      const id = el.dataset.play;
      const card = G.hands[mySeatIndex].find(c => c.id === id);
      if (!card) return;
      if (!getPlayable(mySeatIndex).find(c => c.id === card.id)) return;
      if (G.roomCode) { socket.emit('playCard', { roomCode: G.roomCode, cardId: id }); }
      else { executePlay(mySeatIndex, card); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
    el.addEventListener('mouseenter', () => { lastHoveredCard = el.dataset.play; });
  });
  // Tarneeb card clicks
  document.querySelectorAll('[data-tarneeb-play]').forEach(el => {
    el.addEventListener('click', () => {
      if (!TG || TG.phase !== 'play' || TG.currentPlayer !== mySeatIndex || resolving) return;
      const id = el.dataset.tarneebPlay;
      const card = TG.hands[mySeatIndex].find(c => c.id === id);
      if (!card) return;
      if (!getPlayableTarneeb(mySeatIndex).find(c => c.id === card.id)) return;
      if (G.roomCode) { socket.emit('tarneeb:playCard', { roomCode: G.roomCode, cardId: id }); }
      else { tarneebPlayCard(mySeatIndex, card); }
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  });
}

// ── TIMER ────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  turnTimeLeft = CONFIG.timerSeconds;
  updateTimerBar();
  turnTimer = setInterval(() => {
    turnTimeLeft--;
    updateTimerBar();
    if (turnTimeLeft <= 0) {
      stopTimer();
      const pl = getPlayable(mySeatIndex);
      if (pl.length) {
        if (G.roomCode) socket.emit('playCard', { roomCode: G.roomCode, cardId: pl[0].id });
        else executePlay(mySeatIndex, pl[0]);
      }
    }
  }, 1000);
}
function stopTimer() { if (turnTimer !== null) { clearInterval(turnTimer); turnTimer = null; } turnTimeLeft = CONFIG.timerSeconds; updateTimerBar(); }
function updateTimerBar() {
  const ring = document.getElementById('turn-timer-ring');
  if (!ring) return;
  const pct = (turnTimeLeft / CONFIG.timerSeconds) * 100;
  const r = Math.round(255 * (1 - turnTimeLeft / CONFIG.timerSeconds));
  const g = Math.round(200 * (turnTimeLeft / CONFIG.timerSeconds));
  ring.style.setProperty('--timer-pct', pct + '%');
  ring.style.setProperty('--timer-color', `rgb(${r},${g},40)`);
  ring.classList.toggle('timer-urgent', turnTimeLeft <= 3);
}

// ── MENU ─────────────────────────────────────────────────────
function buildMenuHTML() {
  const mode = G.gameMode;
  const userBar = currentUser
    ? `<div class="auth-user-chip">
        <span>👤</span>
        <span class="chip-username">${currentUser.username}</span>
        ${!currentUser.isVerified ? '<span style="color:#ffb347;font-size:10px">(unverified)</span>' : ''}
        <button onclick="authLogout()" title="Sign out">✕</button>
       </div>`
    : `<div style="display:flex;gap:8px">
        <button class="auth-link" onclick="showAuth('login')" style="font-size:12px;padding:4px 10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:14px;color:rgba(255,255,255,0.8)">Sign In</button>
        <button class="auth-link" onclick="showAuth('register')" style="font-size:12px;padding:4px 10px;background:rgba(255,200,50,0.15);border:1px solid rgba(255,200,50,0.35);border-radius:14px;color:#ffe066">Register</button>
       </div>`;
  return `
<button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">${darkMode ? '☀️' : '🌙'}</button>
<div style="position:absolute;top:12px;left:12px;z-index:20">${userBar}</div>
<div class="menu-screen">
  <div class="menu-mark">
    <div class="menu-card-stack">
      <div class="menu-card menu-card-red">+2</div>
      <div class="menu-card menu-card-blue">0</div>
      <div class="menu-card menu-card-gold">1</div>
    </div>
    <h1>Laye5lo</h1>
    <p>Choose your game</p>
  </div>
  <div class="game-picker">
    <div class="game-pick-card${mode === 'lee5a' ? ' active' : ''}" onclick="selectGameMode('lee5a')">
      <div class="pick-icons" style="color:#fff">+2 ⊘ ⟲</div>
      <div class="pick-name">Lee5a</div>
      <div class="pick-desc">Avoid points. First to 101 loses.</div>
    </div>
    <div class="game-pick-card${mode === 'tarneeb' ? ' active' : ''}" onclick="selectGameMode('tarneeb')">
      <div class="pick-icons">♠ ♥ ♦ ♣</div>
      <div class="pick-name">Tarneeb 400</div>
      <div class="pick-desc">Partnership trick-taking. Reach 400.</div>
    </div>
  </div>
  <div class="menu-actions">
    <button class="menu-btn primary" onclick="openQuickSetup()" ${!mode ? 'disabled title="Select a game first"' : ''}>Quick Play</button>
    <button class="menu-btn" onclick="openCustomRoom()" ${!mode ? 'disabled title="Select a game first"' : ''}>Custom Room</button>
    <button class="menu-btn subtle" onclick="showRules()">Rules</button>
  </div>
</div>`;
}

function buildQuickSetupHTML() {
  const isTarneeb = G.gameMode === 'tarneeb';
  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back to menu">&lsaquo;</button>
<div class="menu-screen room-screen">
  <div class="room-panel quick-panel">
    <h1>${isTarneeb ? 'Tarneeb 400' : 'Lee5a'} - Quick Play</h1>
    <p>Choose bot difficulty before the match starts.</p>
    ${buildDifficultyPicker()}
    <div class="room-actions">
      <button class="menu-btn primary" onclick="quickPlay()">Start Match</button>
      <button class="menu-btn subtle" onclick="backToMenu()">Back</button>
    </div>
  </div>
</div>`;
}

function buildDifficultyPicker() {
  const notes = { easy: 'basic safe-card play', medium: 'protects suit cover and avoids Lee5a traps', hard: 'counts dropped suits, tracks hidden Lee5as, and explains risky plays' };
  return `<div class="difficulty-box">
    <div class="difficulty-label">Bot difficulty</div>
    <div class="difficulty-options">
      ${['easy', 'medium', 'hard'].map(d => `<button class="difficulty-btn ${botDifficulty === d ? 'active' : ''}" onclick="setBotDifficulty('${d}')">${d}</button>`).join('')}
    </div>
    <div class="difficulty-note">${notes[botDifficulty]}</div>
  </div>`;
}

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code.slice(0, 3) + '-' + code.slice(3);
}
function defaultRoomPlayers() { return [{ type: 'host', name: 'You' }, null, null, null]; }

function buildCustomRoomHTML() {
  const mode = G.roomMode || 'choice';
  if (mode === 'create') return buildCreateRoomHTML();
  if (mode === 'join') return buildJoinRoomHTML();
  return `
<div class="menu-screen room-screen">
  <div class="room-panel">
    <h1>Custom Room</h1>
    <p>Create a private room or join one with a shared code.</p>
    ${G.roomMsg ? `<div class="room-msg">${G.roomMsg}</div>` : ''}
    <div class="room-actions">
      <button class="menu-btn primary" onclick="createOnlineRoom()">Create Room</button>
      <button class="menu-btn" onclick="joinOnlineRoom()">Join Room</button>
      <button class="menu-btn subtle" onclick="backToMenu()">Back</button>
    </div>
  </div>
</div>`;
}

function buildCreateRoomHTML() {
  const code = G.roomCode || '------';
  return `
<button class="back-arrow" onclick="openCustomRoom()" aria-label="Back">&lsaquo;</button>
<div class="menu-screen room-screen">
  <div class="room-panel">
    <h1>Make Room</h1>
    <p>Share this code with invited players.</p>
    <div class="room-code">${code}</div>
    <img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(code.replace('-', ''))}" alt="QR Code" style="margin-top:8px">
    ${G.roomMsg ? `<div class="room-msg">${G.roomMsg}</div>` : ''}
    <div class="room-actions">
      <button class="menu-btn primary" onclick="enterRoomLobby()">Enter Room</button>
      <button class="menu-btn" onclick="copyRoomCode()">Copy Code</button>
      <button class="menu-btn" onclick="copyInviteLink()">Copy Invite Link</button>
      <button class="menu-btn subtle" onclick="openCustomRoom()">Back</button>
    </div>
  </div>
</div>`;
}

function buildJoinRoomHTML() {
  return `
<button class="back-arrow" onclick="openCustomRoom()" aria-label="Back">&lsaquo;</button>
<div class="menu-screen room-screen">
  <div class="room-panel">
    <h1>Join Room</h1>
    <p>Enter the room code someone shared with you.</p>
    <input class="room-input" id="join-room-code" maxlength="7" placeholder="ABC-123" value="${G.joinCode || ''}">
    ${G.roomMsg ? `<div class="room-msg">${G.roomMsg}</div>` : ''}
    <div class="room-actions">
      <button class="menu-btn primary" onclick="joinCustomRoom()">Join Room</button>
      <button class="menu-btn subtle" onclick="openCustomRoom()">Back</button>
    </div>
  </div>
</div>`;
}

function buildRoomLobbyHTML() {
  const players = G.roomPlayers || defaultRoomPlayers();
  const isOnline = !!G.roomCode && G.roomCode.length > 0;
  const isHost = !isOnline || G.isHost;
  const filled = players.filter(Boolean).length;
  const canStart = filled === 4;
  const seats = players.map((p, i) => {
    const label = p ? p.name : 'Empty';
    const kind = p ? p.type : 'empty';
    const canAddBot = !p && isHost;
    const canRemoveSeat = p && p.type !== 'host' && isHost;
    const canMove = isHost;
    return `<div class="seat-wrap">
    <div class="seat-number">Seat ${i + 1}${i % 2 === 0 ? ' (Team A)' : ' (Team B)'}</div>
    <div class="seat-card ${kind}">
      <div class="seat-top">
        <div class="seat-avatar">${p ? (p.type === 'host' ? 'H' : p.name.replace('Bot ', 'B')) : '+'}</div>
        <div>
          <div class="seat-name">${label}</div>
          <div class="seat-role">${p ? (p.type === 'host' ? 'Host' : p.type === 'bot' ? 'Bot' : 'Player') : 'Waiting'}</div>
        </div>
      </div>
      <div class="seat-controls">
        ${canMove ? `<button class="seat-btn" onclick="moveSeat(${i},-1)" ${i === 0 || kind === 'host' ? 'disabled' : ''}>Up</button>` : ''}
        ${canMove ? `<button class="seat-btn" onclick="moveSeat(${i},1)" ${i === 3 || kind === 'host' ? 'disabled' : ''}>Down</button>` : ''}
        ${canAddBot ? `<button class="seat-btn gold" onclick="addBotToSeat(${i})">Bot</button>` : ''}
        ${canRemoveSeat ? `<button class="seat-btn danger" onclick="removeSeat(${i})">Remove</button>` : ''}
      </div>
    </div></div>`;
  }).join('');
  return `
<button class="back-arrow" onclick="backToMenu()" aria-label="Back">&lsaquo;</button>
<div class="menu-screen lobby-screen">
  <div class="lobby-head">
    <h1>Room ${G.roomCode || '------'}</h1>
    <p>${isHost ? 'Host: arrange seats and fill missing spots with bots.' : 'Joined as player. Host controls the lobby.'}</p>
  </div>
  ${isHost ? buildDifficultyPicker() : ''}
  <div class="seat-grid">${seats}</div>
  ${G.roomMsg ? `<div class="room-msg">${G.roomMsg}</div>` : ''}
  ${!isHost ? '<div class="room-msg">Waiting for host to start the game...</div>' : ''}
  <div class="room-actions">
    ${isHost ? `<button class="menu-btn primary" onclick="startCustomRoom()" ${canStart ? '' : 'disabled'}>Start Game</button>` : ''}
    ${isHost ? `<button class="menu-btn" onclick="addNextBot()" ${filled >= 4 ? 'disabled' : ''}>Add Bot</button>` : ''}
    <button class="menu-btn subtle" onclick="openCustomRoom()">Room Code</button>
  </div>
</div>`;
}

// ── GLOBAL ACTIONS ───────────────────────────────────────────
window.selectGameMode = function(mode) { G.gameMode = mode; localStorage.setItem('laye5lo-mode', mode); render(); };
window.confirmGift = function() {
  const hand = G.hands[mySeatIndex];
  if (G.selected.length !== 3 || giftViolatesColor(hand, G.selected)) return;
  if (G.roomCode) {
    socket.emit('submitGift', { roomCode: G.roomCode, cardIds: G.selected.map(c => c.id) });
    G.giftSubmitted = true; G.roomMsg = 'Waiting for other players to gift...'; G.selected = []; render(); return;
  }
  G.gifts[0] = [...G.selected]; setTimeout(doGifts, 300);
};
window.nextRound = function() { G.modal = null; newRound(); };
window.hostNextRound = function() { if (!G.roomCode) return; socket.emit('startNextRound', { roomCode: G.roomCode }); G.modal = null; render(); };
window.newGame = function() { if (G.gameMode === 'tarneeb') initTarneeb(); else initGame(); };
window.showRules = function() { G.modal = { type: 'rules' }; render(); };
window.showTarneebRules = function() { G.modal = { type: 'tarneebRules' }; render(); };
window.closeModal = function() { G.modal = null; render(); };
window.setBotDifficulty = function(level) { botDifficulty = level; render(); };
window.openQuickSetup = function() { if (!G.gameMode) return; stopTimer(); G = { phase: 'quickSetup', modal: null, gameMode: G.gameMode }; render(); };
window.quickPlay = function() {
  const names = currentUser ? [currentUser.username, 'Bot 1', 'Bot 2', 'Bot 3'] : [...DEFAULT_NAMES];
  if (G.gameMode === 'tarneeb') initTarneeb(names); else initGame(names);
};
window.openCustomRoom = function() { stopTimer(); G = { phase: 'customRoom', modal: null, roomMode: 'choice', roomCode: null, joinCode: '', roomMsg: '', gameMode: G.gameMode }; render(); };
window.showCreateRoom = function() { G.roomMode = 'create'; G.roomCode = makeRoomCode(); G.roomMsg = ''; render(); };
window.showJoinRoom = function() { G.roomMode = 'join'; G.joinCode = ''; G.roomMsg = ''; render(); };
window.enterRoomLobby = function() { G = { phase: 'roomLobby', modal: null, roomCode: G.roomCode || makeRoomCode(), roomMsg: '', roomPlayers: defaultRoomPlayers(), gameMode: G.gameMode }; render(); };
window.joinCustomRoom = function() {
  const input = document.getElementById('join-room-code');
  const raw = (input && input.value ? input.value : G.joinCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length < 6) { G.roomMsg = 'Enter a 6-character room code.'; render(); return; }
  const name = localStorage.getItem('laye5lo-name') || prompt('Your name:') || 'Player';
  localStorage.setItem('laye5lo-name', name);
  G.roomMsg = 'Joining...'; render();
  socket.emit('joinRoom', { roomCode: raw, name });
};
window.startCustomRoom = function() {
  if (G.roomCode) { socket.emit("startRoom", { roomCode: G.roomCode }); return; }
  const players = G.roomPlayers || [];
  if (players.filter(Boolean).length < 4) { G.roomMsg = 'Fill all 4 seats before starting.'; render(); return; }
  if (G.gameMode === 'tarneeb') initTarneeb(players.map(p => p.name));
  else initGame(players.map(p => p.name));
};
window.backToMenu = function() { initMenu(); };
window.moveSeat = function(i, dir) {
  if (G.roomCode) { socket.emit("moveSeatInRoom", { roomCode: G.roomCode, seatIndex: i, direction: dir }); return; }
  const players = [...(G.roomPlayers || defaultRoomPlayers())];
  const j = i + dir; if (j < 0 || j >= players.length) return;
  if ((players[i] && players[i].type === 'host') || (players[j] && players[j].type === 'host')) return;
  [players[i], players[j]] = [players[j], players[i]];
  G.roomPlayers = players; G.roomMsg = 'Seats updated.'; render();
};
window.addBotToSeat = function(i) {
  if (G.roomCode) { socket.emit("addBotToRoom", { roomCode: G.roomCode }); return; }
  const players = [...(G.roomPlayers || defaultRoomPlayers())];
  if (players[i]) return;
  const botNum = players.filter(p => p && p.type === 'bot').length + 1;
  players[i] = { type: 'bot', name: `Bot ${botNum}` };
  G.roomPlayers = players; G.roomMsg = `Bot added to slot ${i + 1}.`; render();
};
window.addPlayerToSeat = function(i) {
  const players = [...(G.roomPlayers || defaultRoomPlayers())];
  if (players[i]) return;
  const playerNum = players.filter(p => p && p.type === 'player').length + 2;
  players[i] = { type: 'player', name: `Player ${playerNum}` };
  G.roomPlayers = players; render();
};
window.addNextBot = function() {
  if (G.roomCode) { socket.emit("addBotToRoom", { roomCode: G.roomCode }); return; }
  const players = [...(G.roomPlayers || defaultRoomPlayers())];
  const idx = players.findIndex(p => !p);
  if (idx >= 0) { G.roomPlayers = players; addBotToSeat(idx); }
};
window.removeSeat = function(i) {
  if (G.roomCode) { socket.emit("removeSeatFromRoom", { roomCode: G.roomCode, seatIndex: i }); return; }
  const players = [...(G.roomPlayers || defaultRoomPlayers())];
  if (players[i] && players[i].type !== 'host') { players[i] = null; G.roomPlayers = players; G.roomMsg = `Slot ${i + 1} is open.`; render(); }
};
window.copyRoomCode = function() {
  const code = G.roomCode || '';
  if (navigator.clipboard && code) {
    navigator.clipboard.writeText(code).then(() => { G.roomMsg = 'Room code copied.'; render(); }).catch(() => { G.roomMsg = 'Copy failed.'; render(); });
  }
};
window.copyInviteLink = function() {
  const code = (G.roomCode || '').replace('-', '');
  const link = window.location.origin + window.location.pathname + '?join=' + code;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(link).then(() => { G.roomMsg = 'Invite link copied!'; render(); }).catch(() => { G.roomMsg = 'Copy failed.'; render(); });
  }
};
window.toggleTheme = function() { darkMode = !darkMode; localStorage.setItem('laye5lo-theme', darkMode ? 'dark' : 'light'); applyTheme(); render(); };
window.toggleSound = function() { soundEnabled = !soundEnabled; localStorage.setItem('laye5lo-sound', soundEnabled ? 'on' : 'off'); render(); };

// Tarneeb actions
window.playerBid = function(amount) { tarneebSubmitBid(mySeatIndex, amount); };
window.playerSelectTrump = function(suit) { tarneebDeclareTrump(suit); };
window.tarneebNextRound = function() { tarneebNextRound(); };
window.tarneebNewGame = function() { initTarneeb(); };

// Reactions
window.sendReaction = function(emoji) {
  if (!G.roomCode) return;
  socket.emit('sendReaction', { roomCode: G.roomCode, seatIndex: mySeatIndex, emoji });
  showFloatingReaction(mySeatIndex, emoji);
};

function showFloatingReaction(seatIdx, emoji) {
  const relPos = (seatIdx - mySeatIndex + 4) % 4;
  const zones = ['.tz-btm', '.tz-right', '.tz-top2', '.tz-left'];
  const zone = document.querySelector(zones[relPos]);
  if (!zone) return;
  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.textContent = emoji;
  el.style.left = '50%';
  el.style.top = '30%';
  zone.style.position = 'relative';
  zone.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function newRound() {
  lastTrick = null;
  const deck = shuffle(buildDeck()); const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  G.hands = hands.map(sortHand); G.phase = 'dealing'; G.gifts = [null, null, null, null]; G.table = [];
  G.leadColor = null; G.selected = []; G.statusMsg = `Choose 3 cards to gift to ${pname(1)}`; G.botThought = ''; G.playedCards = []; G.knownGiftedLees = []; G.modal = null; G.roundPts = [0, 0, 0, 0];
  resolving = false; giftedIds = new Set(); stopTimer();
  render();
  runDealAnimation(() => { G.phase = 'gift'; render(); });
}

window.createOnlineRoom = function() { socket.emit("createRoom"); };
window.joinOnlineRoom = function() { G.roomMode = 'join'; G.joinCode = ''; G.roomMsg = ''; render(); };

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (G.modal) { G.modal = null; render(); }
    else if (G.phase !== 'auth') { showRules(); }
    return;
  }
  if (e.key === 'Enter' && G.phase === 'auth') {
    const btn = document.getElementById('auth-submit-btn');
    if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && G.phase === 'gift' && !G.giftSubmitted) {
    if (G.selected.length === 3 && !giftViolatesColor(G.hands[mySeatIndex], G.selected)) {
      e.preventDefault(); window.confirmGift();
    }
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && G.phase === 'play' && lastHoveredCard) {
    const el = document.querySelector(`[data-play="${lastHoveredCard}"]`);
    if (el) { e.preventDefault(); el.click(); }
  }
});

// ── INVITE LINK HANDLING ─────────────────────────────────────
(function checkInviteLink() {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get('join');
  if (joinCode && joinCode.length >= 6) {
    G.phase = 'customRoom'; G.roomMode = 'join'; G.joinCode = joinCode;
    setTimeout(() => render(), 100);
  }
})();

// ── INIT ─────────────────────────────────────────────────────
initMenu();
