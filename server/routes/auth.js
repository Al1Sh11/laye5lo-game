const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { generateCode, sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Helper: generate JWT
function signToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

// ── POST /api/auth/register ──
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters.' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check existing
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Create user
    const code = generateCode();
    const user = new User({
      username,
      email: email.toLowerCase(),
      password,
      verificationCode: code,
      verificationCodeExpiry: new Date(Date.now() + config.codeExpiry),
    });
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user.email, code);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
    }

    // Return token + profile
    const token = signToken(user._id);
    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/verify ──
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified.' });
    }
    if (!user.verificationCode || user.verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    if (user.verificationCodeExpiry && user.verificationCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification code expired. Request a new one.' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully.', user: user.toPublicJSON() });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/resend-code ──
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ error: 'Email already verified.' });
    }

    const code = generateCode();
    user.verificationCode = code;
    user.verificationCodeExpiry = new Date(Date.now() + config.codeExpiry);
    await user.save();

    try {
      await sendVerificationEmail(user.email, code);
    } catch (emailErr) {
      console.error('Failed to resend verification email:', emailErr.message);
      return res.status(500).json({ error: 'Failed to send email. Try again later.' });
    }

    res.json({ message: 'Verification code sent.' });
  } catch (err) {
    console.error('Resend code error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id);
    res.json({
      message: 'Login successful.',
      token,
      user: user.toPublicJSON(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/forgot-password ──
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If an account exists with that email, a reset code has been sent.' });
    }

    const code = generateCode();
    user.resetCode = code;
    user.resetCodeExpiry = new Date(Date.now() + config.codeExpiry);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, code);
    } catch (emailErr) {
      console.error('Failed to send reset email:', emailErr.message);
      return res.status(500).json({ error: 'Failed to send email. Try again later.' });
    }

    res.json({ message: 'If an account exists with that email, a reset code has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/reset-password ──
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!user.resetCode || user.resetCode !== code) {
      return res.status(400).json({ error: 'Invalid reset code.' });
    }
    if (user.resetCodeExpiry && user.resetCodeExpiry < new Date()) {
      return res.status(400).json({ error: 'Reset code expired. Request a new one.' });
    }

    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/change-password (authed) ──
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = req.user;
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
