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

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ taskId: string }>;
  }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId } = await context.params;
    const body = await request.json();

    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        content: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      include: {
        memberships: true,
        creatorProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const membership = user.memberships.find(
      (member) =>
        member.organizationId ===
        task.content.project.organizationId
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (membership.role === "CREATOR") {
      return NextResponse.json(
        {
          error:
            "Creators cannot modify production tasks",
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

    if (assignedToId !== undefined && assignedToId !== null) {
      const assignedUser = await prisma.user.findUnique({
        where: {
          id: assignedToId,
        },
        include: {
          memberships: true,
        },
      });

      if (!assignedUser) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 404 }
        );
      }

      const belongsToOrganization =
        assignedUser.memberships.some(
          (member) =>
            member.organizationId ===
            task.content.project.organizationId
        );

      if (!belongsToOrganization) {
        return NextResponse.json(
          {
            error:
              "Assigned user does not belong to this organization",
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
            description?.trim() || null,
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
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { taskId } = await context.params;

    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        content: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email,
      },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const membership = user.memberships.find(
      (member) =>
        member.organizationId ===
        task.content.project.organizationId
    );

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (
      !["ADMIN", "MANAGER"].includes(
        membership.role
      )
    ) {
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