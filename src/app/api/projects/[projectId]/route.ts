import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CONTENT_STATUSES = [
    "REQUESTED",
    "IN_PRODUCTION",
    "IN_REVIEW",
    "REVISION",
    "APPROVED",
    "SCHEDULED",
    "PUBLISHED",
] as const;

type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

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

async function getAccessibleContent(
    projectId: string,
    user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
) {
    const includeData = {
        project: {
            include: {
                creator: true,
                organization: true,
            },
        },

        tasks: {
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc" as const,
            },
        },

        assets: {
            orderBy: {
                createdAt: "desc" as const,
            },
        },

        reviews: {
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },

                comments: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc" as const,
                    },
                },
            },

            orderBy: {
                createdAt: "desc" as const,
            },
        },
    };

    if (user.accountType === "CREATOR") {
        if (!user.creatorProfile) {
            return null;
        }

        return prisma.contentItem.findFirst({
            where: {
                projectId,
                project: {
                    organizationId: user.creatorProfile.organizationId,
                    creatorId: user.creatorProfile.id,
                },
            },
            include: includeData,
        });
    }

    const organizationIds = user.memberships.map(
        (membership) => membership.organizationId
    );

    if (organizationIds.length === 0) {
        return null;
    }

    return prisma.contentItem.findFirst({
        where: {
            projectId,
            project: {
                organizationId: {
                    in: organizationIds,
                },
            },
        },
        include: includeData,
    });
}

function canManageProduction(
    user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
) {
    if (user.accountType !== "EDITOR") {
        return false;
    }

    return user.memberships.some((membership) =>
        ["ADMIN", "MANAGER", "EDITOR"].includes(membership.role)
    );
}

// GET /api/projects/[projectId]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getAuthenticatedUser();

    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { projectId } = await params;

    const content = await getAccessibleContent(projectId, user);

    if (!content) {
        return NextResponse.json(
            { error: "Project not found or access denied." },
            { status: 404 }
        );
    }

    return NextResponse.json({
        project: {
            id: content.project.id,
            name: content.project.name,
            description: content.project.description,
            projectStatus: content.project.status,
            priority: content.project.priority,
            dueDate: content.project.dueDate,
            createdAt: content.project.createdAt,
            updatedAt: content.project.updatedAt,

            creator: content.project.creator
                ? {
                    id: content.project.creator.id,
                    name: content.project.creator.name,
                    email: content.project.creator.email,
                }
                : null,

            organization: {
                id: content.project.organization.id,
                name: content.project.organization.name,
            },
        },

        content: {
            id: content.id,
            title: content.title,
            description: content.description,
            footageLink: content.footageLink,
            status: content.status,
            contentType: content.contentType,
            dueDate: content.dueDate,
            createdAt: content.createdAt,
            updatedAt: content.updatedAt,
        },

        tasks: content.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            assignedTo: task.assignedTo,
        })),

        assets: content.assets.map((asset) => ({
            id: asset.id,
            fileName: asset.fileName,
            fileSize: asset.fileSize
                ? asset.fileSize.toString()
                : null,
            mimeType: asset.mimeType,
            storageKey: asset.storageKey,
            assetType: asset.assetType,
            createdAt: asset.createdAt,
        })),

        reviews: content.reviews.map((review) => ({
            id: review.id,
            status: review.status,
            notes: review.notes,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,

            author: review.author,

            comments: review.comments.map((comment) => ({
                id: comment.id,
                comment: comment.comment,
                timestamp: comment.timestamp,
                createdAt: comment.createdAt,
                author: comment.author,
            })),
        })),
    });
}

// PATCH /api/projects/[projectId]
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getAuthenticatedUser();

    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { projectId } = await params;

    const content = await getAccessibleContent(projectId, user);

    if (!content) {
        return NextResponse.json(
            { error: "Project not found or access denied." },
            { status: 404 }
        );
    }

    const body = await request.json();

    const requestedStatus =
        typeof body?.status === "string"
            ? (body.status as ContentStatusValue)
            : undefined;

    const reviewNotes =
        typeof body?.reviewNotes === "string"
            ? body.reviewNotes.trim()
            : "";

    if (
        requestedStatus &&
        !CONTENT_STATUSES.includes(requestedStatus)
    ) {
        return NextResponse.json(
            { error: "Invalid content status." },
            { status: 400 }
        );
    }

    if (!requestedStatus) {
        return NextResponse.json(
            { error: "A status is required." },
            { status: 400 }
        );
    }

    if (user.accountType === "CREATOR") {
        return NextResponse.json(
            {
                error:
                    "Creator accounts cannot change production status.",
            },
            { status: 403 }
        );
    }

    if (!canManageProduction(user)) {
        return NextResponse.json(
            {
                error:
                    "You do not have permission to change production status.",
            },
            { status: 403 }
        );
    }

    /*
     * Prevent duplicate status transitions from unnecessarily
     * creating duplicate review records.
     */
    const statusChanged =
        content.status !== requestedStatus;

    const updatedContent = await prisma.$transaction(
        async (tx) => {
            const updated = await tx.contentItem.update({
                where: {
                    id: content.id,
                },
                data: {
                    status: requestedStatus,
                },
            });

            /*
             * Entering IN_REVIEW creates a pending review
             * if one does not already exist.
             */
            if (
                requestedStatus === "IN_REVIEW" &&
                statusChanged
            ) {
                const existingPendingReview =
                    await tx.review.findFirst({
                        where: {
                            contentId: content.id,
                            status: "PENDING",
                        },
                    });

                if (!existingPendingReview) {
                    await tx.review.create({
                        data: {
                            contentId: content.id,
                            authorId: user.id,
                            status: "PENDING",
                            notes: reviewNotes || null,
                        },
                    });
                }
            }

            /*
             * APPROVED creates the final approval review.
             */
            if (
                requestedStatus === "APPROVED" &&
                statusChanged
            ) {
                await tx.review.create({
                    data: {
                        contentId: content.id,
                        authorId: user.id,
                        status: "APPROVED",
                        notes: reviewNotes || null,
                    },
                });
            }

            /*
             * REVISION creates a revision-requested review.
             */
            if (
                requestedStatus === "REVISION" &&
                statusChanged
            ) {
                await tx.review.create({
                    data: {
                        contentId: content.id,
                        authorId: user.id,
                        status: "REVISION_REQUESTED",
                        notes: reviewNotes || null,
                    },
                });
            }

            return updated;
        }
    );

    return NextResponse.json({
        success: true,

        content: {
            id: updatedContent.id,
            status: updatedContent.status,
            updatedAt: updatedContent.updatedAt,
        },
    });
}