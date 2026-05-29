const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

app.use(cors());

app.get("/", (req, res) => {
  res.send("Laye5lo multiplayer server is running.");
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

// ── LEE5A CARD HELPERS ───────────────────────────────────────
const COLOR_ORDER = ['red', 'blue', 'green', 'yellow'];
const STRENGTH = { '1': 13, 'skip': 12, 'draw2': 11, 'reverse': 10, '0': 9, '9': 8, '8': 7, '7': 6, '6': 5, '5': 4, '4': 3, '3': 2, '2': 1 };

function buildDeck() {
  const d = [];
  COLOR_ORDER.forEach(col =>
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'draw2', 'reverse'].forEach(t =>
      d.push({ color: col, type: t, id: `${col}-${t}` })
    )
  );
  return d;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function sortHand(h) {
  return [...h].sort((a, b) => {
    const ci = COLOR_ORDER.indexOf(a.color) - COLOR_ORDER.indexOf(b.color);
    return ci || (STRENGTH[b.type] || 0) - (STRENGTH[a.type] || 0);
  });
}

function pts(c) {
  if (c.color === 'blue' && c.type === 'draw2') return 13;
  if (c.color === 'yellow' && c.type === '0') return 10;
  if (c.color === 'red') return 1;
  return 0;
}
function isLee(c) { return (c.color === 'blue' && c.type === 'draw2') || (c.color === 'yellow' && c.type === '0'); }
function str(c) { return STRENGTH[c.type] || 0; }

function giftViolatesColor(hand, sel) {
  if (!hand.some(c => isLee(c))) return false;
  const selIds = new Set(sel.map(c => c.id));
  const groups = {};
  hand.forEach(c => { (groups[c.color] = groups[c.color] || []).push(c); });
  return Object.values(groups).some(cards => cards.every(c => selIds.has(c.id)));
}

// Full smart gift logic (mirrors client)
function colorCounts(hand) {
  return COLOR_ORDER.reduce((m, col) => { m[col] = hand.filter(c => c.color === col).length; return m; }, {});
}

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
    if (card.color === 'blue' || card.color === 'yellow') { score += counts[card.color] <= 3 ? -12 : 2; if (difficulty === 'hard' && counts[card.color] < avgPerOpponent) score -= 8; }
    else { score += card.color === 'green' ? 5 : 4; }
    if (afterColorCount === 0) score -= difficulty === 'hard' ? 12 : 6;
  }
  return score;
}

