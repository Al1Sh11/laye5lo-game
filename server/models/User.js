const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  verificationCodeExpiry: { type: Date },
  resetCode: { type: String },
  resetCodeExpiry: { type: Date },
  avatar: { type: String, default: 'default' }, // avatar id or url
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    lee5aHighScore: { type: Number, default: 0 }, // lowest score achieved (best)
    lee5aGamesPlayed: { type: Number, default: 0 },
    lee5aWins: { type: Number, default: 0 },
    tarneebGamesPlayed: { type: Number, default: 0 },
    tarneebWins: { type: Number, default: 0 },
    tarneebRating: { type: Number, default: 1000 }, // ELO-like
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Public profile (no password)
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    avatar: this.avatar,
    stats: this.stats,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

module.exports = mongoose.model('User', userSchema);
