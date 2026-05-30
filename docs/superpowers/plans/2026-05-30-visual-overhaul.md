# Visual Overhaul, Animations & Clarity Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul Laye5lo's visual theme, animations, hand layout, and clarity across both Lee5a and Tarneeb — mobile and desktop.

**Architecture:** All changes are in `script.js` (JS logic + HTML generation) and `style.css` (visual styles). The game uses a single `render()` → `buildHTML()` → `innerHTML` pattern — no framework, no build step. Animations use the Web Animations API (`element.animate()`). The existing `G` / `TG` state objects are the single source of truth; nothing in this plan changes them structurally.

**Tech Stack:** Vanilla JS, CSS, Web Animations API, SVG (for timer rings), Socket.IO (existing), served statically via Vercel.

---

## File Map

| File | Sections touched |
|---|---|
| `style.css` | `#game` background, `.card`, `.avatar`, `.score-strip`, `#table-wrap` grid, new `.score-sidebar`, new `.hand-group`, new `.timer-ring-svg`, `.bid-panel`, `.modal-box`, `.room-panel`, connection dot, desktop `@media` |
| `script.js` | `CONFIG.timerSeconds`, `updateTimerBar()→updateTimerRing()`, `buildPlayHTML()`, `buildTarneebHTML()`, `buildGiftHTML()`, `buildModal()`, `finishTrick()`, `executePlay()`, `animateCardPlay()` (new), `animateTrickWin()` (new), `animateModalIn()` (new), `runDealAnimation()`, rules modal text, connection event handlers |

---

## Task 1: Rule clarification + 37pts display fix

**Files:**
- Modify: `script.js` (rules modal text, `finishTrick` status message, modal badge)

- [ ] **Step 1: Update rules modal text**

In `script.js`, find `buildModal()` and the rules case. Replace the Lee5a line:
```js
// FIND:
<b style="color:#ffe066">Lee5a:</b> Both blue +2 and yellow 0 taken in the same trick = 37 pts, and the round ends immediately.
// REPLACE WITH:
<b style="color:#ff6666">⚡ Lee5a:</b> Taking BOTH blue +2 AND yellow 0 in the same trick = <b>+37 pts</b> for you — and the round ends immediately!
```

- [ ] **Step 2: Verify status message is clear**

In `finishTrick()` (line ~853), confirm this line reads exactly:
```js
G.statusMsg = p === 37 ? `${pname(wi)} took both Lee5as! +37 pts — round over!` : `${pname(wi)} wins trick${p > 0 ? ' (+' + p + 'pts)' : ''}`;
```

- [ ] **Step 3: Commit**
```bash
git add script.js
git commit -m "fix: clarify both-lee5as = +37pts rule in modal and status message"
```

---

## Task 2: Visual theme — CSS foundation

**Files:**
- Modify: `style.css`

This task updates the base palette and card/panel styles. Do not touch layout yet.

- [ ] **Step 1: Deepen the table background**

Find the `#game` rule and update the background:
```css
#game {
  background: radial-gradient(ellipse at center, #1a5c32 0%, #0d3a1e 55%, #071e0f 100%);
}
```

- [ ] **Step 2: Update the gold oval rim**

Find `#game::after` and update:
```css
#game::after {
  border: 2px solid rgba(255,200,50,0.18);
  box-shadow: 0 0 40px rgba(255,200,50,0.06);
}
```

- [ ] **Step 3: Sharpen card shadows and hover**

Find the `.card` rule and update `box-shadow` and `transition`. Then find `.card.playable:hover` and update transform:
```css
.card {
  box-shadow: 2px 6px 20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.3);
  transition: transform 0.15s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.15s ease;
}
.card.playable:hover {
  transform: translateY(-10px);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.5), 2px 10px 24px rgba(0,0,0,0.7);
}
```

- [ ] **Step 4: Update panels to frosted-dark glass**

Find `.modal-box`, `.room-panel`, `.bid-panel` and update their backgrounds and borders:
```css
.modal-box {
  background: rgba(0,0,0,0.72);
  border: 1px solid rgba(255,200,50,0.2);
  border-radius: 14px;
}
.room-panel {
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,200,50,0.18);
  border-radius: 14px;
}
.bid-panel {
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,200,50,0.18);
  border-radius: 14px;
}
```

- [ ] **Step 5: Commit**
```bash
git add style.css
git commit -m "style: deepen felt theme, gold rim, sharper cards, frosted panels"
```

---

## Task 3: Grouped hand layout — CSS

**Files:**
- Modify: `style.css`

Add all CSS needed for the new grouped hand. No JS changes yet.

- [ ] **Step 1: Add hand group container styles**

Append to `style.css`:
```css
/* ── GROUPED HAND ── */
.hand-groups {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: flex-end;
  flex-wrap: wrap;
  padding: 4px 0;
}
.hand-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.hand-group-label {
  font-size: 9px;
  font-weight: 700;
  opacity: 0.8;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.hand-group-cards {
  display: flex;
}
.hand-group-cards .card {
  margin-right: -12px;
}
.hand-group-cards .card:last-child {
  margin-right: 0;
}
.hand-group.unplayable {
  opacity: 0.3;
  pointer-events: none;
  cursor: not-allowed;
}
/* color glow on playable groups */
.hand-group.playable .card.cr { box-shadow: 0 0 12px rgba(255,68,68,0.6), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(255,100,100,0.7); }
.hand-group.playable .card.cb { box-shadow: 0 0 12px rgba(51,136,255,0.6), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(68,153,255,0.7); }
.hand-group.playable .card.cg { box-shadow: 0 0 12px rgba(34,204,85,0.6), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(51,221,102,0.7); }
.hand-group.playable .card.cy { box-shadow: 0 0 12px rgba(255,208,0,0.5), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(255,220,50,0.7); }
/* Tarneeb suit glows */
.hand-group.playable .card.cs { box-shadow: 0 0 12px rgba(180,180,180,0.4), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(200,200,200,0.5); }
.hand-group.playable .card.ch { box-shadow: 0 0 12px rgba(255,68,68,0.6), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(255,100,100,0.7); }
.hand-group.playable .card.cd { box-shadow: 0 0 12px rgba(255,100,68,0.6), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(255,130,100,0.7); }
.hand-group.playable .card.cc { box-shadow: 0 0 12px rgba(68,136,200,0.5), 2px 6px 20px rgba(0,0,0,0.65); border: 2px solid rgba(100,160,220,0.6); }
```

