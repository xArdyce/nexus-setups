import { logServerError } from "@/lib/server-log";
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
                assetVersion: {
                    include: {
                        asset: {
                            select: {
                                id: true,
                                contentId: true,
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
            user.memberships.some((member) => member.role === "CREATOR" && member.organizationId === user.creatorProfile?.organizationId) &&
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

        if (!review.assetVersion || review.assetVersion.asset.contentId !== review.content.id) {
            return NextResponse.json({ error: "This review has no valid project version." }, { status: 409 });
        }
        const latestPending = await prisma.review.findFirst({
            where: { contentId: review.content.id, status: "PENDING" },
            orderBy: { createdAt: "desc" }, select: { id: true },
        });
        if (latestPending?.id !== review.id) {
            return NextResponse.json({ error: "This is not the current pending review." }, { status: 409 });
        }

        let body: {
            decision?: unknown;
            notes?: unknown;
            confirmUnresolved?: unknown;
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

        const confirmUnresolved =
            body.confirmUnresolved === true;

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
                await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${review.content.id} FOR UPDATE`;
                const currentReview = await tx.review.findUnique({ where: { id: review.id } });
                const currentContent = await tx.contentItem.findUnique({ where: { id: review.content.id } });
                if (currentReview?.status !== "PENDING" || currentContent?.status !== "IN_REVIEW" || currentReview.assetVersionId !== review.assetVersionId) {
                    throw Object.assign(new Error("Review changed"), { response: NextResponse.json({ error: "Review changed. Reload before deciding." }, { status: 409 }) });
                }
                if (
                    decision === "APPROVE" &&
                    !confirmUnresolved
                ) {
                    const unresolvedCommentCount =
                        await tx.reviewComment.count({
                            where: {
                                reviewId: review.id,
                                resolved: false,
                            },
                        });

                    if (unresolvedCommentCount > 0) {
                        throw Object.assign(new Error("Unresolved review comments"), { response: NextResponse.json(
                            {
                                error:
                                    `There ${
                                        unresolvedCommentCount === 1
                                            ? "is"
                                            : "are"
                                    } ${unresolvedCommentCount} unresolved review ${
                                        unresolvedCommentCount === 1
                                            ? "comment"
                                            : "comments"
                                    } on this cut.`,
                                code:
                                    "UNRESOLVED_REVIEW_COMMENTS",
                                unresolvedCommentCount,
                            },
                            { status: 409 }
                        ) });
                    }
                }

                const updatedReview =
                    await tx.review.update({
                        where: {
                            id: review.id,
                            status: "PENDING",
                        },
                        data: {
                            status: nextReviewStatus,
                            ...(notes
                                ? { notes }
                                : {}),
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
                            status: "IN_REVIEW",
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
                            assetVersionId:
                                review.assetVersion?.id ?? null,
                            assetVersion:
                                review.assetVersion?.version ?? null,
                            assetId:
                                review.assetVersion?.assetId ?? null,
                            decision,
                            notes: notes || null,
                            approvedWithUnresolvedComments:
                                decision === "APPROVE"
                                    ? confirmUnresolved
                                    : false,
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
                ? review.assetVersion
                    ? `${review.content.title} v${review.assetVersion.version} was approved.`
                    : `${review.content.title} was approved.`
                : review.assetVersion
                  ? `${review.content.title} v${review.assetVersion.version} needs revisions.`
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
        if (error && typeof error === "object" && "response" in error && error.response instanceof Response) return error.response;
        logServerError(
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
