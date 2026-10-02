import { logServerError } from "@/lib/server-log";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
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

  if (user.memberships.some((member) => member.role === "CREATOR" && member.organizationId === user.creatorProfile?.organizationId)) {
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

  const memberships = user.memberships;

  if (memberships.length === 0) {
    return NextResponse.json({
      creators: [],
    });
  }

  const targetMembership = organizationId
    ? memberships.find(
        (membership) =>
          membership.organizationId === organizationId
      )
    : memberships[0];

  if (!targetMembership) {
    return NextResponse.json(
      {
        error: "You do not have access to this organization.",
      },
      { status: 403 }
    );
  }

  const targetOrganizationId =
    targetMembership.organizationId;

  if (
    targetMembership.role !== "ADMIN" &&
    targetMembership.role !== "MANAGER" &&
    targetMembership.role !== "EDITOR"
  ) {
    return NextResponse.json({
      creators: [],
      organizationId: targetOrganizationId,
    });
  }

  const creators = await prisma.creator.findMany({
    where: {
      organizationId: targetOrganizationId,

      ...(targetMembership.role === "EDITOR"
        ? {
            OR: [
              {
                editorAssignments: {
                  some: {
                    userId: user.id,
                  },
                },
              },
              {
                projects: {
                  some: {
                    contentItems: {
                      some: {
                        editorAssignments: {
                          some: {
                            userId: user.id,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
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

  } catch (error) {
    logServerError("API request failed", error);
    return NextResponse.json({ error: "Unable to complete this request." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
        error: "name and organizationId are required",
      },
      { status: 400 }
    );
  }

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

  if (
    membership.role !== "ADMIN" &&
    membership.role !== "MANAGER"
  ) {
    return NextResponse.json(
      {
        error:
          "Only admins and managers can create creator profiles.",
      },
      { status: 403 }
    );
  }

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

  if (userId) {
    const linkedMembership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId, role: "CREATOR" }, select: { id: true },
    });
    if (!linkedMembership) return NextResponse.json({ error: "The linked Creator must belong to this organization." }, { status: 400 });
  }
  const { creator, project } = await prisma.$transaction(async (tx) => {
    const creator = await tx.creator.create({
      data: {
        name,
        email: email || null,
        organizationId,
        userId,
      },
    });

    const project = await tx.project.create({
      data: {
        name: "General Content",
        organizationId,
        creatorId: creator.id,
        createdById: user.id,
      },
    });

    return { creator, project };
  });

  return NextResponse.json(
    {
      creator,
      project,
    },
    { status: 201 }
  );

  } catch (error) {
    logServerError("POST /api/creators failed", error);
    return NextResponse.json({ error: "Unable to complete this request." }, { status: 500 });
  }
}
