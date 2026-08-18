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

async function getOrCreateDefaultProject(
  userId: string,
  userLabel: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          projects: true,
        },
      },
    },
  });

  if (membership) {
    const org = membership.organization;

    const existing =
      org.projects.find((project) => project.name === "General Content") ??
      org.projects[0];

    if (existing) {
      return existing;
    }

    return prisma.project.create({
      data: {
        name: "General Content",
        organizationId: org.id,
        createdById: userId,
      },
    });
  }

  const org = await prisma.organization.create({
    data: {
      name: `${userLabel} Studio`,
      members: {
        create: {
          userId,
          role: "ADMIN",
        },
      },
      projects: {
        create: {
          name: "General Content",
          createdById: userId,
        },
      },
    },
    include: {
      projects: true,
    },
  });

  return org.projects[0];
}

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

// GET /api/projects
export async function GET() {
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
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: user.id,
    },
    select: {
      organizationId: true,
    },
  });

  const organizationIds = memberships.map(
    (membership) => membership.organizationId
  );

  if (organizationIds.length === 0) {
    return NextResponse.json({
      projects: [],
    });
  }

  const contentItems = await prisma.contentItem.findMany({
    where: {
      project: {
        organizationId: {
          in: organizationIds,
        },
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
  });
}

// POST /api/projects
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: {
    title?: unknown;
    type?: unknown;
    footageLink?: unknown;
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

  if (!title || !type || !footageLink) {
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

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const project = await getOrCreateDefaultProject(
    user.id,
    user.name || user.email
  );

  const contentItem = await prisma.contentItem.create({
    data: {
      title,
      contentType: type,
      status: "REQUESTED",
      projectId: project.id,
    },
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