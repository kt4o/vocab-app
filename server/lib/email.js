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
  const pass = normalizeSmtpPassword(String(process.env.SMTP_PASS || "").trim(), host);
  const secure = toBoolean(process.env.SMTP_SECURE, port === 465);
  const from = String(process.env.EMAIL_FROM || user).trim();
  return { host, port, user, pass, secure, from };
}

function normalizeSmtpPassword(rawPassword, host) {
  const pass = String(rawPassword || "");
  const normalizedHost = String(host || "").trim().toLowerCase();
  const compact = pass.replace(/\s+/g, "");

  // Gmail app passwords are commonly displayed as 4 groups with spaces.
  if (
    normalizedHost.includes("gmail.com") &&
    pass.includes(" ") &&
    compact.length === 16 &&
    /^[a-z0-9]+$/i.test(compact)
  ) {
    return compact;
  }

  return pass;
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

function getResendApiKey() {
  return String(process.env.RESEND_API_KEY || "").trim();
}

async function sendWithResendApi({ email, subject, text, html }) {
  const apiKey = getResendApiKey();
  const { from } = getEmailConfig();
  if (!apiKey) {
    const error = new Error("Resend API key is not configured.");
    error.code = "RESEND_API_NOT_CONFIGURED";
    throw error;
  }
  if (!from) {
    const error = new Error("EMAIL_FROM is required.");
    error.code = "EMAIL_TRANSPORT_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const error = new Error(`Resend API request failed with status ${response.status}. ${bodyText}`);
    error.code = "RESEND_API_REQUEST_FAILED";
    throw error;
  }
}

async function sendEmail({ email, subject, text, html }) {
  // Prefer Resend HTTPS API in production (port 443), fallback to SMTP.
  if (getResendApiKey()) {
    await sendWithResendApi({ email, subject, text, html });
    return;
  }

  const transporter = ensureTransporter();
  const config = getEmailConfig();
  await transporter.sendMail({
    from: config.from,
    to: email,
    subject,
    text,
    html,
  });
}

export async function sendVerificationCodeEmail(email, code) {
  await sendEmail({
    email,
    subject: "Your Vocalibry verification code",
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
  });
}

export async function sendPasswordResetCodeEmail(email, code) {
  await sendEmail({
    email,
    subject: "Your Vocalibry password reset code",
    text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<p>Your password reset code is: <strong>${code}</strong></p><p>This code expires in 10 minutes.</p>`,
  });
}
