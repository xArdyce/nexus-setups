import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { allowAuthAttempt } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { logServerError } from "@/lib/server-log";

const genericMessage = "If that account exists, a password reset link has been requested.";
const genericResponse = () => NextResponse.json({ message: genericMessage });

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  let stage = "rate_limit";
  try {
    // Same response for throttled, unknown, failed-delivery and known accounts.
    if (!(await allowAuthAttempt("reset-request", email, request))) {
      console.log("Password reset request", { stage, allowed: false });
      return genericResponse();
    }
    stage = "user_lookup";
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    console.log("Password reset request", { stage, userFound: Boolean(user) });
    if (!user) return genericResponse();

    stage = "reset_url";
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const origin = new URL(process.env.AUTH_URL || process.env.NEXTAUTH_URL || request.url);
    if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
      throw new Error("Password reset requires an HTTPS origin.");
    }
    const resetUrl = new URL("/", origin.origin);
    resetUrl.searchParams.set("resetToken", rawToken);

    stage = "token_persistence";
    await prisma.$transaction(async tx => {
      // Serialize issuance and consumption for this user, including different tokens.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({ data: {
        userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } });
    });

    stage = "email_delivery";
    try { await sendPasswordResetEmail(user.email, resetUrl.toString()); }
    catch (error) { logServerError("Password reset email delivery failed", error); }

    return NextResponse.json({
      message: genericMessage,
      ...(process.env.NODE_ENV === "development" ? { debugResetUrl: resetUrl.toString() } : {}),
    });
  } catch (error) {
    console.log("Password reset request", { stage, failed: true });
    logServerError("Password reset request failed", error);
    return genericResponse();
  }
}
