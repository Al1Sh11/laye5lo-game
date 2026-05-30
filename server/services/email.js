const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  service: config.email.service,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: `"Laye5lo Game" <${config.email.user}>`,
    to: email,
    subject: 'Laye5lo - Verify Your Email',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:30px;background:linear-gradient(135deg,#1a6b3a,#0a3019);border-radius:16px;color:#fff">
        <h1 style="text-align:center;color:#ffe066;font-size:32px;margin-bottom:8px">Laye5lo</h1>
        <p style="text-align:center;color:rgba(255,255,255,0.8);font-size:14px;margin-bottom:24px">Lebanese Card Games</p>
        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:24px;text-align:center">
          <p style="color:rgba(255,255,255,0.9);font-size:15px;margin-bottom:16px">Your verification code is:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#ffe066;padding:16px;background:rgba(0,0,0,0.3);border-radius:8px;display:inline-block">${code}</div>
          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:16px">This code expires in 10 minutes.</p>
        </div>
        <p style="text-align:center;color:rgba(255,255,255,0.5);font-size:11px;margin-top:20px">If you didn't create a Laye5lo account, ignore this email.</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
}

async function sendPasswordResetEmail(email, code) {
  const mailOptions = {
    from: `"Laye5lo Game" <${config.email.user}>`,
    to: email,
    subject: 'Laye5lo - Password Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:30px;background:linear-gradient(135deg,#1a6b3a,#0a3019);border-radius:16px;color:#fff">
        <h1 style="text-align:center;color:#ffe066;font-size:32px;margin-bottom:8px">Laye5lo</h1>
        <p style="text-align:center;color:rgba(255,255,255,0.8);font-size:14px;margin-bottom:24px">Password Reset</p>
        <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:24px;text-align:center">
          <p style="color:rgba(255,255,255,0.9);font-size:15px;margin-bottom:16px">Your reset code is:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#ffe066;padding:16px;background:rgba(0,0,0,0.3);border-radius:8px;display:inline-block">${code}</div>
          <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:16px">This code expires in 10 minutes.</p>
        </div>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { generateCode, sendVerificationEmail, sendPasswordResetEmail };
