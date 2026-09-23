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
                `New feedback was added to ${review.content.title}.`,
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
                `New feedback was added to ${review.content.title}.`,
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
