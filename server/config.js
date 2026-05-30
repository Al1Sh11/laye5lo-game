module.exports = {
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://laye5lo:laye5lo2024@cluster0.mongodb.net/laye5lo?retryWrites=true&w=majority',
  jwtSecret: process.env.JWT_SECRET || 'laye5lo-super-secret-jwt-key-2024',
  jwtExpiry: '30d',
  email: {
    service: 'gmail',
    user: process.env.EMAIL_USER || 'laye5lo.game@gmail.com',
    pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS || 'your-app-password-here',
  },
  codeExpiry: 10 * 60 * 1000, // 10 minutes
};
