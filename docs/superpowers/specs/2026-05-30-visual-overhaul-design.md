# Laye5lo — Visual Overhaul, Animations & Clarity Fixes

**Date:** 2026-05-30  
**Scope:** `script.js`, `style.css` (frontend only — no server changes)  
**Goal:** Make the game look polished and professional, feel fluid, and be unambiguous to play — on both mobile and desktop.

---

## 1. Visual Theme

**Background & table**
- Radial gradient felt: `#1a5c32 → #0d3a1e → #071e0f` (unchanged hue, deeper blacks)
- Gold oval rim: `border: 2px solid rgba(255,200,50,0.18)` with `box-shadow: 0 0 40px rgba(255,200,50,0.06)`
- Felt crosshatch texture kept (subtle repeating-linear-gradient overlay)

**Panels, modals, menus**
- Frosted-dark glass: `background: rgba(0,0,0,0.55); border: 1px solid rgba(255,200,50,0.2); border-radius: 12px`
- All existing `.room-panel`, `.modal-box`, `.bid-panel` updated to this treatment

**Cards**
- Sharper drop shadow: `box-shadow: 0 6px 20px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.3)`
- Hover lift: `transform: translateY(-10px)` with `transition: transform 0.15s cubic-bezier(0.22,0.61,0.36,1)`
- No other visual changes to card face

---

## 2. Hand Layout

Replaces the current flat-arc hand for both Lee5a and Tarneeb.

**Structure**
- Cards grouped by color (Lee5a) or suit (Tarneeb)
- Each group rendered as a horizontal stack with `-12px` overlap
- A small color/suit label sits above each group: `font-size: 9px; font-weight: 700; opacity: 0.8`

**Playability**
- Playable group: full brightness + `box-shadow: 0 0 12px <color-glow>` on each card + `border: 2px solid <color-glow>`
- Unplayable group: `opacity: 0.3; pointer-events: none; cursor: not-allowed`
- When lead color is set, only the matching color group is playable (or Lee5a cards if no match)

**Interaction**
- Hover on a playable card: `translateY(-10px)` lift
- Click plays the card immediately (no separate "confirm" step — current behavior kept)
- Selected cards in gift phase: `translateY(-18px)` + gold outline (current behavior kept, adapted to grouped layout)

**Responsive**
- Card size: `54×82px` on desktop, `44×68px` on mobile (≤480px) — same as current breakpoint

---

## 3. Active Player & Timer Ring

Replaces the current conic-gradient CSS timer ring on the player name badge.

**SVG ring component**
- Rendered as an inline `<svg>` wrapping each player avatar (all four positions)
- Ring radius: `22px` (fits a `56×56` container), stroke-width: `5.5px`
- Background track: `stroke: rgba(255,255,255,0.06)`
- Active arc: `stroke-dasharray: 138.2` (circumference of r=22), `stroke-dashoffset` computed each tick

**Timer states (your turn only)**
- 30–16s: stroke `#22ee66`, avatar border `rgba(34,238,102,0.7)`, avatar shadow `0 0 16px rgba(34,238,102,0.4)`
- 15–6s: stroke `#ffaa00`, avatar border `rgba(255,170,0,0.6)`
- 5–0s: stroke `#ff3333`, avatar border `rgba(255,51,51,0.8)`, avatar background shifts red, ring pulses via CSS animation

**Bot / opponent turn**
- Active bot: gold pulsing ring (`rgba(255,200,50,0.7)`), no countdown — pure activity indicator
- Inactive players: no ring, avatar at reduced opacity (`0.6`)

**Timer duration:** 30 seconds (increased from 20). `CONFIG.timerSeconds = 30`.

**Implementation note:** The SVG `stroke-dashoffset` is updated every second inside `updateTimerRing()`, which replaces `updateTimerBar()`. The ring is re-rendered by updating a `<circle>` element's attribute directly (no full re-render needed).

---

## 4. Score Panel & Desktop Layout

**Mobile (< 640px)**
- Compact top strip: player name + score, no progress bars. Existing `.score-strip` updated for better sizing.

**Desktop (≥ 640px)**
- Left sidebar: `width: 130px`, fixed alongside the table
- Sidebar contents (top to bottom):
  1. **Scores section**: each player row = name + score number + progress bar toward 101 (Lee5a) or 400 (Tarneeb)
  2. **Last trick section**: mini card thumbnails + winner name + points gained
  3. No timer in sidebar — timer is on the avatar ring
