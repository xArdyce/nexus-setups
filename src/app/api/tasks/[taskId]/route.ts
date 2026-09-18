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

async function getTask(taskId: string) {
  return prisma.task.findUnique({
    where: {
      id: taskId,
    },
    select: {
      id: true,
      contentId: true,
      content: {
        select: {
          id: true,
          project: {
            select: {
              organizationId: true,
              creatorId: true,
            },
          },
        },
      },
    },
  });
}

async function getContentPermission(
  user: NonNullable<
    Awaited<ReturnType<typeof getAuthenticatedUser>>
  >,
  task: NonNullable<
    Awaited<ReturnType<typeof getTask>>
  >
) {
  if (
    user.accountType === "CREATOR" &&
    user.creatorProfile?.id ===
      task.content.project.creatorId
  ) {
    return {
      canView: true,
      canManageTasks: false,
      canDeleteTasks: false,
      role: "CREATOR" as const,
    };
  }

  const membership = user.memberships.find(
    (member) =>
      member.organizationId ===
      task.content.project.organizationId
  );

  if (!membership) {
    return {
      canView: false,
      canManageTasks: false,
      canDeleteTasks: false,
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
      canDeleteTasks: true,
      role: membership.role,
    };
  }

  if (membership.role !== "EDITOR") {
    return {
      canView: false,
      canManageTasks: false,
      canDeleteTasks: false,
      role: membership.role,
    };
  }

  const accessibleContent =
    await prisma.contentItem.findFirst({
      where: {
        id: task.content.id,
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

  const hasAccess = Boolean(accessibleContent);

  return {
    canView: hasAccess,
    canManageTasks: hasAccess,
    canDeleteTasks: false,
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

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ taskId: string }>;
  }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId } = await context.params;
    const body = await request.json();

    const task = await getTask(taskId);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const permission = await getContentPermission(
      user,
      task
    );

    if (!permission.canManageTasks) {
      return NextResponse.json(
        {
          error:
            permission.role === "CREATOR"
              ? "Creators cannot modify production tasks"
              : "Forbidden",
        },
        { status: 403 }
      );
    }

    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignedToId,
    } = body;

    if (
      title !== undefined &&
      (
        typeof title !== "string" ||
        !title.trim()
      )
    ) {
      return NextResponse.json(
        { error: "Task title cannot be empty" },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid task status" },
        { status: 400 }
      );
    }

    if (
      priority !== undefined &&
      !allowedPriorities.includes(priority)
    ) {
      return NextResponse.json(
        { error: "Invalid task priority" },
        { status: 400 }
      );
    }

    if (
      assignedToId !== undefined &&
      assignedToId !== null
    ) {
      if (typeof assignedToId !== "string") {
        return NextResponse.json(
          { error: "Invalid assignedToId" },
          { status: 400 }
        );
      }

      const canAccess =
        await editorCanAccessContent(
          assignedToId,
          task.content.project.organizationId,
          task.content.id
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

    const updatedTask = await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        ...(title !== undefined && {
          title: title.trim(),
        }),
        ...(description !== undefined && {
          description:
            typeof description === "string" &&
            description.trim()
              ? description.trim()
              : null,
        }),
        ...(status !== undefined && {
          status,
        }),
        ...(priority !== undefined && {
          priority,
        }),
        ...(dueDate !== undefined && {
          dueDate: dueDate
            ? new Date(dueDate)
            : null,
        }),
        ...(assignedToId !== undefined && {
          assignedToId,
        }),
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

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error(
      "PATCH /api/tasks/[taskId] error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ taskId: string }>;
  }
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId } = await context.params;

    const task = await getTask(taskId);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const permission = await getContentPermission(
      user,
      task
    );

    if (!permission.canDeleteTasks) {
      return NextResponse.json(
        {
          error:
            "Only admins and managers can delete tasks",
        },
        { status: 403 }
      );
    }

    await prisma.task.delete({
      where: {
        id: taskId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/tasks/[taskId] error:",
      error
    );

    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