- [ ] **Step 2: Add label colors per color/suit**

Append to `style.css`:
```css
.hand-group-label.cr { color: #ff8888; }
.hand-group-label.cb { color: #6699ff; }
.hand-group-label.cg { color: #66dd88; }
.hand-group-label.cy { color: #ffe066; }
.hand-group-label.cs { color: #cccccc; }
.hand-group-label.ch { color: #ff8888; }
.hand-group-label.cd { color: #ffaa88; }
.hand-group-label.cc { color: #88bbff; }
```

- [ ] **Step 3: Mobile card size (already exists — verify breakpoint)**

Confirm `@media(max-width:480px)` contains `.card { width:44px; height:68px; }`. If not, add it.

- [ ] **Step 4: Commit**
```bash
git add style.css
git commit -m "style: add grouped hand CSS with color glows and suit labels"
```

---

## Task 4: Grouped hand layout — JS (Lee5a)

**Files:**
- Modify: `script.js`

Replace the flat-arc hand renderer in `buildPlayHTML()` with grouped cards.

- [ ] **Step 1: Add `buildLee5aHandHTML` helper**

Find the line `// ── CARD HTML ──` in `script.js` and insert this new function just before it:

```js
function buildLee5aHandHTML(hand, playableIds, selIds, giftedIds, isSelectable) {
  const groups = {};
  COLOR_ORDER.forEach(col => { groups[col] = hand.filter(c => c.color === col); });
  return `<div class="hand-groups">${COLOR_ORDER.filter(col => groups[col].length > 0).map(col => {
    const cards = groups[col];
    const isPlayable = cards.some(c => playableIds.has(c.id));
    const groupClass = isSelectable ? (isPlayable ? 'playable' : 'unplayable') : '';
    const label = col;
    return `<div class="hand-group ${groupClass}">
      <div class="hand-group-label ${COLOR_CLASS[col]}">${label} ${COLOR_PIP[col]}</div>
      <div class="hand-group-cards">${cards.map(c => {
        const sel = selIds && selIds.has(c.id);
        const gifted = giftedIds && giftedIds.has(c.id);
        return cardEl(c, { selectable: isSelectable && isPlayable, playable: isPlayable, selected: sel, gifted });
      }).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}
```

- [ ] **Step 2: Replace hand rendering in `buildPlayHTML()`**

Find the section in `buildPlayHTML()` that builds `handHTML` (lines ~1163–1176). Replace it:

```js
// REMOVE this block:
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

// REPLACE WITH:
const myHand = G.hands[mySeatIndex];
const handHTML = buildLee5aHandHTML(myHand, playableIds, selIds, giftedIds, isMyTurn);
```

- [ ] **Step 3: Verify the game renders — open index.html and play a quick solo game to confirm hand groups show**

- [ ] **Step 4: Commit**
```bash
git add script.js
git commit -m "feat: grouped color hand layout for Lee5a play phase"
```

---

## Task 5: Grouped hand layout — JS (Tarneeb + Gift phase)

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add `buildTarneebHandHTML` helper**

Just after `buildLee5aHandHTML`, add:

```js
function buildTarneebHandHTML(hand, playableIds, isSelectable) {
  const groups = {};
  TARNEEB_SUITS.forEach(suit => { groups[suit] = hand.filter(c => c.suit === suit); });
  const SUIT_LABEL = { spades: 'spades', hearts: 'hearts', diamonds: 'diamonds', clubs: 'clubs' };
  return `<div class="hand-groups">${TARNEEB_SUITS.filter(suit => groups[suit].length > 0).map(suit => {
    const cards = groups[suit];
    const isPlayable = cards.some(c => playableIds.has(c.id));
    const groupClass = isSelectable ? (isPlayable ? 'playable' : 'unplayable') : '';
    return `<div class="hand-group ${groupClass}">
      <div class="hand-group-label ${SUIT_CLASS[suit]}">${SUIT_SYMBOL[suit]}</div>
      <div class="hand-group-cards">${cards.map(c =>
        cardElTarneeb(c, { selectable: isSelectable && isPlayable, playable: isPlayable })
      ).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}
```

- [ ] **Step 2: Replace hand in `buildTarneebHTML()`**

Find the `handHTML` block inside `buildTarneebHTML()` (lines ~1074–1082) and replace:

```js
// REMOVE:
const handHTML = myHand.map((c, i) => {
  const n = myHand.length;
  const offset = n > 1 ? (i / (n - 1) - 0.5) * Math.min(n * 2, 24) : 0;
  const yOff = Math.abs(offset) * 0.3;
  const play = playableIds.has(c.id);
  return `<div style="transform:rotate(${offset}deg) translateY(${yOff}px);transform-origin:bottom center;display:inline-block">
    ${cardElTarneeb(c, { selectable: isMyTurn, playable: play })}
  </div>`;
}).join('');

// REPLACE WITH:
const handHTML = buildTarneebHandHTML(myHand, playableIds, isMyTurn);
```

- [ ] **Step 3: Update gift phase hand in `buildGiftHTML()`**

The gift phase uses its own hand renderer (lines ~1146–1163). Replace it to use `buildLee5aHandHTML` with a gift-specific `playableIds` (all cards are selectable, selection tracked via `selSet`):

```js
// REMOVE the existing handHTML block and REPLACE WITH:
const hand = G.hands[mySeatIndex];
const allIds = new Set(hand.map(c => c.id));
const handHTML = buildLee5aHandHTML(hand, allIds, selSet, null, !G.giftSubmitted);
```

Note: In gift phase, `data-gift` click handlers are attached in `attachEvents()`. Verify `attachEvents()` still finds `[data-play]` elements — gift phase cards use `data-gift` so this is unchanged. Confirm clicks still work.

- [ ] **Step 4: Verify Tarneeb bidding and gift phase render correctly**

- [ ] **Step 5: Commit**
```bash
git add script.js
git commit -m "feat: grouped suit hand for Tarneeb, grouped hand in gift phase"
```

---

## Task 6: SVG timer ring — CSS + JS

**Files:**
- Modify: `style.css`, `script.js`

Replaces the conic-gradient `.my-name-ring` timer with an SVG arc on every player avatar.

- [ ] **Step 1: Add ring CSS to `style.css`**

Append:
```css
/* ── SVG TIMER RING ── */
.avatar-wrap {
  position: relative;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-wrap svg {
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
}
.avatar-wrap .avatar {
  position: relative;
  z-index: 1;
  width: 44px;
  height: 44px;
}
@keyframes ringUrgent {
  0%,100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.ring-urgent .ring-arc {
  animation: ringUrgent 0.5s ease-in-out infinite;
}
@keyframes ringPulse {
  0%,100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.ring-bot .ring-arc {
  animation: ringPulse 1.2s ease-in-out infinite;
}
```

- [ ] **Step 2: Add `avatarWithRing` helper to `script.js`**

Find the `function pname` line and insert this function just before it:

```js
function avatarWithRing(seatIndex, label, ringState) {
  // ringState: 'mine' | 'bot' | 'inactive'
  // For 'mine': timer arc depletes. For 'bot': gold pulse. For 'inactive': no ring.
  const circ = 138.2; // 2 * PI * 22
  let arcStroke = 'rgba(255,255,255,0.06)';
  let arcOffset = circ; // fully depleted by default
  let wrapClass = 'avatar-wrap';
  let arcClass = 'ring-arc';

  if (ringState === 'mine') {
    const pct = turnTimeLeft / CONFIG.timerSeconds;
    arcOffset = circ * (1 - pct);
    if (turnTimeLeft > 15) arcStroke = '#22ee66';
    else if (turnTimeLeft > 5) arcStroke = '#ffaa00';
    else { arcStroke = '#ff3333'; wrapClass += ' ring-urgent'; }
  } else if (ringState === 'bot') {
    arcOffset = circ * 0.25; // static partial arc
    arcStroke = 'rgba(255,200,50,0.7)';
    wrapClass += ' ring-bot';
  }

  const isActive = ringState === 'mine' || ringState === 'bot';
  const avatarOpacity = isActive ? '' : 'opacity:0.6;';
  const avatarBorder = ringState === 'mine'
    ? (turnTimeLeft > 15 ? 'rgba(34,238,102,0.7)' : turnTimeLeft > 5 ? 'rgba(255,170,0,0.6)' : 'rgba(255,51,51,0.8)')
    : ringState === 'bot' ? 'rgba(255,200,50,0.5)' : 'rgba(255,255,255,0.2)';
  const avatarBg = (ringState === 'mine' && turnTimeLeft <= 5)
    ? 'linear-gradient(135deg,#5a1a1a,#3a0f0f)'
    : seatIndex === mySeatIndex
      ? 'linear-gradient(135deg,#1a6b3a,#0f4a26)'
      : 'linear-gradient(135deg,#2a5298,#1e3c72)';

  return `<div class="${wrapClass}">
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5.5"/>
      <circle cx="28" cy="28" r="22" fill="none" stroke="${arcStroke}" stroke-width="5.5"
        stroke-dasharray="${circ}" stroke-dashoffset="${arcOffset}"
        stroke-linecap="round" class="${arcClass}"/>
    </svg>
    <div class="avatar" style="background:${avatarBg};border:2px solid ${avatarBorder};${avatarOpacity}">${label}</div>
  </div>`;
}
```

- [ ] **Step 3: Replace `av()` calls in `buildPlayHTML()`**

Find the `av` helper inside `buildPlayHTML()`:
```js
const av = (i, letter) => {
  const active = G.currentPlayer === i && !resolving && G.phase === 'play';
  const thinking = active && i !== mySeatIndex;
  return `<div class="avatar${active ? ' active' : ''}">${letter}</div>
    ${thinking ? '<div class="bot-thinking">...</div>' : ''}`;
};
```

Replace it with:
```js
const av = (i, letter) => {
  if (i === mySeatIndex && G.currentPlayer === i && !resolving) return avatarWithRing(i, letter, 'mine');
  if (G.currentPlayer === i && !resolving) return avatarWithRing(i, letter, 'bot');
  return avatarWithRing(i, letter, 'inactive');
};
```

Also remove the old `.my-name-ring` element from `buildPlayHTML()`:
```js
// FIND and REMOVE these lines:
const myTimerId = isMyTurnNow ? ' id="turn-timer-ring"' : '';
const myTimerClass = isMyTurnNow ? ' timer-ring' + (turnTimeLeft <= 3 ? ' timer-urgent' : '') : '';
// ...
<div class="my-name-ring${myTimerClass}"${myTimerId}>
  <span class="pname">${pname(meSeat)}</span>
  <span class="pscore">${G.scores[meSeat]}pts</span>
</div>
```

Replace the entire `<div class="my-info">` block with:
```js
`<div class="my-info">
  ${av(meSeat, 'You')}
  <div>
    <div class="pname">${pname(meSeat)}</div>
    <div class="pscore">${G.scores[meSeat]}pts</div>
  </div>
</div>`
```

- [ ] **Step 4: Replace `av()` in `buildTarneebHTML()`**

Find the `av` helper inside `buildTarneebHTML()` and replace:
```js
const av = (i, letter) => {
  if (TG.phase === 'play' && i === mySeatIndex && TG.currentPlayer === i && !resolving) return avatarWithRing(i, letter, 'mine');
  if (TG.phase === 'play' && TG.currentPlayer === i && !resolving) return avatarWithRing(i, letter, 'bot');
  return avatarWithRing(i, letter, 'inactive');
};
```

- [ ] **Step 5: Update `updateTimerRing()` — replaces `updateTimerBar()`**

Find `function updateTimerBar()` and rename + rewrite it:
```js
function updateTimerRing() {
  // Re-render only the SVG arc of the active player's ring — no full re-render
  const wrap = document.querySelector('.ring-urgent, .avatar-wrap');
  if (!wrap) return;
  const arc = document.querySelector('.avatar-wrap .ring-arc');
  if (!arc) return;
  const circ = 138.2;
  const pct = turnTimeLeft / CONFIG.timerSeconds;
  const offset = circ * (1 - pct);
  arc.setAttribute('stroke-dashoffset', offset);
  const stroke = turnTimeLeft > 15 ? '#22ee66' : turnTimeLeft > 5 ? '#ffaa00' : '#ff3333';
  arc.setAttribute('stroke', stroke);
  const isUrgent = turnTimeLeft <= 5;
  wrap.classList.toggle('ring-urgent', isUrgent);
}
```

Replace all calls to `updateTimerBar()` with `updateTimerRing()` (there are 4: in `startTimer`, the interval, `stopTimer`, `render`).

- [ ] **Step 6: Update `CONFIG.timerSeconds`**

```js
// FIND:
timerSeconds: 20,
// REPLACE WITH:
timerSeconds: 30,
```

- [ ] **Step 7: Verify ring appears on the active player and depletes**

Open the game, start a quick play round, watch your avatar — the ring should glow green and deplete over 30 seconds, turning yellow then red.

- [ ] **Step 8: Commit**
```bash
git add script.js style.css
git commit -m "feat: SVG timer ring on active player avatar, 30s timer"
```

---

## Task 7: Score sidebar — desktop layout

**Files:**
- Modify: `style.css`, `script.js`

- [ ] **Step 1: Add sidebar CSS**

Append to `style.css`:
```css
/* ── SCORE SIDEBAR (desktop) ── */
#game-layout {
  display: flex;
  width: 100%;
  gap: 8px;
  flex: 1;
}
.score-sidebar {
  width: 130px;
  flex-shrink: 0;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,200,50,0.18);
  border-radius: 12px;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.score-sidebar .sidebar-title {
  color: rgba(255,200,50,0.7);
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: center;
}
.score-sidebar .sidebar-player-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 0;
  border-radius: 6px;
  transition: background 0.3s;
}
.score-sidebar .sidebar-player-row.flash {
  background: rgba(255,200,50,0.12);
}
.score-sidebar .sidebar-player-row.danger .sidebar-score {
  color: #ff6666;
}
.sidebar-row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.sidebar-name {
  color: rgba(255,255,255,0.75);
  font-size: 10px;
  font-weight: 700;
}
.sidebar-score {
  color: #ffe066;
  font-size: 14px;
  font-weight: 900;
}
.sidebar-progress {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
  overflow: hidden;
}
.sidebar-progress-fill {
  height: 100%;
  background: linear-gradient(90deg,#22cc55,#ffe066);
  border-radius: 2px;
  transition: width 0.6s ease;
}
.sidebar-progress-fill.danger {
  background: linear-gradient(90deg,#ff6666,#ff3333);
}
.sidebar-divider {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.08);
  margin: 0;
}
.last-trick-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
}
.last-trick-winner {
  color: rgba(255,255,255,0.5);
  font-size: 9px;
  text-align: center;
  margin-top: 3px;
}

/* On mobile: hide sidebar, show score-strip */
@media (max-width: 639px) {
  .score-sidebar { display: none; }
}
/* On desktop: hide score-strip, show sidebar */
@media (min-width: 640px) {
  .score-strip { display: none; }
  #table-wrap { flex: 1; min-width: 0; }
}
```

- [ ] **Step 2: Add `buildScoreSidebar()` helper to `script.js`**

Just before `function buildPlayHTML()`, add:

```js
function buildScoreSidebar(scores, winScore, gameMode) {
  const playerRows = [0,1,2,3].map(i => {
    const score = scores[i];
    const danger = score >= (gameMode === 'tarneeb' ? 350 : 80);
    const pct = Math.min(100, (score / winScore) * 100);
    return `<div class="sidebar-player-row${danger ? ' danger' : ''}" id="sidebar-row-${i}">
      <div class="sidebar-row-top">
        <span class="sidebar-name">${pname(i).substring(0,8)}</span>
        <span class="sidebar-score" id="sidebar-score-${i}">${score}</span>
      </div>
      <div class="sidebar-progress">
        <div class="sidebar-progress-fill${danger ? ' danger' : ''}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');

  const lastTrickHTML = lastTrick ? `
    <hr class="sidebar-divider">
    <div class="sidebar-title">Last Trick</div>
    <div class="last-trick-mini">${lastTrick.cards.map(t =>
      `<div class="mini-card ${COLOR_CLASS[t.card.color]}">${lbl(t.card)}</div>`
    ).join('')}</div>
    <div class="last-trick-winner">→ ${pname(lastTrick.winner)}${lastTrick.pts ? ' +'+lastTrick.pts : ''}</div>
  ` : '';

  return `<div class="score-sidebar">
    <div class="sidebar-title">Scores <span style="color:rgba(255,255,255,0.3);font-weight:400">/ ${winScore}</span></div>
    ${playerRows}
    ${lastTrickHTML}
  </div>`;
}
```

- [ ] **Step 3: Wrap table and sidebar in `buildPlayHTML()`**

In `buildPlayHTML()`, find the outer return template and wrap `#table-wrap` with `#game-layout`:

```js
// FIND this pattern at the end of buildPlayHTML():
return `
<button class="back-arrow" ...>
...
<div id="table-wrap">
  ...
</div>`;

// REPLACE WITH:
return `
<button class="back-arrow" ...>
...
<div id="game-layout">
  ${buildScoreSidebar(G.scores, CONFIG.winScore, 'lee5a')}
  <div id="table-wrap">
    ...
  </div>
</div>`;
```

- [ ] **Step 4: Do the same for `buildTarneebHTML()`**

```js
// Same pattern — wrap with #game-layout and buildScoreSidebar:
return `
...
<div id="game-layout">
  ${buildScoreSidebar([TG.scores[0], TG.scores[0], TG.scores[1], TG.scores[1]], CONFIG.tarneebWinScore, 'tarneeb')}
  <div id="table-wrap">
    ...
  </div>
</div>`;
```

Note: Tarneeb uses team scores — seats 0&2 are team A, 1&3 are team B. Map accordingly.

- [ ] **Step 5: Add score animation helper**

After `buildScoreSidebar`, add:

```js
function animateScoreUpdate(seatIndex, oldScore, newScore) {
  const el = document.getElementById(`sidebar-score-${seatIndex}`);
  const row = document.getElementById(`sidebar-row-${seatIndex}`);
  if (!el || oldScore === newScore) return;
  const start = performance.now();
  const duration = 600;
  const diff = newScore - oldScore;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(oldScore + diff * t);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = newScore;
  }
  requestAnimationFrame(tick);
  if (row && diff > 0) {
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 800);
  }
}
```

- [ ] **Step 6: Call `animateScoreUpdate` after round end**

In `endRound()` and after `gameState` socket events, call it for each player. In `endRound()`:
```js
function endRound() {
  const oldScores = [...G.scores];
  G.scores = G.scores.map((s, i) => s + G.roundPts[i]);
  G.scores.forEach((s, i) => animateScoreUpdate(i, oldScores[i], s));
  // ... rest of function unchanged
}
```

- [ ] **Step 7: Verify sidebar shows on desktop, hides on mobile**

Resize browser window past 640px — sidebar should appear left of table. Below 640px — only score-strip shows.

- [ ] **Step 8: Commit**
```bash
git add script.js style.css
git commit -m "feat: score sidebar for desktop with animated score updates"
```

---

## Task 8: Card play animation

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add `animateCardPlay()` helper**

Add just before `function executePlay`:

```js
function animateCardPlay(fromEl, toSlotClass, cardHTML, onDone) {
  // fromEl: the card element being played (in hand), toSlotClass: e.g. 'slot-bottom'
  // We create a flying clone, animate it, then call onDone to do the real state update + render
  const gameEl = document.getElementById('game');
  if (!gameEl || !fromEl) { onDone(); return; }

  const fromRect = fromEl.getBoundingClientRect();
  const gameRect = gameEl.getBoundingClientRect();
  const fx = fromRect.left - gameRect.left + fromRect.width / 2;
  const fy = fromRect.top - gameRect.top + fromRect.height / 2;

  // Destination: center of table
  const tx = gameEl.offsetWidth / 2;
  const ty = gameEl.offsetHeight * 0.42;

  const clone = document.createElement('div');
  clone.innerHTML = cardHTML;
  const cardNode = clone.firstElementChild;
  cardNode.style.cssText = `position:absolute;left:${fx - 27}px;top:${fy - 41}px;z-index:40;pointer-events:none;`;
  gameEl.appendChild(cardNode);

  const dx = tx - fx;
  const dy = ty - fy;

  cardNode.animate([
    { transform: 'translate(0,0) scale(1)', boxShadow: '2px 4px 10px rgba(0,0,0,0.55)' },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 20}px) scale(1.08)`, offset: 0.45 },
    { transform: `translate(${dx}px,${dy}px) scale(1)`, boxShadow: '0 12px 28px rgba(0,0,0,0.8)' },
  ], { duration: 280, easing: 'cubic-bezier(0.22,0.61,0.36,1)', fill: 'forwards' })
    .finished.then(() => { cardNode.remove(); onDone(); });
}
```

- [ ] **Step 2: Wire `animateCardPlay` into `executePlay()`**

In `executePlay(pi, card, reason)`, the function currently does state changes immediately. Wrap the state change in the animation callback for the human player's card:

```js
function executePlay(pi, card, reason = '') {
  stopTimer();
  playCardSound();
  G.botThought = pi !== 0 && reason ? `${pname(pi)} chose ${lbl(card)} because ${reason}.` : '';

  const doPlay = () => {
    if (!G.playedCards) G.playedCards = [];
    G.playedCards.push(card);
    G.table.push({ pi, card });
    G.hands[pi] = sortHand(G.hands[pi].filter(c => c.id !== card.id));
    if (!G.leadColor) G.leadColor = card.color;
    G.selected = [];
    if (hasBothLees(G.table) || G.table.length === 4 || !hasNextTrickPlayer(G.currentPlayer)) {
      resolving = true;
      G.statusMsg = hasBothLees(G.table) ? 'Both Lee5as taken! +37 pts — round over!' : 'Trick complete...';
      render();
      setTimeout(finishTrick, CONFIG.trickDelayMs);
    } else {
      G.currentPlayer = nextTrickP(G.currentPlayer);
      setStatus(); render();
      if (G.currentPlayer === mySeatIndex) startTimer();
      else setTimeout(aiPlay, CONFIG.botDelayMs);
    }
  };

  if (pi === mySeatIndex) {
    const cardEl = document.querySelector(`[data-play="${card.id}"]`);
    const html = cardEl ? cardEl.outerHTML : '';
    animateCardPlay(cardEl, 'slot-bottom', html, doPlay);
    // Hide card immediately so it doesn't flash in hand during animation
    if (cardEl) cardEl.style.visibility = 'hidden';
  } else {
    doPlay();
  }
}
```

- [ ] **Step 3: Verify card slides to table smoothly on click**

- [ ] **Step 4: Commit**
```bash
git add script.js
git commit -m "feat: card play slide animation with arc trajectory"
```

---

## Task 9: Trick win animation

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add `animateTrickWin()` helper**

Add just before `function finishTrick`:

```js
function animateTrickWin(winnerSeatIndex, onDone) {
  const gameEl = document.getElementById('game');
  if (!gameEl) { onDone(); return; }

  // Find winner zone position
  const relPos = (winnerSeatIndex - mySeatIndex + 4) % 4;
  const zones = [
    [gameEl.offsetWidth / 2, gameEl.offsetHeight * 0.85],  // bottom
    [gameEl.offsetWidth * 0.92, gameEl.offsetHeight / 2],  // right
    [gameEl.offsetWidth / 2, gameEl.offsetHeight * 0.12],  // top
    [gameEl.offsetWidth * 0.08, gameEl.offsetHeight / 2],  // left
  ];
  const [wx, wy] = zones[relPos];

  const tableCards = document.querySelectorAll('.played-slot .card');
  let done = 0;
  const total = tableCards.length;
  if (total === 0) { onDone(); return; }

  tableCards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const gameRect = gameEl.getBoundingClientRect();
    const cx = rect.left - gameRect.left + rect.width / 2;
    const cy = rect.top - gameRect.top + rect.height / 2;
    const dx = wx - cx;
    const dy = wy - cy;

    card.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0.3)`, opacity: 0 },
    ], { duration: 400, easing: 'ease-in', fill: 'forwards' })
      .finished.then(() => {
        done++;
        if (done === total) {
          // Flash winner avatar
          const avatarWrap = document.querySelectorAll('.avatar-wrap')[relPos];
          if (avatarWrap) {
            avatarWrap.animate([
              { filter: 'brightness(1)' },
              { filter: 'brightness(2.5)' },
              { filter: 'brightness(1)' },
            ], { duration: 300, easing: 'ease-out' });
          }
          onDone();
        }
      });
  });
}
```

- [ ] **Step 2: Call `animateTrickWin` inside the `setTimeout` in `executePlay`**

In the `doPlay` function inside `executePlay`, replace the `setTimeout(finishTrick, ...)` call:

```js
// FIND:
render();
setTimeout(finishTrick, CONFIG.trickDelayMs);

// REPLACE WITH:
render();
setTimeout(() => {
  animateTrickWin(G.trickWinnerSeat !== undefined ? G.trickWinnerSeat : G.currentPlayer, finishTrick);
}, CONFIG.trickDelayMs);
```

Actually the winner isn't known until `finishTrick` runs — restructure slightly. Move the animation call inside `finishTrick` itself, before the state clear:

```js
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
  G.statusMsg = p === 37 ? `${pname(wi)} took both Lee5as! +37 pts — round over!` : `${pname(wi)} wins trick${p > 0 ? ' (+' + p + 'pts)' : ''}`;

  // Animate cards sweeping to winner, then clear table
  animateTrickWin(wi, () => {
    G.table = []; G.leadColor = null;
    if (leeCount === 2) { endRound(); return; }
    if (G.hands.every(h => h.length === 0)) { endRound(); return; }
    G.currentPlayer = G.hands[wi].length > 0 ? wi : nextActiveP(wi);
    setStatus(); render();
    if (G.currentPlayer === mySeatIndex) startTimer();
    else setTimeout(aiPlay, 720);
  });
}
```

- [ ] **Step 3: Verify cards sweep toward winner and table clears after**

- [ ] **Step 4: Commit**
```bash
git add script.js
git commit -m "feat: trick win sweep animation toward winner zone"
```

---

## Task 10: Score modal slide-up animation

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add `animateModalIn()` helper**

Add just before `function buildModal()`:

```js
function animateModalIn() {
  const modal = document.querySelector('.modal-box');
  if (!modal) return;
  modal.animate([
    { transform: 'translateY(40px)', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1 },
  ], { duration: 300, easing: 'cubic-bezier(0.22,0.61,0.36,1)', fill: 'forwards' });

  // Stagger rows
  const rows = modal.querySelectorAll('.modal-row');
  rows.forEach((row, i) => {
    row.style.opacity = '0';
    row.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 220, delay: i * 80, easing: 'ease-out', fill: 'forwards' });

    // Animate progress bar fill after row appears
    const fill = row.querySelector('.progress-bar-fill');
    if (fill) {
      const finalWidth = fill.style.width;
      fill.style.width = '0%';
      setTimeout(() => {
        fill.style.transition = 'width 0.5s ease';
        fill.style.width = finalWidth;
      }, i * 80 + 200);
    }
  });
}
```

- [ ] **Step 2: Call `animateModalIn` after render when modal is shown**

In `endRound()`, after `render()`, add:
```js
function endRound() {
  // ... existing logic ...
  render();
  requestAnimationFrame(animateModalIn);
}
```

Do the same in `tarneebEndRound()`:
```js
function tarneebEndRound() {
  // ... existing logic ...
  render();
  requestAnimationFrame(animateModalIn);
}
```

- [ ] **Step 3: Verify modal slides up and rows stagger in**

- [ ] **Step 4: Commit**
```bash
git add script.js
git commit -m "feat: score modal slide-up with staggered row reveals"
```

---

## Task 11: Dealing animation improvements

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Update `runDealAnimation` — reduce stagger and add card flip**

Find `runDealAnimation` and update the per-card animation:

```js
// FIND:
const delay = i * 30;
const dur = 380;
// REPLACE WITH:
const delay = i * 20;
const dur = 340;
```

Then after the `.animate()` call, add the flip-in effect after the card reaches its destination:

```js
el.animate([
  { transform: 'translate(0,0) scale(0.5)', opacity: 0.8 },
  { transform: `translate(${dx - cx}px,${dy - cy}px) scale(1)`, opacity: 1 }
], { duration: dur, delay, fill: 'both', easing: 'cubic-bezier(0.22,0.61,0.36,1)' });

// Flip reveal after card lands
setTimeout(() => {
  el.animate([
    { transform: `translate(${dx - cx}px,${dy - cy}px) scaleX(0)` },
    { transform: `translate(${dx - cx}px,${dy - cy}px) scaleX(1)` },
  ], { duration: 120, easing: 'ease-out', fill: 'forwards' });
}, delay + dur - 60);
```

- [ ] **Step 2: Verify dealing feels snappier and cards flip on arrival**

- [ ] **Step 3: Commit**
```bash
git add script.js
git commit -m "feat: faster deal stagger, card flip-reveal on arrival"
```

---

## Task 12: Gift phase clarity fixes

**Files:**
- Modify: `script.js`, `style.css`

- [ ] **Step 1: Add CSS for gift clarity**

Append to `style.css`:
```css
.gift-rule-hint {
  font-size: 10px;
  color: rgba(255,255,255,0.55);
  text-align: center;
  margin-bottom: 4px;
  line-height: 1.5;
}
.gift-rule-hint b { color: rgba(255,200,50,0.8); }
.hand-group.gift-blocked .card {
  box-shadow: 0 0 0 2px rgba(255,80,80,0.8) !important;
  border-color: rgba(255,80,80,0.8) !important;
}
```

- [ ] **Step 2: Update `buildGiftHTML()` to add rule hint**

In `buildGiftHTML()`, find the `<div class="tz-btm">` section and add just above the hand:

```js
const hasLee = G.hands[mySeatIndex].some(c => isLee(c));
const ruleHint = hasLee
  ? `<div class="gift-rule-hint">Gift 3 cards to <b>${pname(rightSeat)}</b>.<br>You hold a Lee5a — <b>can't empty any color.</b></div>`
  : `<div class="gift-rule-hint">Gift 3 cards to <b>${pname(rightSeat)}</b>.</div>`;
```

Then insert `${ruleHint}` just before `<div id="my-hand">`.

- [ ] **Step 3: Highlight blocked cards in violation state**

In `buildGiftHTML()`, when building the hand via `buildLee5aHandHTML`, mark groups that would be fully emptied as `gift-blocked`:

After calling `buildLee5aHandHTML`, add a post-processing step. Actually, modify `buildLee5aHandHTML` to accept an optional `blockedColors` set:

In `buildLee5aHandHTML` signature, add parameter: `buildLee5aHandHTML(hand, playableIds, selIds, giftedIds, isSelectable, blockedColors = new Set())`

Then in the group div:
```js
const isBlocked = blockedColors.has(col);
return `<div class="hand-group ${groupClass}${isBlocked ? ' gift-blocked' : ''}">
```

In `buildGiftHTML()`, compute blocked colors:
```js
const blockedColors = new Set();
if (giftViolatesColor(hand, G.selected)) {
  const selIds2 = new Set(G.selected.map(c => c.id));
  const groups2 = {};
  hand.forEach(c => { (groups2[c.color] = groups2[c.color] || []).push(c); });
  for (const [col, cards] of Object.entries(groups2)) {
    if (cards.every(c => selIds2.has(c.id))) blockedColors.add(col);
  }
}
const handHTML = buildLee5aHandHTML(hand, allIds, selSet, null, !G.giftSubmitted, blockedColors);
```

- [ ] **Step 4: Commit**
```bash
git add script.js style.css
git commit -m "feat: gift phase rule hint and violation highlighting"
```

---

## Task 13: Online connection status dot

**Files:**
- Modify: `style.css`, `script.js`

- [ ] **Step 1: Add CSS for connection dot and disconnect banner**

Append to `style.css`:
```css
.conn-dot {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 20;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22ee66;
  box-shadow: 0 0 6px rgba(34,238,102,0.7);
  transition: background 0.3s, box-shadow 0.3s;
}
.conn-dot.yellow {
  background: #ffaa00;
  box-shadow: 0 0 6px rgba(255,170,0,0.7);
  animation: connPulse 1s ease-in-out infinite;
}
.conn-dot.red {
  background: #ff3333;
  box-shadow: 0 0 6px rgba(255,51,51,0.7);
}
@keyframes connPulse {
  0%,100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.conn-banner {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 30;
  background: rgba(200,80,0,0.92);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  padding: 7px;
  border-radius: 16px 16px 0 0;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
}
.conn-banner.visible {
  transform: translateY(0);
}
```

- [ ] **Step 2: Add connection state tracking to `script.js`**

After the `let lastHoveredCard` declaration, add:
```js
let connState = 'connected'; // 'connected' | 'reconnecting' | 'disconnected'
```

- [ ] **Step 3: Update socket event handlers**

Find `socket.on("connect", ...)` and `socket.on("disconnect", ...)` and update:

```js
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  connState = 'connected';
  updateConnDot();
  const saved = sessionStorage.getItem('laye5lo-room');
  if (saved) {
    const { roomCode, seatIndex, name } = JSON.parse(saved);
    socket.emit('rejoinRoom', { roomCode, seatIndex, name });
  }
});
socket.on("disconnect", () => {
  connState = 'disconnected';
  updateConnDot();
});
socket.on("connect_error", () => {
  connState = 'reconnecting';
  updateConnDot();
});
```

- [ ] **Step 4: Add `updateConnDot()` helper**

```js
function updateConnDot() {
  const dot = document.querySelector('.conn-dot');
  if (dot) {
    dot.classList.remove('yellow', 'red');
    if (connState === 'reconnecting') dot.classList.add('yellow');
    else if (connState === 'disconnected') dot.classList.add('red');
  }
  const banner = document.querySelector('.conn-banner');
  if (banner) {
    banner.classList.toggle('visible', connState !== 'connected');
    banner.textContent = connState === 'reconnecting' ? 'Reconnecting...' : 'Connection lost. Reconnecting...';
  }
}
```

- [ ] **Step 5: Add dot + banner to `buildPlayHTML()` and `buildTarneebHTML()`**

At the top of each returned HTML string, after the existing buttons, add:
```js
`<div class="conn-dot${connState === 'reconnecting' ? ' yellow' : connState === 'disconnected' ? ' red' : ''}"></div>
<div class="conn-banner${connState !== 'connected' ? ' visible' : ''}">${connState === 'reconnecting' ? 'Reconnecting...' : 'Connection lost. Reconnecting...'}</div>`
```

- [ ] **Step 6: Commit**
```bash
git add script.js style.css
git commit -m "feat: connection status dot and disconnect banner"
```

---

## Task 14: Tarneeb bidding clarity

**Files:**
- Modify: `script.js`, `style.css`

- [ ] **Step 1: Add CSS for bid badges**

Append to `style.css`:
```css
.bid-badge {
  background: rgba(255,200,50,0.18);
  border: 1px solid rgba(255,200,50,0.35);
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 800;
  color: #ffe066;
  margin-left: 4px;
}
.bid-min-label {
  font-size: 10px;
  color: rgba(255,200,50,0.8);
  font-weight: 700;
  margin-bottom: 4px;
}
.bid-btn.valid-min {
  border-color: rgba(255,200,50,0.7);
  background: rgba(255,200,50,0.15);
  color: #ffe066;
}
.bid-pass-row {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.bid-btn.pass-btn {
  width: 100%;
  border-radius: 14px;
  background: rgba(255,80,80,0.15);
  border-color: rgba(255,80,80,0.4);
  color: #ff8888;
  padding: 0 14px;
  height: 32px;
}
```

- [ ] **Step 2: Update Tarneeb bid UI in `buildTarneebHTML()`**

Find the `if (TG.phase === 'bid')` block and rewrite the `centerContent` for bid phase:

```js
if (TG.phase === 'bid') {
  const isMyBid = TG.currentBidder === mySeatIndex;
  const minBid = Math.max(7, TG.highBid.amount + 1);
  const allPassed = TG.passes >= 3 && TG.highBid.seat === -1;
  const forcedBid = allPassed && TG.currentBidder === TG.dealer;

  // Per-seat bid badges
  const seatBadges = [0,1,2,3].map(i => {
    const entry = TG.bidLog.filter(e => e.seat === i).pop();
    if (!entry) return '';
    const badge = entry.action === 'pass'
      ? `<span class="bid-badge" style="color:#ff8888;border-color:rgba(255,80,80,0.3);background:rgba(255,80,80,0.1)">Pass</span>`
      : `<span class="bid-badge">${entry.amount}</span>`;
    return `<div style="font-size:9px;color:rgba(255,255,255,0.6)">${pname(i)}${badge}</div>`;
  }).join('');

  const bidButtons = isMyBid ? `
    <div class="bid-min-label">${forcedBid ? 'Forced bid — minimum 7' : `Minimum bid: ${minBid}`}</div>
    <div class="bid-buttons">${
      Array.from({ length: 7 }, (_, i) => i + 7).map(n => {
        const isMin = n === minBid;
        const isValid = n >= minBid || forcedBid;
        return `<button class="bid-btn${isMin ? ' valid-min' : ''}" onclick="playerBid(${n})" ${!isValid ? 'disabled' : ''}>${n}</button>`;
      }).join('')
    }</div>
    ${!forcedBid ? `<div class="bid-pass-row"><button class="bid-btn pass-btn" onclick="playerBid(0)">Pass</button></div>` : ''}
  ` : `<div style="font-size:11px;color:rgba(255,255,255,0.6)">${pname(TG.currentBidder)} is bidding...</div>
    <div class="bot-thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;

  centerContent = `<div class="bid-panel">
    <h4>Bidding${TG.highBid.seat >= 0 ? ` — High: <b style="color:#ffe066">${TG.highBid.amount}</b> by ${pname(TG.highBid.seat)}` : ''}</h4>
    <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px">${seatBadges}</div>
    ${bidButtons}
  </div>`;
}
```

- [ ] **Step 3: Verify bid panel shows per-player badges, min bid highlighted, pass on separate row**

- [ ] **Step 4: Commit**
```bash
git add script.js style.css
git commit -m "feat: Tarneeb bidding — per-player badges, min bid highlight, pass row"
```

---

## Task 15: Push to production

- [ ] **Step 1: Verify the full game works end-to-end**

Open `https://laye5lo.vercel.app` (or local) and check:
- [ ] Lee5a: dealing animation, grouped hand, timer ring, trick sweep, score modal
- [ ] Tarneeb: grouped suit hand, bid panel with badges, timer ring
- [ ] Desktop (≥640px): score sidebar visible, table beside it
- [ ] Mobile (≤480px): sidebar hidden, score strip shown, smaller cards
- [ ] Both-Lee5as rule text updated in modal

- [ ] **Step 2: Commit any remaining fixes**

- [ ] **Step 3: Deploy frontend to Vercel production**
```bash
vercel --prod
```

- [ ] **Step 4: Confirm deploy is live**
```bash
curl -s https://laye5lo.vercel.app | head -5
```

---

## Self-Review Against Spec

| Spec section | Covered by task(s) |
|---|---|
| 1. Visual theme (background, rim, cards, panels) | Task 2 |
| 2. Hand layout grouped + glows + responsive | Tasks 3, 4, 5 |
| 3. SVG timer ring, 30s, color states, bot gold | Task 6 |
| 4. Score sidebar desktop, mobile strip, animated updates | Task 7 |
| 5a. Card play animation | Task 8 |
| 5b. Trick win sweep | Task 9 |
| 5c. Modal slide-up + stagger | Task 10 |
| 5d. Deal stagger + card flip | Task 11 |
| 6. Both-Lee5as rule = 37pts, prominent display | Task 1 |
| 7. Gift phase rule hint + violation highlight | Task 12 |
| 7. Online connection dot + disconnect banner | Task 13 |
| 7. Tarneeb bidding clarity | Task 14 |
| Deploy | Task 15 |
