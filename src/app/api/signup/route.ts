import { logServerError } from "@/lib/server-log";
import { NextResponse } from "next/server";
import { allowAuthAttempt } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const NEXUS_ORGANIZATION_ID = "cmszb0pbt0000946x26bw7452";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    const accountType = body.accountType;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!email || email.length > 254) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters and at most 72 UTF-8 bytes." },
        { status: 400 }
      );
    }

    if (accountType !== "CREATOR" && accountType !== "EDITOR") {
      return NextResponse.json(
        { error: "Account type must be CREATOR or EDITOR." },
        { status: 400 }
      );
    }

    if (!(await allowAuthAttempt("signup", email, request))) {
      return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const nexusOrganization = await prisma.organization.findUnique({
      where: {
        id: NEXUS_ORGANIZATION_ID,
      },
      select: {
        id: true,
      },
    });

    if (!nexusOrganization) {
      logServerError(
        `Nexus organization ${NEXUS_ORGANIZATION_ID} was not found.`
      );

      return NextResponse.json(
        {
          error:
            "Nexus organization configuration could not be found.",
        },
        { status: 500 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          accountType,
        },
        select: {
          id: true,
          name: true,
          email: true,
          accountType: true,
          createdAt: true,
        },
      });

      await tx.organizationMember.create({
        data: {
          userId: newUser.id,
          organizationId: nexusOrganization.id,
          role: accountType === "CREATOR" ? "CREATOR" : "EDITOR",
        },
      });

      if (accountType === "CREATOR") {
        await tx.creator.create({
          data: {
            name,
            email,
            userId: newUser.id,
            organizationId: nexusOrganization.id,
          },
        });
      }

      return newUser;
    });

    return NextResponse.json(
      {
        message: "Account created successfully.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    logServerError("Signup error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while creating your account.",
      },
      { status: 500 }
    );
  }
}