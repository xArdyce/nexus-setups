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

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
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

    const content = await prisma.contentItem.findUnique({
      where: {
        id: contentId,
      },
      include: {
        project: true,
      },
    });

    if (!content) {
      return NextResponse.json(
        { error: "Content item not found" },
        { status: 404 }
      );
    }

    const hasOrganizationAccess = user.memberships.some(
      (membership) =>
        membership.organizationId === content.project.organizationId
    );

    const isCreator =
      user.creatorProfile?.id === content.project.creatorId;

    if (!hasOrganizationAccess && !isCreator) {
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
    const session = await auth();

    if (!session?.user?.email) {
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

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    if (!contentId) {
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

    const content = await prisma.contentItem.findUnique({
      where: {
        id: contentId,
      },
      include: {
        project: true,
      },
    });

    if (!content) {
      return NextResponse.json(
        { error: "Content item not found" },
        { status: 404 }
      );
    }

    const membership = user.memberships.find(
      (member) =>
        member.organizationId ===
        content.project.organizationId
    );

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this organization",
        },
        { status: 403 }
      );
    }

    if (
      membership.role === "CREATOR"
    ) {
      return NextResponse.json(
        {
          error:
            "Creators cannot create production tasks",
        },
        { status: 403 }
      );
    }

    if (assignedToId) {
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
            content.project.organizationId
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

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description:
          description?.trim() || null,
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