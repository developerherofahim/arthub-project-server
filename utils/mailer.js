const nodemailer = require("nodemailer");

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log("[Mailer] Using custom SMTP configuration");
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("[Mailer] Ethereal live SMTP account: " + testAccount.user);
    } catch (err) {
      console.error("[Mailer] Fallback to JSON transport:", err.message);
      transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: '"ArtHub Marketplace" <notifications@arthub.market>',
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ""),
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("[Email Sent] MessageId: " + info.messageId + " | Recipient: " + to);
    if (previewUrl) {
      console.log("[Live Web Preview URL]: " + previewUrl);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error("[Mailer Error] Failed to send email:", error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
