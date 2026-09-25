import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const RESET_TOKEN_TTL_MINUTES = 30;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    const genericMessage =
      "If that account exists, a password reset link has been created.";

    if (!user) {
      return NextResponse.json(
        { message: genericMessage },
        { status: 200 }
      );
    }

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000
    );

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const origin = new URL(request.url).origin;
    const resetUrl =
      `${origin}/?resetToken=${encodeURIComponent(rawToken)}`;

    console.log(
      `[Nexus password reset] ${user.email}: ${resetUrl}`
    );

    return NextResponse.json(
      {
        message: genericMessage,
        ...(process.env.NODE_ENV !== "production"
          ? { debugResetUrl: resetUrl }
          : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Password reset request error:", error);

    return NextResponse.json(
      { error: "Could not create a password reset request." },
      { status: 500 }
    );
  }
}