- Table takes remaining width, centered within its column

**Score animation**
- On score update: number animates via `requestAnimationFrame` count-up over 600ms
- Progress bar width transitions via CSS `transition: width 0.6s ease`
- Player row flashes gold briefly (`background` keyframe) when they gain points

**Danger threshold**
- Lee5a: score ≥ 80 → row tints red, score number turns `#ff6666`
- Tarneeb: score ≥ 350 → same treatment

---

## 5. Animations

All animations use the Web Animations API (`element.animate()`), consistent with the existing dealing animation.

### 5a. Card Play
When a card is played (by any player):
1. Card element created at the player's hand position (or avatar position for opponents)
2. Animates to the table center slot over `280ms` with `cubic-bezier(0.22, 0.61, 0.36, 1)`
3. Slight arc: midpoint keyframe offsets Y by `-20px` relative to the straight path
4. Drop shadow grows at landing: `box-shadow` keyframe from `0 2px 6px` to `0 12px 28px`

### 5b. Trick Win
When a trick is complete (after the `CONFIG.trickDelayMs` = 1150ms reveal delay):
1. All 4 table cards simultaneously animate toward the winner's avatar zone
2. Duration: `400ms`, easing `ease-in`
3. Cards scale down `0.3` and fade out as they reach the target
4. Brief white flash on the winner's avatar: `opacity 0→1→0` over `300ms`

### 5c. Round End / Score Modal
Score modal (`buildModal`) slide-up reveal:
1. Modal enters from `translateY(40px) opacity 0` → `translateY(0) opacity 1` over `300ms`
2. Each player row staggers in: `delay = index * 80ms`
3. Progress bars animate from `width: 0` to final width after row appears (`delay + 200ms`)
4. If `gameEnd`: winner name pulses gold before "New Game" button appears

### 5d. Dealing (existing — improvements)
- Stagger reduced from `30ms` to `20ms` per card (faster overall feel)
- Each card does a quick flip on arrival: `scaleX 0 → 1` over `120ms` after reaching destination, revealing card face

---

## 6. Rule Clarification — Both Lee5as

**Rule:** If a player takes both Lee5as (blue +2 and yellow 0) in the **same trick**, the round ends immediately and that player receives **+37 points**. This is correct in the existing code — no change needed.

**Rules display only:** The Lee5a rules modal text must clearly state: *"Both Lee5as taken in one trick = +37 pts and the round ends immediately."* The current modal says `37 pts` but buries it — make it prominent.

---

## 7. Clarity Fixes — UI

### Gift Phase
- Inline rule reminder below hand: `"Gift 3 cards to [name]. Holding Lee5a? You can't empty any color."`
- Selected cards preview: 3 ghost slots above the hand update in real time as cards are selected
- Violation state: blocked cards highlight with a red outline + shake animation; error message explains why
- "Confirm Gift" button: disabled + red tooltip on hover when violation active

### Online Connection Status
- Small dot `8×8px` in bottom-left corner (opposite sound button):
  - Green: connected
  - Yellow: reconnecting (pulsing)
  - Red: disconnected
- On disconnect: banner slides down from top — `"Connection lost. Reconnecting..."` — auto-dismisses on reconnect
- While waiting for server state after reconnect: player hand shows skeleton cards (blurred backs) until `gameState` received

### Tarneeb Bidding
- Each player's submitted bid shown as a small badge next to their avatar (replaces current log-only approach)
- Bid buttons: minimum valid bid highlighted in gold; below-minimum buttons grayed but not hidden
- Label above bid buttons: `"Minimum bid: X"` — updates as the high bid changes
- Pass button moved to a separate row, colored red, with `"Pass"` label — not mixed with number buttons

---

## 8. Files Changed

| File | Change |
|---|---|
| `style.css` | New theme variables, ring styles, hand layout, sidebar, animation keyframes, desktop breakpoint |
| `script.js` | `updateTimerRing()`, `buildHandHTML()`, grouped hand renderer, WAAPI animation functions, sidebar render, `CONFIG.timerSeconds = 30`, clarity fix UI, rules modal update |

No server changes needed. No new files (keep the single-file frontend architecture).

---

## 9. Out of Scope

- Sound effects changes
- New game modes
- Auth UI changes
- Leaderboard / stats submission
- Any server-side logic
