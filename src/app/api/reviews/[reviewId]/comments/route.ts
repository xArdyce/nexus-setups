import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getAssignedEditorUserIds,
    getCreatorAccountUserId,
    notifyUsers,
} from "@/lib/notifications";

type RouteContext = {
    params: Promise<{
        reviewId: string;
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

async function getAccessibleReview(
    reviewId: string,
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >
) {
    const review = await prisma.review.findUnique({
        where: {
            id: reviewId,
        },
        include: {
            assetVersion: {
                include: {
                    asset: {
                        select: {
                            id: true,
                            assetType: true,
                        },
                    },
                },
            },
            content: {
                include: {
                    project: {
                        include: {
                            creator: true,
                        },
                    },
                },
            },
        },
    });

    if (!review) {
        return null;
    }

    if (
        user.accountType === "CREATOR" &&
        user.creatorProfile?.id ===
            review.content.project.creatorId &&
        user.creatorProfile?.organizationId ===
            review.content.project.organizationId
    ) {
        return review;
    }

    const membership = user.memberships.find(
        (item) =>
            item.organizationId ===
            review.content.project.organizationId
    );

    if (!membership) {
        return null;
    }

    if (
        membership.role === "ADMIN" ||
        membership.role === "MANAGER"
    ) {
        return review;
    }

    if (membership.role !== "EDITOR") {
        return null;
    }

    const editorAccess =
        await prisma.contentItem.findFirst({
            where: {
                id: review.content.id,
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

    return editorAccess ? review : null;
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

        const { reviewId } = await context.params;

        const review = await getAccessibleReview(
            reviewId,
            user
        );

        if (!review) {
            return NextResponse.json(
                {
                    error:
                        "Review not found or access denied.",
                },
                { status: 404 }
            );
        }

        const comments =
            await prisma.reviewComment.findMany({
                where: {
                    reviewId: review.id,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    resolvedBy: {
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
            });

        return NextResponse.json({
            comments,
        });
    } catch (error) {
        console.error(
            "GET /api/reviews/[reviewId]/comments failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load review comments.",
            },
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

        const { reviewId } = await context.params;

        const review = await getAccessibleReview(
            reviewId,
            user
        );

        if (!review) {
            return NextResponse.json(
                {
                    error:
                        "Review not found or access denied.",
                },
                { status: 404 }
            );
        }

        let body: {
            comment?: unknown;
            timestamp?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const comment =
            typeof body.comment === "string"
                ? body.comment.trim()
                : "";

        if (!comment) {
            return NextResponse.json(
                {
                    error:
                        "A review comment is required.",
                },
                { status: 400 }
            );
        }

        let timestamp: number | null = null;

        if (
            body.timestamp !== undefined &&
            body.timestamp !== null &&
            body.timestamp !== ""
        ) {
            const parsedTimestamp = Number(
                body.timestamp
            );

            if (
                !Number.isFinite(parsedTimestamp) ||
                parsedTimestamp < 0
            ) {
                return NextResponse.json(
                    {
                        error:
                            "timestamp must be a non-negative number.",
                    },
                    { status: 400 }
                );
            }

            timestamp = parsedTimestamp;
        }

        const created = await prisma.$transaction(
            async (tx) => {
                const reviewComment =
                    await tx.reviewComment.create({
                        data: {
                            reviewId: review.id,
                            authorId: user.id,
                            comment,
                            timestamp,
                        },
                        include: {
                            author: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                },
                            },
                            resolvedBy: {
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
                            "REVIEW_COMMENT_ADDED",
                        resource: "ReviewComment",
                        resourceId:
                            reviewComment.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                review.content.project
                                    .organizationId,
                            creatorId:
                                review.content.project
                                    .creatorId,
                            contentId:
                                review.content.id,
                            contentTitle:
                                review.content.title,
                            reviewId: review.id,
                            assetVersionId:
                                review.assetVersion?.id ?? null,
                            assetVersion:
                                review.assetVersion?.version ?? null,
                            assetId:
                                review.assetVersion?.assetId ?? null,
                            timestamp,
                        },
                    },
                });

                return reviewComment;
            }
        );

        if (user.accountType === "CREATOR") {
            const assignedEditorUserIds =
                await getAssignedEditorUserIds(
                    review.content.id
                );

            await notifyUsers(
                assignedEditorUserIds,
                "New review comment",
                review.assetVersion
                    ? `New feedback was added to ${review.content.title} v${review.assetVersion.version}.`
                    : `New feedback was added to ${review.content.title}.`,
                user.id
            );
        } else {
            const creatorUserId =
                await getCreatorAccountUserId(
                    review.content.project.creatorId
                );

            await notifyUsers(
                [creatorUserId],
                "New review comment",
                review.assetVersion
                    ? `New feedback was added to ${review.content.title} v${review.assetVersion.version}.`
                    : `New feedback was added to ${review.content.title}.`,
                user.id
            );
        }

        return NextResponse.json(
            {
                comment: created,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "POST /api/reviews/[reviewId]/comments failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to add review comment.",
            },
            { status: 500 }
        );
    }
}
function getReviewMembership(
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >,
    organizationId: string
) {
    return user.memberships.find(
        (membership) =>
            membership.organizationId === organizationId
    );
}

function canManageAnyReviewComment(
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >,
    organizationId: string
) {
    const membership = getReviewMembership(
        user,
        organizationId
    );

    return (
        membership?.role === "ADMIN" ||
        membership?.role === "MANAGER"
    );
}

export async function PATCH(
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

        const { reviewId } = await context.params;
        const review = await getAccessibleReview(
            reviewId,
            user
        );

        if (!review) {
            return NextResponse.json(
                {
                    error:
                        "Review not found or access denied.",
                },
                { status: 404 }
            );
        }

        let body: {
            action?: unknown;
            commentId?: unknown;
            comment?: unknown;
            timestamp?: unknown;
            resolved?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const action =
            typeof body.action === "string"
                ? body.action
                : "";

        const commentId =
            typeof body.commentId === "string"
                ? body.commentId.trim()
                : "";

        if (!commentId) {
            return NextResponse.json(
                {
                    error:
                        "commentId is required.",
                },
                { status: 400 }
            );
        }

        const existingComment =
            await prisma.reviewComment.findFirst({
                where: {
                    id: commentId,
                    reviewId: review.id,
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    resolvedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

        if (!existingComment) {
            return NextResponse.json(
                {
                    error:
                        "Review comment not found.",
                },
                { status: 404 }
            );
        }

        const canManageAny =
            canManageAnyReviewComment(
                user,
                review.content.project.organizationId
            );

        if (action === "EDIT") {
            if (
                existingComment.authorId !== user.id &&
                !canManageAny
            ) {
                return NextResponse.json(
                    {
                        error:
                            "You can only edit your own review comments.",
                    },
                    { status: 403 }
                );
            }

            const nextComment =
                typeof body.comment === "string"
                    ? body.comment.trim()
                    : "";

            if (!nextComment) {
                return NextResponse.json(
                    {
                        error:
                            "A review comment is required.",
                    },
                    { status: 400 }
                );
            }

            let nextTimestamp: number | null = null;

            if (
                body.timestamp !== undefined &&
                body.timestamp !== null &&
                body.timestamp !== ""
            ) {
                const parsedTimestamp =
                    Number(body.timestamp);

                if (
                    !Number.isFinite(
                        parsedTimestamp
                    ) ||
                    parsedTimestamp < 0
                ) {
                    return NextResponse.json(
                        {
                            error:
                                "timestamp must be a non-negative number.",
                        },
                        { status: 400 }
                    );
                }

                nextTimestamp = parsedTimestamp;
            }

            const updated =
                await prisma.$transaction(
                    async (tx) => {
                        const reviewComment =
                            await tx.reviewComment.update({
                                where: {
                                    id: existingComment.id,
                                },
                                data: {
                                    comment:
                                        nextComment,
                                    timestamp:
                                        nextTimestamp,
                                },
                                include: {
                                    author: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                        },
                                    },
                                    resolvedBy: {
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
                                    "REVIEW_COMMENT_EDITED",
                                resource:
                                    "ReviewComment",
                                resourceId:
                                    reviewComment.id,
                                userId: user.id,
                                metadata: {
                                    organizationId:
                                        review.content.project
                                            .organizationId,
                                    creatorId:
                                        review.content.project
                                            .creatorId,
                                    contentId:
                                        review.content.id,
                                    contentTitle:
                                        review.content.title,
                                    reviewId:
                                        review.id,
                                    assetVersion:
                                        review.assetVersion
                                            ?.version ??
                                        null,
                                    timestamp:
                                        nextTimestamp,
                                },
                            },
                        });

                        return reviewComment;
                    }
                );

            return NextResponse.json({
                success: true,
                comment: updated,
            });
        }

        if (action === "RESOLVE") {
            if (typeof body.resolved !== "boolean") {
                return NextResponse.json(
                    {
                        error:
                            "resolved must be true or false.",
                    },
                    { status: 400 }
                );
            }

            const updated =
                await prisma.$transaction(
                    async (tx) => {
                        const reviewComment =
                            await tx.reviewComment.update({
                                where: {
                                    id: existingComment.id,
                                },
                                data: body.resolved
                                    ? {
                                          resolved: true,
                                          resolvedAt:
                                              new Date(),
                                          resolvedById:
                                              user.id,
                                      }
                                    : {
                                          resolved: false,
                                          resolvedAt:
                                              null,
                                          resolvedById:
                                              null,
                                      },
                                include: {
                                    author: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                        },
                                    },
                                    resolvedBy: {
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
                                    body.resolved
                                        ? "REVIEW_COMMENT_RESOLVED"
                                        : "REVIEW_COMMENT_REOPENED",
                                resource:
                                    "ReviewComment",
                                resourceId:
                                    reviewComment.id,
                                userId: user.id,
                                metadata: {
                                    organizationId:
                                        review.content.project
                                            .organizationId,
                                    creatorId:
                                        review.content.project
                                            .creatorId,
                                    contentId:
                                        review.content.id,
                                    contentTitle:
                                        review.content.title,
                                    reviewId:
                                        review.id,
                                    assetVersion:
                                        review.assetVersion
                                            ?.version ??
                                        null,
                                },
                            },
                        });

                        return reviewComment;
                    }
                );

            return NextResponse.json({
                success: true,
                comment: updated,
            });
        }

        return NextResponse.json(
            {
                error:
                    "action must be EDIT or RESOLVE.",
            },
            { status: 400 }
        );
    } catch (error) {
        console.error(
            "PATCH /api/reviews/[reviewId]/comments failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to update review comment.",
            },
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

        const { reviewId } = await context.params;
        const review = await getAccessibleReview(
            reviewId,
            user
        );

        if (!review) {
            return NextResponse.json(
                {
                    error:
                        "Review not found or access denied.",
                },
                { status: 404 }
            );
        }

        let body: {
            commentId?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const commentId =
            typeof body.commentId === "string"
                ? body.commentId.trim()
                : "";

        if (!commentId) {
            return NextResponse.json(
                {
                    error:
                        "commentId is required.",
                },
                { status: 400 }
            );
        }

        const existingComment =
            await prisma.reviewComment.findFirst({
                where: {
                    id: commentId,
                    reviewId: review.id,
                },
            });

        if (!existingComment) {
            return NextResponse.json(
                {
                    error:
                        "Review comment not found.",
                },
                { status: 404 }
            );
        }

        const canManageAny =
            canManageAnyReviewComment(
                user,
                review.content.project.organizationId
            );

        if (
            existingComment.authorId !== user.id &&
            !canManageAny
        ) {
            return NextResponse.json(
                {
                    error:
                        "You can only delete your own review comments.",
                },
                { status: 403 }
            );
        }

        await prisma.$transaction(
            async (tx) => {
                await tx.auditLog.create({
                    data: {
                        action:
                            "REVIEW_COMMENT_DELETED",
                        resource:
                            "ReviewComment",
                        resourceId:
                            existingComment.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                review.content.project
                                    .organizationId,
                            creatorId:
                                review.content.project
                                    .creatorId,
                            contentId:
                                review.content.id,
                            contentTitle:
                                review.content.title,
                            reviewId:
                                review.id,
                            assetVersion:
                                review.assetVersion
                                    ?.version ??
                                null,
                        },
                    },
                });

                await tx.reviewComment.delete({
                    where: {
                        id: existingComment.id,
                    },
                });
            }
        );

        return NextResponse.json({
            success: true,
            deletedCommentId:
                existingComment.id,
        });
    } catch (error) {
        console.error(
            "DELETE /api/reviews/[reviewId]/comments failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to delete review comment.",
            },
            { status: 500 }
        );
    }
}
