import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUser() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

// GET /api/organizations
export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: user.id,
    },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              members: true,
              creators: true,
              projects: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return NextResponse.json({
    organizations: memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      role: membership.role,
      createdAt: membership.organization.createdAt,
      counts: membership.organization._count,
    })),
  });
}

// POST /api/organizations
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    name?: unknown;
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

  if (!name) {
    return NextResponse.json(
      { error: "Organization name is required" },
      { status: 400 }
    );
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: "Organization name must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  const organization = await prisma.organization.create({
    data: {
      name,
      members: {
        create: {
          userId: user.id,
          role: "ADMIN",
        },
      },
      projects: {
        create: {
          name: "General Content",
          createdById: user.id,
        },
      },
    },
    include: {
      _count: {
        select: {
          members: true,
          creators: true,
          projects: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      organization: {
        id: organization.id,
        name: organization.name,
        role: "ADMIN",
        createdAt: organization.createdAt,
        counts: organization._count,
      },
    },
    { status: 201 }
  );
}