function chooseSmartGift(hand, difficulty) {
  if (!difficulty) difficulty = 'easy';
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

// Smart bot card choice (mirrors client pickSmartCard logic)
function scoreBotCardServer(card, game, seatIndex, difficulty) {
  const isLast = game.table.length === 3;
  const leadColor = game.leadColor;
  let score = 0;

  if (!leadColor) {
    score -= pts(card) * 3;
    score -= str(card) * 0.25;
    if (isLee(card)) score -= difficulty === 'hard' ? 18 : 10;
    if (card.color === 'green' && difficulty === 'hard') score += str(card) * 1.3 + 8;
  } else if (card.color === leadColor) {
    const tableMax = Math.max(...game.table.filter(t => t.card.color === leadColor).map(t => str(t.card)), 0);
    const wins = str(card) > tableMax;
    const trickPts = [...game.table.map(t => t.card), card].reduce((s, c) => s + pts(c), 0);
    if (wins) { score -= trickPts * (difficulty === 'hard' ? 5 : 3); }
    else { score += 8 + str(card) * 0.2; }
  } else {
    if (pts(card) > 0 && !isLast) score += pts(card) * 4;
    if (isLee(card) && game.table.some(t => isLee(t.card))) score += difficulty === 'hard' ? 25 : 12;
    else if (isLee(card)) score += difficulty === 'hard' ? 8 : 4;
    score += str(card) * 0.1;
  }
  return score;
}

function chooseBotCard(game, seatIndex, difficulty) {
  const pl = getPlayableServer(game, seatIndex);
  if (!difficulty || difficulty === 'easy') {
    if (!game.leadColor) {
      const safe = pl.filter(c => pts(c) === 0);
      const pool = safe.length ? safe : pl;
      return pool.reduce((best, c) => str(c) < str(best) ? c : best, pool[0]);
    }
    const suited = pl.filter(c => c.color === game.leadColor);
    if (suited.length) {
      const tableMax = Math.max(...game.table.filter(t => t.card.color === game.leadColor).map(t => str(t.card)), 0);
      const under = suited.filter(c => str(c) < tableMax);
      if (under.length) return under.reduce((best, c) => str(c) > str(best) ? c : best, under[0]);
      return suited.reduce((best, c) => str(c) < str(best) ? c : best, suited[0]);
    }
    const byPts = [...pl].sort((a, b) => pts(b) - pts(a) || str(b) - str(a));
    return byPts[0];
  }
  // Medium/Hard: use scoring
  const scored = pl.map(c => ({ card: c, score: scoreBotCardServer(c, game, seatIndex, difficulty) }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].card;
}

function applyGifts(game) {
  const nh = game.hands.map(h => [...h]);
  const gs = game.gifts;
  for (let i = 0; i < 4; i++) {
    const giftIds = new Set(gs[i].map(c => c.id));
    nh[i] = nh[i].filter(c => !giftIds.has(c.id));
  }
  const received = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const receiver = (i + 1) % 4;
    gs[i].forEach(c => { nh[receiver].push(c); received[receiver].push(c.id); });
  }
  game.hands = nh.map(sortHand);
  game.receivedGiftCardIdsBySeat = received;
}

function dealGame(playerNames) {
  const deck = shuffle(buildDeck());
  const hands = [[], [], [], []];
  deck.forEach((c, i) => hands[i % 4].push(c));
  return {
    phase: 'gift', playerNames,
    hands: hands.map(sortHand), gifts: [null, null, null, null],
    table: [], currentPlayer: 0, leadColor: null,
    scores: [0, 0, 0, 0], roundPts: [0, 0, 0, 0],
    selected: [], statusMsg: `Choose 3 cards to gift to ${playerNames[1]}`,
    botThought: '', playedCards: [], knownGiftedLees: [], modal: null
  };
}

// ── TARNEEB HELPERS ──────────────────────────────────────────
const TARNEEB_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const TARNEEB_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const TARNEEB_RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

function buildTarneebDeck() {
  const d = [];
  TARNEEB_SUITS.forEach(suit => TARNEEB_RANKS.forEach(rank =>
    d.push({ suit, rank, id: `${suit}-${rank}`, val: TARNEEB_RANK_VAL[rank] })
  ));
  return d;
}

function sortTarneebHand(h) {
  return [...h].sort((a, b) => {
    const si = TARNEEB_SUITS.indexOf(a.suit) - TARNEEB_SUITS.indexOf(b.suit);
    return si || b.val - a.val;
  });
}

function getPlayableTarneebServer(state, seatIndex) {
  const hand = state.hands[seatIndex];
  if (!state.leadSuit) return hand;
  const suited = hand.filter(c => c.suit === state.leadSuit);
  if (suited.length) return suited;
  return hand;
}

function tarneebTrickWinnerServer(table, leadSuit, trump) {
  let best = table[0];
  for (let i = 1; i < table.length; i++) {
    const c = table[i];
    const bestIsTrump = best.card.suit === trump;
    const cIsTrump = c.card.suit === trump;
    if (cIsTrump && !bestIsTrump) best = c;
    else if (cIsTrump && bestIsTrump) { if (c.card.val > best.card.val) best = c; }
    else if (!cIsTrump && !bestIsTrump && c.card.suit === leadSuit && best.card.suit === leadSuit) { if (c.card.val > best.card.val) best = c; }
    else if (!cIsTrump && !bestIsTrump && c.card.suit === leadSuit && best.card.suit !== leadSuit) best = c;
  }
  return best;
}

// ── ROOM HELPERS ─────────────────────────────────────────────
function normalizeRoomCode(roomCode) {
  return String(roomCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function roomPayload(roomCode) {
  const room = rooms[roomCode];
  return { roomCode, hostId: room.hostId, seats: room.seats };
}

function isBotSeat(room, idx) {
  return !!(room.seats[idx] && room.seats[idx].type === 'bot');
}

function getPlayableServer(game, seatIndex) {
  const hand = game.hands[seatIndex];
  if (!game.leadColor) return hand;
  const suited = hand.filter(c => c.color === game.leadColor);
  if (suited.length) return suited;
  const lees = hand.filter(c => isLee(c));
  if (lees.length) return lees;
  return hand;
}

function trickWinnerServer(table, leadColor) {
  const lead = table.filter(t => t.card.color === leadColor);
  return lead.reduce((best, t) => str(t.card) > str(best.card) ? t : best, lead[0]);
}

function broadcastGameState(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  room.seats.forEach((seat, idx) => {
    if (seat && seat.id) {
      io.to(seat.id).emit("gameState", { roomCode, gameState: room.game, mySeatIndex: idx });
    }
  });
}

function broadcastTarneebState(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.tarneebState) return;
  room.seats.forEach((seat, idx) => {
    if (seat && seat.id) {
      io.to(seat.id).emit("tarneeb:state", { roomCode, gameState: room.tarneebState, mySeatIndex: idx });
    }
  });
}

function playCardForSeat(roomCode, seatIndex, cardId) {
  const room = rooms[roomCode];
  if (!room || !room.game) return false;
  const game = room.game;
  if (game.phase !== 'play') return false;
  if (game.currentPlayer !== seatIndex) return false;

  const hand = game.hands[seatIndex];
  const card = hand.find(c => c.id === cardId);
  if (!card) return false;

  const playable = getPlayableServer(game, seatIndex);
  if (!playable.find(c => c.id === cardId)) return false;

  game.hands[seatIndex] = sortHand(hand.filter(c => c.id !== cardId));
  if (!game.playedCards) game.playedCards = [];
  game.playedCards.push(card);
  game.table.push({ pi: seatIndex, card });
  if (!game.leadColor) game.leadColor = card.color;

  const leesOnTable = game.table.filter(t => isLee(t.card)).length;
  const trickDone = game.table.length === 4 || leesOnTable === 2;

  if (trickDone) {
    const trickPts = leesOnTable === 2 ? 37 : game.table.reduce((s, t) => s + pts(t.card), 0);
    const winner = trickWinnerServer(game.table, game.leadColor);
    const wi = winner.pi;
    game.roundPts[wi] = (game.roundPts[wi] || 0) + trickPts;
    game.statusMsg = leesOnTable === 2
      ? `${game.playerNames[wi]} took both Lee5as! +37 pts`
      : `${game.playerNames[wi]} wins trick${trickPts > 0 ? ` (+${trickPts}pts)` : ''}`;
    game.trickResolving = true;
    broadcastGameState(roomCode);

    setTimeout(() => {
      const room2 = rooms[roomCode];
      if (!room2 || !room2.game) return;
      const g = room2.game;
      g.trickResolving = false;
      g.receivedGiftCardIdsBySeat = null;
      g.table = []; g.leadColor = null;

      const roundOver = leesOnTable === 2 || g.hands.every(h => h.length === 0);
      if (roundOver) {
        g.scores = g.scores.map((sc, i) => sc + (g.roundPts[i] || 0));
        const gameOver = Math.max(...g.scores) >= 101;
        g.phase = gameOver ? 'gameEnd' : 'roundEnd';
        g.modal = { type: gameOver ? 'gameEnd' : 'roundEnd', rp: [...g.roundPts], sc: [...g.scores] };
        g.roundPts = [0, 0, 0, 0];
        broadcastGameState(roomCode);
        return;
      }
      g.currentPlayer = wi;
      g.statusMsg = `${g.playerNames[wi]}'s turn`;
      broadcastGameState(roomCode);
      if (isBotSeat(room2, wi)) setTimeout(() => scheduleBotPlay(roomCode), 750);
    }, 1500);
    return true;
  } else {
    game.currentPlayer = (seatIndex + 1) % 4;
    game.statusMsg = `${game.playerNames[game.currentPlayer]}'s turn`;
  }
  broadcastGameState(roomCode);
  if (game.phase === 'play' && isBotSeat(room, game.currentPlayer)) {
    setTimeout(() => scheduleBotPlay(roomCode), 750);
  }
  return true;
}

function scheduleBotPlay(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.game) return;
  const game = room.game;
  if (game.phase !== 'play') return;
  const seatIndex = game.currentPlayer;
  if (!isBotSeat(room, seatIndex)) return;
  const difficulty = room.botDifficulty || 'easy';
  const card = chooseBotCard(game, seatIndex, difficulty);
  if (!card) return;
  playCardForSeat(roomCode, seatIndex, card.id);
}

// ── SOCKET CONNECTION ────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // ── CREATE ROOM ──
  socket.on("createRoom", () => {
    const roomCode = makeRoomCode();
    rooms[roomCode] = {
      hostId: socket.id,
      botDifficulty: 'easy',
      seats: [{ id: socket.id, name: "Host", type: "host" }, null, null, null]
    };
    socket.join(roomCode);
    socket.emit("roomCreated", roomPayload(roomCode));
  });

  // ── JOIN ROOM ──
  socket.on("joinRoom", ({ roomCode, name }) => {
    roomCode = normalizeRoomCode(roomCode);
    if (!rooms[roomCode]) { socket.emit("joinError", "Room not found."); return; }
    const room = rooms[roomCode];
    const emptyIdx = room.seats.findIndex(s => s === null);
    if (emptyIdx === -1) { socket.emit("joinError", "Room is full."); return; }
    const playerName = name || `Player ${emptyIdx + 1}`;
    room.seats[emptyIdx] = { id: socket.id, name: playerName, type: "player" };
    socket.join(roomCode);
    io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
  });

  // ── REJOIN ROOM ──
  socket.on("rejoinRoom", ({ roomCode, seatIndex, name }) => {
    roomCode = normalizeRoomCode(roomCode);
    if (!rooms[roomCode]) return;
    const room = rooms[roomCode];
    if (seatIndex >= 0 && seatIndex < 4 && room.seats[seatIndex]) {
      room.seats[seatIndex].id = socket.id;
      room.seats[seatIndex].name = name || room.seats[seatIndex].name;
      socket.join(roomCode);
      if (room.game) {
        io.to(socket.id).emit("gameState", { roomCode, gameState: room.game, mySeatIndex: seatIndex });
      } else if (room.tarneebState) {
        io.to(socket.id).emit("tarneeb:state", { roomCode, gameState: room.tarneebState, mySeatIndex: seatIndex });
      } else {
        io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
      }
    }
  });

  // ── ADD BOT ──
  socket.on("addBotToRoom", ({ roomCode }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room) { socket.emit("lobbyError", "Room not found."); return; }
    if (room.hostId !== socket.id) { socket.emit("lobbyError", "Only the host can add bots."); return; }
    const emptyIdx = room.seats.findIndex(s => s === null);
    if (emptyIdx === -1) { socket.emit("lobbyError", "Room is full."); return; }
    const botNum = room.seats.filter(s => s && s.type === "bot").length + 1;
    room.seats[emptyIdx] = { id: null, name: `Bot ${botNum}`, type: "bot" };
    io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
  });

  // ── REMOVE SEAT ──
  socket.on("removeSeatFromRoom", ({ roomCode, seatIndex }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room) { socket.emit("lobbyError", "Room not found."); return; }
    if (room.hostId !== socket.id) { socket.emit("lobbyError", "Only the host can remove seats."); return; }
    const seat = room.seats[seatIndex];
    if (!seat || seat.type === "host") { socket.emit("lobbyError", "Cannot remove this seat."); return; }
    room.seats[seatIndex] = null;
    io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
  });

  // ── MOVE SEAT ──
  socket.on("moveSeatInRoom", ({ roomCode, seatIndex, direction }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room) { socket.emit("lobbyError", "Room not found."); return; }
    if (room.hostId !== socket.id) { socket.emit("lobbyError", "Only the host can move seats."); return; }
    const j = seatIndex + direction;
    if (j < 0 || j >= 4) return;
    const a = room.seats[seatIndex], b = room.seats[j];
    if ((a && a.type === "host") || (b && b.type === "host")) { socket.emit("lobbyError", "Cannot move the host seat."); return; }
    room.seats[seatIndex] = b; room.seats[j] = a;
    io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
  });

  // ── START ROOM ──
  socket.on("startRoom", ({ roomCode }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room) { socket.emit("lobbyError", "Room not found."); return; }
    if (room.hostId !== socket.id) { socket.emit("lobbyError", "Only the host can start."); return; }
    if (room.seats.filter(Boolean).length < 4) { socket.emit("lobbyError", "All 4 seats must be filled."); return; }

    const playerNames = room.seats.map(s => s.name);
    const gameState = dealGame(playerNames);
    room.game = gameState;
    room.seats.forEach((seat, seatIndex) => {
      if (seat && seat.id) {
        io.to(seat.id).emit("gameStarted", { roomCode, gameState, mySeatIndex: seatIndex });
      }
    });
  });

  // ── SUBMIT GIFT ──
  socket.on("submitGift", ({ roomCode, cardIds }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.game) { socket.emit("lobbyError", "Game not found."); return; }
    const game = room.game;
    if (game.phase !== 'gift') { socket.emit("lobbyError", "Not in gift phase."); return; }
    const seatIndex = room.seats.findIndex(s => s && s.id === socket.id);
    if (seatIndex === -1) { socket.emit("lobbyError", "You are not in this game."); return; }
    if (game.gifts[seatIndex]) { socket.emit("lobbyError", "Already submitted."); return; }
    if (!Array.isArray(cardIds) || cardIds.length !== 3) { socket.emit("lobbyError", "Select exactly 3 cards."); return; }

    const hand = game.hands[seatIndex];
    const chosen = cardIds.map(id => hand.find(c => c.id === id)).filter(Boolean);
    if (chosen.length !== 3) { socket.emit("lobbyError", "Cards not found."); return; }
    if (giftViolatesColor(hand, chosen)) { socket.emit("lobbyError", "Invalid gift: can't empty a color while holding Lee5a."); return; }

    game.gifts[seatIndex] = chosen;
    const difficulty = room.botDifficulty || 'easy';
    room.seats.forEach((seat, idx) => {
      if (seat && seat.type === 'bot' && !game.gifts[idx]) {
        game.gifts[idx] = chooseSmartGift(game.hands[idx], difficulty);
      }
    });

    if (game.gifts.every(Boolean)) {
      applyGifts(game);
      game.phase = 'play'; game.currentPlayer = 0;
      game.leadColor = null; game.table = []; game.selected = [];
      game.trickComplete = false;
      game.statusMsg = `${game.playerNames[0]}'s turn`;
    }
    broadcastGameState(roomCode);
    if (game.phase === 'play' && isBotSeat(room, game.currentPlayer)) {
      setTimeout(() => scheduleBotPlay(roomCode), 750);
    }
  });

  // ── PLAY CARD ──
  socket.on("playCard", ({ roomCode, cardId }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.game) { socket.emit("lobbyError", "Game not found."); return; }
    const seatIndex = room.seats.findIndex(s => s && s.id === socket.id);
    if (seatIndex === -1) { socket.emit("lobbyError", "Not in game."); return; }
    const game = room.game;
    if (game.phase !== 'play' || game.trickResolving || game.currentPlayer !== seatIndex) {
      socket.emit("lobbyError", "Not your turn."); return;
    }
    if (!playCardForSeat(roomCode, seatIndex, cardId)) socket.emit("lobbyError", "Invalid move.");
  });

  // ── START NEXT ROUND ──
  socket.on("startNextRound", ({ roomCode }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room) { socket.emit("lobbyError", "Room not found."); return; }
    if (room.hostId !== socket.id) { socket.emit("lobbyError", "Only host."); return; }
    if (!room.game) { socket.emit("lobbyError", "No game."); return; }
    const game = room.game;
    if (game.phase !== 'roundEnd' && game.phase !== 'gameEnd') { socket.emit("lobbyError", "Round not over."); return; }

    const deck = shuffle(buildDeck());
    const hands = [[], [], [], []];
    deck.forEach((c, i) => hands[i % 4].push(c));
    room.game = {
      phase: 'gift', playerNames: [...game.playerNames],
      hands: hands.map(sortHand), gifts: [null, null, null, null],
      table: [], currentPlayer: 0, leadColor: null,
      scores: [...game.scores], roundPts: [0, 0, 0, 0],
      selected: [], statusMsg: `Choose 3 cards to gift to ${game.playerNames[1]}`,
      botThought: '', playedCards: [], knownGiftedLees: [], modal: null,
      trickResolving: false, receivedGiftCardIdsBySeat: null,
    };
    broadcastGameState(roomCode);

    const difficulty = room.botDifficulty || 'easy';
    room.seats.forEach((seat, idx) => {
      if (seat && seat.type === 'bot') {
        room.game.gifts[idx] = chooseSmartGift(room.game.hands[idx], difficulty);
      }
    });
    if (room.game.gifts.every(Boolean)) {
      applyGifts(room.game);
      room.game.phase = 'play'; room.game.currentPlayer = 0;
      room.game.statusMsg = `${room.game.playerNames[0]}'s turn`;
      broadcastGameState(roomCode);
    }
  });

  // ── TARNEEB EVENTS ─────────────────────────────────────────
  socket.on("tarneeb:submitBid", ({ roomCode, seatIndex, amount }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.tarneebState) return;
    const state = room.tarneebState;
    if (state.phase !== 'bid' || state.currentBidder !== seatIndex) return;

    if (amount === 0) {
      state.bidLog.push({ seat: seatIndex, action: 'pass' });
      state.passes++;
      if (state.passes === 3 && state.highBid.seat >= 0) {
        state.phase = 'trumpSelect';
        state.bidAmount = state.highBid.amount;
        state.biddingTeam = seatIndex % 2;
      } else {
        state.currentBidder = (seatIndex + 1) % 4;
      }
    } else {
      state.highBid = { amount, seat: seatIndex };
      state.bidLog.push({ seat: seatIndex, action: 'bid', amount });
      state.passes = 0;
      if (amount === 13) {
        state.phase = 'trumpSelect';
        state.bidAmount = 13;
        state.biddingTeam = seatIndex % 2;
      } else {
        state.currentBidder = (seatIndex + 1) % 4;
      }
    }
    broadcastTarneebState(roomCode);
  });

  socket.on("tarneeb:declareTrump", ({ roomCode, seatIndex, suit }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.tarneebState) return;
    const state = room.tarneebState;
    if (state.phase !== 'trumpSelect' || state.highBid.seat !== seatIndex) return;
    state.trump = suit;
    state.phase = 'play';
    state.currentPlayer = state.highBid.seat;
    state.tricksTaken = [0, 0];
    state.table = []; state.leadSuit = null;
    broadcastTarneebState(roomCode);
  });

  socket.on("tarneeb:playCard", ({ roomCode, seatIndex, cardId }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.tarneebState) return;
    const state = room.tarneebState;
    if (state.phase !== 'play' || state.currentPlayer !== seatIndex) return;

    const hand = state.hands[seatIndex];
    const card = hand.find(c => c.id === cardId);
    if (!card) return;
    const playable = getPlayableTarneebServer(state, seatIndex);
    if (!playable.find(c => c.id === cardId)) return;

    state.hands[seatIndex] = sortTarneebHand(hand.filter(c => c.id !== cardId));
    state.table.push({ pi: seatIndex, card });
    if (!state.leadSuit) state.leadSuit = card.suit;

    if (state.table.length === 4) {
      broadcastTarneebState(roomCode);
      setTimeout(() => {
        const winner = tarneebTrickWinnerServer(state.table, state.leadSuit, state.trump);
        const wi = winner.pi;
        state.tricksTaken[wi % 2]++;
        state.table = []; state.leadSuit = null;
        state.currentPlayer = wi;

        if (state.hands.every(h => h.length === 0)) {
          // Round end
          const bidTeam = state.biddingTeam;
          const bidAmt = state.bidAmount;
          const tricksBid = state.tricksTaken[bidTeam];
          let bidTeamPts;
          if (bidAmt === 13 && tricksBid === 13) bidTeamPts = 26;
          else if (bidAmt === 13 && tricksBid < 13) bidTeamPts = -26;
          else if (tricksBid >= bidAmt) bidTeamPts = tricksBid;
          else bidTeamPts = -bidAmt;
          state.scores[bidTeam] += bidTeamPts;
          state.scores[1 - bidTeam] += state.tricksTaken[1 - bidTeam];
          state.phase = (state.scores[0] >= 400 || state.scores[1] >= 400) ? 'gameEnd' : 'roundEnd';
          state.roundResult = { bidTeam, bidAmt, tricksBid, bidTeamPts, defTeamPts: state.tricksTaken[1 - bidTeam] };
        }
        broadcastTarneebState(roomCode);
      }, 1500);
    } else {
      state.currentPlayer = (seatIndex + 1) % 4;
      broadcastTarneebState(roomCode);
    }
  });

  socket.on("tarneeb:startNextHand", ({ roomCode }) => {
    roomCode = normalizeRoomCode(roomCode);
    const room = rooms[roomCode];
    if (!room || !room.tarneebState) return;
    if (room.hostId !== socket.id) return;
    const state = room.tarneebState;
    const scores = [...state.scores];
    const newDealer = (state.dealer + 1) % 4;
    const deck = shuffle(buildTarneebDeck());
    const hands = [[], [], [], []];
    deck.forEach((c, i) => hands[i % 4].push(c));
    room.tarneebState = {
      phase: 'bid', hands: hands.map(sortTarneebHand),
      dealer: newDealer, currentBidder: (newDealer + 1) % 4,
      highBid: { amount: 0, seat: -1 }, passes: 0, trump: null,
      biddingTeam: null, bidAmount: 0, currentPlayer: 0,
      table: [], leadSuit: null, scores, tricksTaken: [0, 0],
      bidLog: [], playerNames: state.playerNames
    };
    broadcastTarneebState(roomCode);
  });

  // ── REACTIONS ──
  socket.on("sendReaction", ({ roomCode, seatIndex, emoji }) => {
    roomCode = normalizeRoomCode(roomCode);
    if (!rooms[roomCode]) return;
    io.to(roomCode).emit("reaction", { seatIndex, emoji });
  });

  // ── DISCONNECT ──
  socket.on("disconnect", () => {
    for (const roomCode of Object.keys(rooms)) {
      const room = rooms[roomCode];
      let changed = false;
      room.seats = room.seats.map(seat => {
        if (seat && seat.id === socket.id) { changed = true; return null; }
        return seat;
      });
      if (!room.seats.some(s => s && s.id !== null)) {
        delete rooms[roomCode];
        continue;
      }
      if (changed) io.to(roomCode).emit("roomUpdated", roomPayload(roomCode));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
