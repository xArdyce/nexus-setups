import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const allowedStatuses = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "COMPLETED",
] as const;

const allowedPriorities = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const;

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

async function getContent(contentId: string) {
  return prisma.contentItem.findUnique({
    where: {
      id: contentId,
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
  });
}

async function getContentPermission(
  user: NonNullable<
    Awaited<ReturnType<typeof getAuthenticatedUser>>
  >,
  content: NonNullable<
    Awaited<ReturnType<typeof getContent>>
  >
) {
  if (
    user.accountType === "CREATOR" &&
    user.creatorProfile?.id === content.project.creatorId
  ) {
    return {
      canView: true,
      canManageTasks: false,
      role: "CREATOR" as const,
    };
  }

  const membership = user.memberships.find(
    (member) =>
      member.organizationId ===
      content.project.organizationId
  );

  if (!membership) {
    return {
      canView: false,
      canManageTasks: false,
      role: null,
    };
  }

  if (
    membership.role === "ADMIN" ||
    membership.role === "MANAGER"
  ) {
    return {
      canView: true,
      canManageTasks: true,
      role: membership.role,
    };
  }

  if (membership.role !== "EDITOR") {
    return {
      canView: false,
      canManageTasks: false,
      role: membership.role,
    };
  }

  const accessibleContent =
    await prisma.contentItem.findFirst({
      where: {
        id: content.id,
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
      },
    });

  return {
    canView: Boolean(accessibleContent),
    canManageTasks: Boolean(accessibleContent),
    role: membership.role,
  };
}

async function editorCanAccessContent(
  editorUserId: string,
  organizationId: string,
  contentId: string
) {
  const membership =
    await prisma.organizationMember.findFirst({
      where: {
        userId: editorUserId,
        organizationId,
        role: "EDITOR",
      },
      select: {
        id: true,
      },
    });

  if (!membership) {
    return false;
  }

  const accessibleContent =
    await prisma.contentItem.findFirst({
      where: {
        id: contentId,
        OR: [
          {
            editorAssignments: {
              some: {
                userId: editorUserId,
              },
            },
          },
          {
            project: {
              creator: {
                editorAssignments: {
                  some: {
                    userId: editorUserId,
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

  return Boolean(accessibleContent);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    const content = await getContent(contentId);

    if (!content) {
      return NextResponse.json(
        { error: "Content item not found" },
        { status: 404 }
      );
    }

    const permission = await getContentPermission(
      user,
      content
    );

    if (!permission.canView) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const tasks = await prisma.task.findMany({
      where: {
        contentId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            accountType: true,
          },
        },
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          priority: "desc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("GET /api/tasks error:", error);

    return NextResponse.json(
      { error: "Failed to load tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      contentId,
      assignedToId,
    } = body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    if (
      typeof contentId !== "string" ||
      !contentId.trim()
    ) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid task status" },
        { status: 400 }
      );
    }

    if (
      priority &&
      !allowedPriorities.includes(priority)
    ) {
      return NextResponse.json(
        { error: "Invalid task priority" },
        { status: 400 }
      );
    }

    const content = await getContent(contentId);

    if (!content) {
      return NextResponse.json(
        { error: "Content item not found" },
        { status: 404 }
      );
    }

    const permission = await getContentPermission(
      user,
      content
    );

    if (!permission.canManageTasks) {
      return NextResponse.json(
        {
          error:
            permission.role === "CREATOR"
              ? "Creators cannot create production tasks"
              : "You do not have access to manage tasks for this content",
        },
        { status: 403 }
      );
    }

    if (assignedToId) {
      if (typeof assignedToId !== "string") {
        return NextResponse.json(
          { error: "Invalid assignedToId" },
          { status: 400 }
        );
      }

      const canAccess =
        await editorCanAccessContent(
          assignedToId,
          content.project.organizationId,
          content.id
        );

      if (!canAccess) {
        return NextResponse.json(
          {
            error:
              "Tasks can only be assigned to an Editor who already has access to this project or Creator",
          },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description:
          typeof description === "string" &&
          description.trim()
            ? description.trim()
            : null,
        status: status || "TODO",
        priority: priority || "MEDIUM",
        dueDate: dueDate
          ? new Date(dueDate)
          : null,
        contentId,
        assignedToId:
          assignedToId || null,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            accountType: true,
          },
        },
      },
    });

    return NextResponse.json(task, {
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/tasks error:", error);

    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
