import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getAssignedEditorUserIds,
    getCreatorAccountUserId,
    getManagementUserIds,
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
                                organization: true,
                            },
                        },
                    },
                },
            },
        });

        if (!review) {
            return NextResponse.json(
                { error: "Review not found." },
                { status: 404 }
            );
        }

        const isOwningCreator =
            user.accountType === "CREATOR" &&
            user.creatorProfile?.id ===
                review.content.project.creatorId &&
            user.creatorProfile?.organizationId ===
                review.content.project.organizationId;

        const managementMembership =
            user.memberships.find(
                (membership) =>
                    membership.organizationId ===
                        review.content.project.organizationId &&
                    (
                        membership.role === "ADMIN" ||
                        membership.role === "MANAGER"
                    )
            );

        if (!isOwningCreator && !managementMembership) {
            return NextResponse.json(
                {
                    error:
                        "Only the owning Creator, an Admin, or a Manager can make a review decision.",
                },
                { status: 403 }
            );
        }

        if (review.status !== "PENDING") {
            return NextResponse.json(
                {
                    error:
                        "This review has already been resolved.",
                },
                { status: 409 }
            );
        }

        if (review.content.status !== "IN_REVIEW") {
            return NextResponse.json(
                {
                    error:
                        "This content is not currently awaiting review.",
                },
                { status: 409 }
            );
        }

        let body: {
            decision?: unknown;
            notes?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const decision =
            typeof body.decision === "string"
                ? body.decision
                : "";

        const notes =
            typeof body.notes === "string"
                ? body.notes.trim()
                : "";

        if (
            decision !== "APPROVE" &&
            decision !== "REQUEST_REVISION"
        ) {
            return NextResponse.json(
                {
                    error:
                        "decision must be APPROVE or REQUEST_REVISION.",
                },
                { status: 400 }
            );
        }

        if (
            decision === "REQUEST_REVISION" &&
            !notes
        ) {
            return NextResponse.json(
                {
                    error:
                        "Revision notes are required when requesting changes.",
                },
                { status: 400 }
            );
        }

        const nextReviewStatus =
            decision === "APPROVE"
                ? "APPROVED"
                : "REVISION_REQUESTED";

        const nextContentStatus =
            decision === "APPROVE"
                ? "APPROVED"
                : "REVISION";

        const result = await prisma.$transaction(
            async (tx) => {
                const updatedReview =
                    await tx.review.update({
                        where: {
                            id: review.id,
                        },
                        data: {
                            status: nextReviewStatus,
                            ...(notes
                                ? { notes }
                                : {}),
                        },
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
                                    createdAt: "asc",
                                },
                            },
                        },
                    });

                const updatedContent =
                    await tx.contentItem.update({
                        where: {
                            id: review.content.id,
                        },
                        data: {
                            status: nextContentStatus,
                        },
                    });

                await tx.auditLog.create({
                    data: {
                        action:
                            decision === "APPROVE"
                                ? "REVIEW_APPROVED"
                                : "REVIEW_REVISION_REQUESTED",
                        resource: "Review",
                        resourceId: review.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                review.content.project
                                    .organizationId,
                            creatorId:
                                review.content.project.creatorId,
                            contentId:
                                review.content.id,
                            contentTitle:
                                review.content.title,
                            reviewId: review.id,
                            decision,
                            notes: notes || null,
                        },
                    },
                });

                return {
                    updatedReview,
                    updatedContent,
                };
            }
        );

        const assignedEditorUserIds =
            await getAssignedEditorUserIds(
                review.content.id
            );

        const creatorUserId =
            await getCreatorAccountUserId(
                review.content.project.creatorId
            );

        const managementUserIds =
            decision === "APPROVE"
                ? await getManagementUserIds(
                      review.content.project
                          .organizationId
                  )
                : [];

        await notifyUsers(
            [
                ...assignedEditorUserIds,
                ...managementUserIds,
                creatorUserId,
            ],
            decision === "APPROVE"
                ? "Project approved"
                : "Revision requested",
            decision === "APPROVE"
                ? `${review.content.title} was approved.`
                : `${review.content.title} needs revisions.`,
            user.id
        );

        return NextResponse.json({
            success: true,
            review: result.updatedReview,
            content: {
                id: result.updatedContent.id,
                status: result.updatedContent.status,
                updatedAt:
                    result.updatedContent.updatedAt,
            },
        });
    } catch (error) {
        console.error(
            "POST /api/reviews/[reviewId]/decision failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to process review decision.",
            },
            { status: 500 }
        );
    }
}
