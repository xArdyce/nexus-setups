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
      accountType: true,
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

  /*
   * Editors should not automatically inherit every workspace
   * just because they are an OrganizationMember.
   *
   * ADMIN / MANAGER:
   *   Can see the organization normally.
   *
   * EDITOR:
   *   Can see an organization when they have either:
   *   - a CreatorAssignment in that organization, or
   *   - a ContentAssignment under a creator/project there.
   *
   * CREATOR:
   *   Keeps normal membership visibility.
   */
  /*
   * AccountType EDITOR is shared by ADMIN, MANAGER and EDITOR
   * accounts. Assignment-scoped queries must therefore be based
   * on OrganizationMember.role, not accountType.
   */
  const editorOrganizationIds = memberships
    .filter((membership) => membership.role === "EDITOR")
    .map((membership) => membership.organizationId);

  const [editorAccessibleContent, editorCreatorAssignments] =
    editorOrganizationIds.length > 0
      ? await Promise.all([
          prisma.contentItem.findMany({
            where: {
              project: {
                organizationId: {
                  in: editorOrganizationIds,
                },
              },

              OR: [
                {
                  editorAssignments: {
                    some: {
                      userId: user.id,
                    },
                  },
                },
                {
                  project: {
                    creator: {
                      editorAssignments: {
                        some: {
                          userId: user.id,
                        },
                      },
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              project: {
                select: {
                  organizationId: true,
                  creatorId: true,
                },
              },
            },
          }),

          prisma.creatorAssignment.findMany({
            where: {
              userId: user.id,
              creator: {
                organizationId: {
                  in: editorOrganizationIds,
                },
              },
            },
            select: {
              creator: {
                select: {
                  id: true,
                  organizationId: true,
                },
              },
            },
          }),
        ])
      : [[], []];

  const assignedOrganizationIds = new Set([
    ...editorAccessibleContent.map(
      (content) => content.project.organizationId
    ),
    ...editorCreatorAssignments.map(
      (assignment) =>
        assignment.creator.organizationId
    ),
  ]);

  const visibleMemberships = memberships.filter((membership) => {
    if (
      membership.role === "ADMIN" ||
      membership.role === "MANAGER"
    ) {
      return true;
    }

    if (membership.role === "EDITOR") {
      return assignedOrganizationIds.has(
        membership.organizationId
      );
    }

    return true;
  });

  return NextResponse.json({
    organizations: visibleMemberships.map((membership) => {
      if (membership.role !== "EDITOR") {
        return {
          id: membership.organization.id,
          name: membership.organization.name,
          role: membership.role,
          createdAt: membership.organization.createdAt,
          counts: membership.organization._count,
        };
      }

      const accessibleContentInOrganization =
        editorAccessibleContent.filter(
          (content) =>
            content.project.organizationId ===
            membership.organizationId
        );

      const creatorIds = new Set([
        ...accessibleContentInOrganization
          .map((content) => content.project.creatorId)
          .filter((creatorId): creatorId is string =>
            Boolean(creatorId)
          ),

        ...editorCreatorAssignments
          .filter(
            (assignment) =>
              assignment.creator.organizationId ===
              membership.organizationId
          )
          .map((assignment) => assignment.creator.id),
      ]);

      return {
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
        createdAt: membership.organization.createdAt,
        counts: {
          members: 1,
          creators: creatorIds.size,
          projects: accessibleContentInOrganization.length,
        },
      };
    }),
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
