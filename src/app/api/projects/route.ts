import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CONTENT_TYPES = [
  "Short-form",
  "YouTube Long-form",
  "Repurposed Cuts",
] as const;

const DB_TO_UI_STATUS: Record<string, string> = {
  REQUESTED: "queued",
  IN_PRODUCTION: "rendering",
  IN_REVIEW: "review",
  REVISION: "review",
  APPROVED: "completed",
  SCHEDULED: "completed",
  PUBLISHED: "completed",
};

const ETA_LABELS: Record<string, string> = {
  IN_PRODUCTION: "Rendering...",
  IN_REVIEW: "Awaiting review",
  REVISION: "Needs revision",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
};

function toDisplayItem(
  item: {
    id: string;
    title: string;
    contentType: string;
    status: string;
    createdAt: Date;
  },
  queuePositionById: Map<string, number>
) {
  const uiStatus = DB_TO_UI_STATUS[item.status] || "queued";

  const eta =
    item.status === "REQUESTED"
      ? `Queue #${queuePositionById.get(item.id) ?? 1}`
      : ETA_LABELS[item.status] || item.status;

  return {
    id: item.id,
    title: item.title,
    type: item.contentType,
    status: uiStatus,
    eta,
    createdAt: item.createdAt,
  };
}

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

      creatorProfile: {
        select: {
          id: true,
          organizationId: true,
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
}

// GET /api/projects
export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  const requestedOrganizationId =
    searchParams.get("organizationId");

  const requestedCreatorId =
    searchParams.get("creatorId");

  /*
   * ============================================================
   * CREATOR ACCESS
   * ============================================================
   *
   * Creators can ONLY see projects belonging to their own
   * Creator profile.
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

    /*
     * A creator cannot request another organization.
     */
    if (
      requestedOrganizationId &&
      requestedOrganizationId !== creator.organizationId
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this organization.",
        },
        { status: 403 }
      );
    }

    /*
     * A creator can ONLY request their own creator profile.
     */
    if (
      requestedCreatorId &&
      requestedCreatorId !== creator.id
    ) {
      return NextResponse.json(
        {
          error: "You do not have access to this creator.",
        },
        { status: 403 }
      );
    }

    /*
     * Always enforce the creator's real organization and
     * creator profile from the authenticated account.
     *
     * This prevents a creator from manipulating query
     * parameters to access another creator's projects.
     */
    const contentItems = await prisma.contentItem.findMany({
      where: {
        project: {
          organizationId: creator.organizationId,
          creatorId: creator.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const queuePositionById = new Map<string, number>();

    contentItems
      .filter((item) => item.status === "REQUESTED")
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
      )
      .forEach((item, index) => {
        queuePositionById.set(item.id, index + 1);
      });

    const projects = contentItems.map((item) =>
      toDisplayItem(item, queuePositionById)
    );

    return NextResponse.json({
      projects,
      organizationId: creator.organizationId,
      creatorId: creator.id,
    });
  }

  /*
   * ============================================================
   * EDITOR / ADMIN / MANAGER ACCESS
   * ============================================================
   *
   * Internal users can see all projects within organizations
   * they belong to.
   *
   * If creatorId is supplied, the results are restricted to
   * that creator within the selected organization.
   */
  const organizationIds = user.memberships.map(
    (membership) => membership.organizationId
  );

  if (organizationIds.length === 0) {
    return NextResponse.json({
      projects: [],
    });
  }

  /*
   * Determine the target organization BEFORE using it.
   */
  const targetOrganizationId =
    requestedOrganizationId &&
      organizationIds.includes(requestedOrganizationId)
      ? requestedOrganizationId
      : organizationIds[0];

  /*
   * If a creator was requested, verify that the creator
   * actually belongs to the selected organization.
   */
  if (requestedCreatorId) {
    const creator = await prisma.creator.findFirst({
      where: {
        id: requestedCreatorId,
        organizationId: targetOrganizationId,
      },
      select: {
        id: true,
      },
    });

    if (!creator) {
      return NextResponse.json(
        {
          error: "Creator not found in this organization.",
        },
        { status: 404 }
      );
    }
  }

  /*
   * Fetch content for the organization.
   *
   * When creatorId exists, only that creator's projects
   * are returned.
   */
  const contentItems = await prisma.contentItem.findMany({
    where: {
      project: {
        organizationId: targetOrganizationId,
        ...(requestedCreatorId
          ? {
            creatorId: requestedCreatorId,
          }
          : {}),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const queuePositionById = new Map<string, number>();

  contentItems
    .filter((item) => item.status === "REQUESTED")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime()
    )
    .forEach((item, index) => {
      queuePositionById.set(item.id, index + 1);
    });

  const projects = contentItems.map((item) =>
    toDisplayItem(item, queuePositionById)
  );

  return NextResponse.json({
    projects,
    organizationId: targetOrganizationId,
    ...(requestedCreatorId
      ? {
        creatorId: requestedCreatorId,
      }
      : {}),
  });
}

// POST /api/projects
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    title?: unknown;
    type?: unknown;
    footageLink?: unknown;
    organizationId?: unknown;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const title = String(body.title || "").trim();
  const type = String(body.type || "").trim();
  const footageLink = String(body.footageLink || "").trim();
  const organizationId = String(
    body.organizationId || ""
  ).trim();

  if (!title || !type || !footageLink || !organizationId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (!(CONTENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json(
      { error: "Invalid content type" },
      { status: 400 }
    );
  }

  if (
    !footageLink.startsWith("http://") &&
    !footageLink.startsWith("https://")
  ) {
    return NextResponse.json(
      { error: "footageLink must be a valid URL" },
      { status: 400 }
    );
  }

  /*
   * ============================================================
   * CREATOR SUBMISSION
   * ============================================================
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

    /*
     * The organization supplied by the browser MUST match
     * the creator's actual organization.
     */
    if (organizationId !== creator.organizationId) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this organization.",
        },
        { status: 403 }
      );
    }

    /*
     * Find a project specifically belonging to this creator.
     */
    let project = await prisma.project.findFirst({
      where: {
        organizationId: creator.organizationId,
        creatorId: creator.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    /*
     * If this creator does not have a project yet,
     * create their workspace automatically.
     */
    if (!project) {
      project = await prisma.project.create({
        data: {
          name: "General Content",
          organizationId: creator.organizationId,
          creatorId: creator.id,
          createdById: user.id,
        },
      });
    }

    const contentItem = await prisma.$transaction(async (tx) => {
      const created = await tx.contentItem.create({
        data: {
          title,
          contentType: type,
          status: "REQUESTED",
          projectId: project.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CONTENT_SUBMITTED",
          resource: "ContentItem",
          resourceId: created.id,
          userId: user.id,
          metadata: {
            title: created.title,
            contentType: created.contentType,
            status: created.status,
            organizationId: creator.organizationId,
            creatorId: creator.id,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        project: toDisplayItem(
          contentItem,
          new Map([[contentItem.id, 1]])
        ),
        creatorId: creator.id,
      },
      { status: 201 }
    );
  }

  /*
   * ============================================================
   * EDITOR / ADMIN / MANAGER SUBMISSION
   * ============================================================
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

  const project = await prisma.project.findFirst({
    where: {
      organizationId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!project) {
    return NextResponse.json(
      {
        error:
          "No project exists in this organization.",
      },
      { status: 400 }
    );
  }

  const contentItem = await prisma.$transaction(async (tx) => {
    const created = await tx.contentItem.create({
      data: {
        title,
        contentType: type,
        status: "REQUESTED",
        projectId: project.id,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CONTENT_SUBMITTED",
        resource: "ContentItem",
        resourceId: created.id,
        userId: user.id,
        metadata: {
          title: created.title,
          contentType: created.contentType,
          status: created.status,
          organizationId,
        },
      },
    });

    return created;
  });

  return NextResponse.json(
    {
      project: toDisplayItem(
        contentItem,
        new Map([[contentItem.id, 1]])
      ),
    },
    { status: 201 }
  );
}