import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{
        creatorId: string;
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

async function getManageableCreator(
    creatorId: string,
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

    return prisma.creator.findFirst({
        where: {
            id: creatorId,
            organizationId: {
                in: manageableOrganizationIds,
            },
        },
        select: {
            id: true,
            name: true,
            email: true,
            organizationId: true,
        },
    });
}

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

        const { creatorId } = await context.params;

        const creator = await getManageableCreator(
            creatorId,
            user
        );

        if (!creator) {
            return NextResponse.json(
                {
                    error:
                        "Creator not found or you do not have permission to manage assignments.",
                },
                { status: 404 }
            );
        }

        const [assignments, editorMemberships] =
            await Promise.all([
                prisma.creatorAssignment.findMany({
                    where: {
                        creatorId: creator.id,
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

                prisma.organizationMember.findMany({
                    where: {
                        organizationId:
                            creator.organizationId,
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

        const assignedUserIds = new Set(
            assignments.map(
                (assignment) => assignment.userId
            )
        );

        return NextResponse.json({
            creator,
            assignedEditors: assignments.map(
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
                        !assignedUserIds.has(
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
            "GET /api/creators/[creatorId]/assignments failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to load Creator assignments." },
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

        const { creatorId } = await context.params;

        const creator = await getManageableCreator(
            creatorId,
            user
        );

        if (!creator) {
            return NextResponse.json(
                {
                    error:
                        "Creator not found or you do not have permission to manage assignments.",
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
                        creator.organizationId,
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

        const existing =
            await prisma.creatorAssignment.findUnique({
                where: {
                    creatorId_userId: {
                        creatorId: creator.id,
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
                    await tx.creatorAssignment.create({
                        data: {
                            creatorId: creator.id,
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
                            "EDITOR_ASSIGNED_TO_CREATOR",
                        resource: "CreatorAssignment",
                        resourceId: created.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                creator.organizationId,
                            creatorId: creator.id,
                            creatorName: creator.name,
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

        return NextResponse.json(
            {
                assignment,
                alreadyAssigned: false,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "POST /api/creators/[creatorId]/assignments failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to assign Editor to Creator." },
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

        const { creatorId } = await context.params;

        const creator = await getManageableCreator(
            creatorId,
            user
        );

        if (!creator) {
            return NextResponse.json(
                {
                    error:
                        "Creator not found or you do not have permission to manage assignments.",
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
            await prisma.creatorAssignment.findUnique({
                where: {
                    creatorId_userId: {
                        creatorId: creator.id,
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
                        "This Editor is not assigned to the Creator.",
                },
                { status: 404 }
            );
        }

        await prisma.$transaction(async (tx) => {
            await tx.creatorAssignment.delete({
                where: {
                    id: assignment.id,
                },
            });

            await tx.auditLog.create({
                data: {
                    action:
                        "EDITOR_UNASSIGNED_FROM_CREATOR",
                    resource: "CreatorAssignment",
                    resourceId: assignment.id,
                    userId: user.id,
                    metadata: {
                        organizationId:
                            creator.organizationId,
                        creatorId: creator.id,
                        creatorName: creator.name,
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

        return NextResponse.json({
            success: true,
            deletedAssignmentId: assignment.id,
            userId: editorUserId,
        });
    } catch (error) {
        console.error(
            "DELETE /api/creators/[creatorId]/assignments failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to remove Editor from Creator.",
            },
            { status: 500 }
        );
    }
}
