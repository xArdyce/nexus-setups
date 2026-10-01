import nodemailer from "nodemailer";

function required(name: string) {
  const value = process.env[name];
  if (!value?.trim()) throw Object.assign(new Error("SMTP configuration is incomplete."), { code: "SMTP_CONFIG_MISSING" });
  return value;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  // Local development needs no provider; its existing debug link is sufficient.
  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_HOST) {
    console.log("Password reset email", { stage: "development_skip", deliveryAttempted: false });
    return;
  }
  const fields = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  console.log("Password reset email", {
    stage: "smtp_configuration",
    smtpConfigured: fields.every(name => Boolean(process.env[name]?.trim())),
    deliveryAttempted: false,
  });
  const secureValue = required("SMTP_SECURE");
  const port = Number(required("SMTP_PORT"));
  if (!["true", "false"].includes(secureValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error("SMTP configuration is invalid."), { code: "SMTP_CONFIG_INVALID" });
  }
  const from = required("SMTP_FROM");
  const transport = nodemailer.createTransport({
    host: required("SMTP_HOST"), port, secure: secureValue === "true",
    requireTLS: secureValue !== "true",
    auth: { user: required("SMTP_USER"), pass: required("SMTP_PASS") },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    dnsTimeout: 10_000, logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    console.log("Password reset email", { stage: "smtp_send", deliveryAttempted: true });
    await transport.sendMail({
      from, to: { address: to, name: "" },
      subject: "Reset your Nexus Setups password",
      text: `Reset your Nexus Setups password using this link:\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Use the link below to reset your Nexus Setups password.</p><p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#7544fc;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, you can ignore this email.</p>`,
    });
    // SMTP acceptance is not a guarantee of inbox delivery.
    console.log("Password reset email", { stage: "smtp_accepted", deliverySucceeded: true });
  } finally {
    transport.close();
  }
}
