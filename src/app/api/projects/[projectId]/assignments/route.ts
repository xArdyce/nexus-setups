import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";

type RouteContext = {
    params: Promise<{
        projectId: string;
    }>;
};

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
            memberships: {
                select: {
                    organizationId: true,
                    role: true,
                },
            },
        },
    });
}

async function getManageableContent(
    contentId: string,
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >
) {
    const manageableOrganizationIds = user.memberships
        .filter(
            (membership) =>
                membership.role === "ADMIN" ||
                membership.role === "MANAGER"
        )
        .map((membership) => membership.organizationId);

    if (manageableOrganizationIds.length === 0) {
        return null;
    }

    return prisma.contentItem.findFirst({
        where: {
            id: contentId,
            project: {
                organizationId: {
                    in: manageableOrganizationIds,
                },
            },
        },
        select: {
            id: true,
            title: true,
            project: {
                select: {
                    id: true,
                    organizationId: true,
                    creatorId: true,
                    creator: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });
}

// This route keeps the existing URL shape:
// /api/projects/[projectId]/assignments
//
// IMPORTANT:
// "projectId" here is the dashboard project's ContentItem.id.
// The dashboard calls each ContentItem a project.
export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { projectId: contentId } = await context.params;

        const content = await getManageableContent(
            contentId,
            user
        );

        if (!content) {
            return NextResponse.json(
                {
                    error:
                        "Project not found or you do not have permission to manage assignments.",
                },
                { status: 404 }
            );
        }

        const [
            directAssignments,
            creatorAssignments,
            editorMemberships,
        ] = await Promise.all([
            prisma.contentAssignment.findMany({
                where: {
                    contentId: content.id,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            }),

            content.project.creatorId
                ? prisma.creatorAssignment.findMany({
                      where: {
                          creatorId:
                              content.project.creatorId,
                      },
                      include: {
                          user: {
                              select: {
                                  id: true,
                                  name: true,
                                  email: true,
                              },
                          },
                      },
                      orderBy: {
                          createdAt: "asc",
                      },
                  })
                : Promise.resolve([]),

            prisma.organizationMember.findMany({
                where: {
                    organizationId:
                        content.project.organizationId,
                    role: "EDITOR",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            }),
        ]);

        const usersWithAccess = new Set([
            ...directAssignments.map(
                (assignment) => assignment.userId
            ),
            ...creatorAssignments.map(
                (assignment) => assignment.userId
            ),
        ]);

        return NextResponse.json({
            content: {
                id: content.id,
                title: content.title,
                creator: content.project.creator,
            },

            assignedEditors: directAssignments.map(
                (assignment) => ({
                    assignmentId: assignment.id,
                    assignedAt: assignment.createdAt,
                    source: "PROJECT",
                    user: assignment.user,
                })
            ),

            inheritedEditors: creatorAssignments.map(
                (assignment) => ({
                    assignmentId: assignment.id,
                    assignedAt: assignment.createdAt,
                    source: "CREATOR",
                    user: assignment.user,
                })
            ),

            availableEditors: editorMemberships
                .filter(
                    (membership) =>
                        !usersWithAccess.has(
                            membership.userId
                        )
                )
                .map((membership) => ({
                    id: membership.user.id,
                    name: membership.user.name,
                    email: membership.user.email,
                })),
        });
    } catch (error) {
        console.error(
            "GET /api/projects/[projectId]/assignments failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to load assignments." },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { projectId: contentId } = await context.params;

        const content = await getManageableContent(
            contentId,
            user
        );

        if (!content) {
            return NextResponse.json(
                {
                    error:
                        "Project not found or you do not have permission to manage assignments.",
                },
                { status: 404 }
            );
        }

        let body: {
            userId?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const editorUserId = String(
            body.userId || ""
        ).trim();

        if (!editorUserId) {
            return NextResponse.json(
                { error: "userId is required." },
                { status: 400 }
            );
        }

        const editorMembership =
            await prisma.organizationMember.findFirst({
                where: {
                    userId: editorUserId,
                    organizationId:
                        content.project.organizationId,
                    role: "EDITOR",
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

        if (!editorMembership) {
            return NextResponse.json(
                {
                    error:
                        "The selected user is not an Editor in this organization.",
                },
                { status: 400 }
            );
        }

        if (content.project.creatorId) {
            const creatorAssignment =
                await prisma.creatorAssignment.findUnique({
                    where: {
                        creatorId_userId: {
                            creatorId:
                                content.project.creatorId,
                            userId: editorUserId,
                        },
                    },
                });

            if (creatorAssignment) {
                return NextResponse.json(
                    {
                        error:
                            "This Editor already has access through the entire Creator assignment.",
                    },
                    { status: 409 }
                );
            }
        }

        const existing =
            await prisma.contentAssignment.findUnique({
                where: {
                    contentId_userId: {
                        contentId: content.id,
                        userId: editorUserId,
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

        if (existing) {
            return NextResponse.json({
                assignment: existing,
                alreadyAssigned: true,
            });
        }

        const assignment =
            await prisma.$transaction(async (tx) => {
                const created =
                    await tx.contentAssignment.create({
                        data: {
                            contentId: content.id,
                            userId: editorUserId,
                        },
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                        },
                    });

                await tx.auditLog.create({
                    data: {
                        action:
                            "EDITOR_ASSIGNED_TO_CONTENT",
                        resource: "ContentAssignment",
                        resourceId: created.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                content.project
                                    .organizationId,
                            creatorId:
                                content.project.creatorId,
                            contentId: content.id,
                            contentTitle: content.title,
                            editorUserId:
                                editorMembership.user.id,
                            editorName:
                                editorMembership.user.name,
                            editorEmail:
                                editorMembership.user.email,
                        },
                    },
                });

                return created;
            });

        await notifyUsers(
            [editorUserId],
            "Project assigned",
            `You were assigned to ${content.title}.`,
            user.id
        );

        return NextResponse.json(
            {
                assignment,
                alreadyAssigned: false,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "POST /api/projects/[projectId]/assignments failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to assign Editor." },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    context: RouteContext
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { projectId: contentId } = await context.params;

        const content = await getManageableContent(
            contentId,
            user
        );

        if (!content) {
            return NextResponse.json(
                {
                    error:
                        "Project not found or you do not have permission to manage assignments.",
                },
                { status: 404 }
            );
        }

        let body: {
            userId?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const editorUserId = String(
            body.userId || ""
        ).trim();

        if (!editorUserId) {
            return NextResponse.json(
                { error: "userId is required." },
                { status: 400 }
            );
        }

        const assignment =
            await prisma.contentAssignment.findUnique({
                where: {
                    contentId_userId: {
                        contentId: content.id,
                        userId: editorUserId,
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

        if (!assignment) {
            return NextResponse.json(
                {
                    error:
                        "This Editor is not directly assigned to this project.",
                },
                { status: 404 }
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.contentAssignment.delete({
                where: {
                    id: assignment.id,
                },
            });

            await tx.auditLog.create({
                data: {
                    action:
                        "EDITOR_UNASSIGNED_FROM_CONTENT",
                    resource: "ContentAssignment",
                    resourceId: assignment.id,
                    userId: user.id,
                    metadata: {
                        organizationId:
                            content.project.organizationId,
                        creatorId:
                            content.project.creatorId,
                        contentId: content.id,
                        contentTitle: content.title,
                        editorUserId:
                            assignment.user.id,
                        editorName:
                            assignment.user.name,
                        editorEmail:
                            assignment.user.email,
                    },
                },
            });
        });

        await notifyUsers(
            [editorUserId],
            "Project assignment removed",
            `You were removed from ${content.title}.`,
            user.id
        );

        return NextResponse.json({
            success: true,
            deletedAssignmentId: assignment.id,
            userId: editorUserId,
        });
    } catch (error) {
        console.error(
            "DELETE /api/projects/[projectId]/assignments failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to remove Editor." },
            { status: 500 }
        );
    }
}
