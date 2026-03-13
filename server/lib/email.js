import nodemailer from "nodemailer";

let cachedTransporter = null;

function toBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function getEmailConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const secure = toBoolean(process.env.SMTP_SECURE, port === 465);
  const from = String(process.env.EMAIL_FROM || user).trim();
  return { host, port, user, pass, secure, from };
}

function ensureTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const config = getEmailConfig();
  if (!config.host || !config.port || !config.user || !config.pass || !config.from) {
    const error = new Error("Email delivery is not configured.");
    error.code = "EMAIL_TRANSPORT_NOT_CONFIGURED";
    throw error;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}

export async function sendVerificationCodeEmail(email, code) {
  const transporter = ensureTransporter();
  const config = getEmailConfig();
  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Your Vocalibry verification code",
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
  });
}

export async function sendPasswordResetCodeEmail(email, code) {
  const transporter = ensureTransporter();
  const config = getEmailConfig();
  await transporter.sendMail({
    from: config.from,
    to: email,
    subject: "Your Vocalibry password reset code",
    text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
  });
}
