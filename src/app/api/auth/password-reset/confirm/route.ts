import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { allowAuthAttempt } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-log";

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token =
      typeof body.token === "string" ? body.token.trim() : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json(
        { error: "Reset token is required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (!(await allowAuthAttempt("reset-confirm", token, request))) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const consumed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${resetToken.userId} FOR UPDATE`;
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword, sessionVersion: { increment: 1 } },
      });
      await tx.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, id: { not: resetToken.id }, usedAt: null },
      });
      return true;
    });
    if (!consumed) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    logServerError("Password reset confirmation failed", error);
    return NextResponse.json({ error: "Could not update the password." }, { status: 500 });
  }
}
