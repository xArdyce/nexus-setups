import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/creators
//
// Editors/Admins/Managers:
//   Returns all creators in the selected organization.
//
// Creators:
//   Returns only their own creator profile.
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      accountType: true,
      creatorProfile: {
        select: {
          id: true,
          name: true,
          email: true,
          organizationId: true,
          userId: true,
          createdAt: true,
        },
      },
      memberships: {
        select: {
          organizationId: true,
          role: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  /*
   * CREATOR
   *
   * A creator can only retrieve their own Creator record.
   */
  if (user.accountType === "CREATOR") {
    if (!user.creatorProfile) {
      return NextResponse.json(
        {
          error:
            "Your creator account is not linked to a creator profile yet.",
        },
        { status: 403 }
      );
    }

    const creator = user.creatorProfile;

    if (
      organizationId &&
      organizationId !== creator.organizationId
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this organization.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      creators: [creator],
      organizationId: creator.organizationId,
    });
  }

  /*
   * EDITOR / ADMIN / MANAGER
   *
   * These users can view all creators belonging to an
   * organization they are members of.
   */
  const memberships = user.memberships;

  if (memberships.length === 0) {
    return NextResponse.json({
      creators: [],
    });
  }

  const organizationIds = memberships.map(
    (membership) => membership.organizationId
  );

  const targetOrganizationId =
    organizationId &&
    organizationIds.includes(organizationId)
      ? organizationId
      : organizationIds[0];

  const creators = await prisma.creator.findMany({
    where: {
      organizationId: targetOrganizationId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      organizationId: true,
      userId: true,
      createdAt: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return NextResponse.json({
    creators,
    organizationId: targetOrganizationId,
  });
}

// POST /api/creators
//
// Creates a Creator profile and, when supplied, links it to a
// Creator account.
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      accountType: true,
      memberships: {
        select: {
          organizationId: true,
          role: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  /*
   * Only internal/editor-side accounts can create Creator
   * profiles.
   */
  if (user.accountType !== "EDITOR") {
    return NextResponse.json(
      {
        error:
          "Only editor accounts can create creator profiles.",
      },
      { status: 403 }
    );
  }

  let body: {
    name?: unknown;
    email?: unknown;
    organizationId?: unknown;
    userId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const organizationId = String(
    body.organizationId || ""
  ).trim();
  const userId = body.userId
    ? String(body.userId).trim()
    : null;

  if (!name || !organizationId) {
    return NextResponse.json(
      {
        error:
          "name and organizationId are required",
      },
      { status: 400 }
    );
  }

  /*
   * Verify the editor belongs to the organization.
   */
  const membership = user.memberships.find(
    (membership) =>
      membership.organizationId === organizationId
  );

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "You do not have access to this organization.",
      },
      { status: 403 }
    );
  }

  /*
   * If a User ID was supplied, verify that the account is
   * actually a CREATOR account.
   */
  if (userId) {
    const creatorUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        accountType: true,
      },
    });

    if (!creatorUser) {
      return NextResponse.json(
        {
          error: "Creator user not found.",
        },
        { status: 404 }
      );
    }

    if (creatorUser.accountType !== "CREATOR") {
      return NextResponse.json(
        {
          error:
            "The selected user is not a Creator account.",
        },
        { status: 400 }
      );
    }

    const existingProfile =
      await prisma.creator.findUnique({
        where: {
          userId,
        },
      });

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            "This Creator account is already linked to a creator profile.",
        },
        { status: 409 }
      );
    }
  }

  const creator = await prisma.creator.create({
    data: {
      name,
      email: email || null,
      organizationId,
      userId,
    },
  });

  /*
   * Create the Creator's workspace/project immediately.
   *
   * This gives every Creator a dedicated project that can
   * later be used to scope their content.
   */
  const project = await prisma.project.create({
    data: {
      name: "General Content",
      organizationId,
      creatorId: creator.id,
      createdById: user.id,
    },
  });

  return NextResponse.json(
    {
      creator,
      project,
    },
    { status: 201 }
  );
}