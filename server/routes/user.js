const express = require('express');
const authMiddleware = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// All routes in this file require authentication
router.use(authMiddleware);

// ── GET /api/user/profile ──
router.get('/profile', async (req, res) => {
  try {
    res.json({ user: req.user.toPublicJSON() });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PUT /api/user/profile ──
router.put('/profile', async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const user = req.user;

    if (username !== undefined) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be 3-20 characters.' });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
      }
      // Check if username is taken by another user
      const existing = await User.findOne({ username, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
      user.username = username;
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();
    res.json({ message: 'Profile updated.', user: user.toPublicJSON() });
  } catch (err) {
    console.error('Update profile error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username already taken.' });
    }
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/user/stats ──
router.get('/stats', async (req, res) => {
  try {
    res.json({ stats: req.user.stats });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/user/stats ──
// Update stats after a game. Accepts partial stat updates.
router.post('/stats', async (req, res) => {
  try {
    const { gameType, result, score } = req.body;
    const user = req.user;

    if (!gameType || !result) {
      return res.status(400).json({ error: 'gameType and result are required.' });
    }

    // Always increment gamesPlayed
    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;

    if (result === 'win') {
      user.stats.wins = (user.stats.wins || 0) + 1;
    } else if (result === 'loss') {
      user.stats.losses = (user.stats.losses || 0) + 1;
    }

    if (gameType === 'lee5a') {
      user.stats.lee5aGamesPlayed = (user.stats.lee5aGamesPlayed || 0) + 1;
      if (result === 'win') {
        user.stats.lee5aWins = (user.stats.lee5aWins || 0) + 1;
      }
      // Track high score (lowest is best in lee5a, but 0 means not set)
      if (score !== undefined && typeof score === 'number') {
        if (user.stats.lee5aHighScore === 0 || score < user.stats.lee5aHighScore) {
          user.stats.lee5aHighScore = score;
        }
      }
    } else if (gameType === 'tarneeb') {
      user.stats.tarneebGamesPlayed = (user.stats.tarneebGamesPlayed || 0) + 1;
      if (result === 'win') {
        user.stats.tarneebWins = (user.stats.tarneebWins || 0) + 1;
      }
      // Update ELO-like rating
      if (typeof score === 'number') {
        // score here is the rating change (positive or negative)
        user.stats.tarneebRating = Math.max(0, (user.stats.tarneebRating || 1000) + score);
      } else {
        // Simple rating adjustment if no explicit score given
        if (result === 'win') {
          user.stats.tarneebRating = (user.stats.tarneebRating || 1000) + 25;
        } else if (result === 'loss') {
          user.stats.tarneebRating = Math.max(0, (user.stats.tarneebRating || 1000) - 20);
        }
      }
    }

    user.markModified('stats');
    await user.save();

    res.json({ message: 'Stats updated.', stats: user.stats });
  } catch (err) {
    console.error('Update stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/user/leaderboard ──
// Top 50 players by total wins
router.get('/leaderboard', async (req, res) => {
  try {
    const players = await User.find({ isVerified: true })
      .sort({ 'stats.wins': -1 })
      .limit(50)
      .select('username avatar stats.gamesPlayed stats.wins stats.losses');

    const leaderboard = players.map((p, index) => ({
      rank: index + 1,
      username: p.username,
      avatar: p.avatar,
      gamesPlayed: p.stats.gamesPlayed,
      wins: p.stats.wins,
      losses: p.stats.losses,
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/user/leaderboard/lee5a ──
// Top 50 by lee5a wins
router.get('/leaderboard/lee5a', async (req, res) => {
  try {
    const players = await User.find({ isVerified: true, 'stats.lee5aGamesPlayed': { $gt: 0 } })
      .sort({ 'stats.lee5aWins': -1 })
      .limit(50)
      .select('username avatar stats.lee5aGamesPlayed stats.lee5aWins stats.lee5aHighScore');

    const leaderboard = players.map((p, index) => ({
      rank: index + 1,
      username: p.username,
      avatar: p.avatar,
      lee5aGamesPlayed: p.stats.lee5aGamesPlayed,
      lee5aWins: p.stats.lee5aWins,
      lee5aHighScore: p.stats.lee5aHighScore,
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('Lee5a leaderboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/user/leaderboard/tarneeb ──
// Top 50 by tarneeb rating
router.get('/leaderboard/tarneeb', async (req, res) => {
  try {
    const players = await User.find({ isVerified: true, 'stats.tarneebGamesPlayed': { $gt: 0 } })
      .sort({ 'stats.tarneebRating': -1 })
      .limit(50)
      .select('username avatar stats.tarneebGamesPlayed stats.tarneebWins stats.tarneebRating');

    const leaderboard = players.map((p, index) => ({
      rank: index + 1,
      username: p.username,
      avatar: p.avatar,
      tarneebGamesPlayed: p.stats.tarneebGamesPlayed,
      tarneebWins: p.stats.tarneebWins,
      tarneebRating: p.stats.tarneebRating,
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('Tarneeb leaderboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
