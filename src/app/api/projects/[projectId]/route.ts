import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";
import {
    getAssignedEditorUserIds,
    getCreatorAccountUserId,
    getManagementUserIds,
    notifyUsers,
} from "@/lib/notifications";

const CONTENT_STATUSES = [
    "REQUESTED",
    "IN_PRODUCTION",
    "IN_REVIEW",
    "REVISION",
    "APPROVED",
] as const;

const CONTENT_TYPES = [
    "Short-form",
    "YouTube Long-form",
    "Repurposed Cuts",
] as const;

type ContentStatusValue = (typeof CONTENT_STATUSES)[number];

function isGoogleDriveFolderUrl(value: string) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "https:" &&
            url.hostname === "drive.google.com" &&
            /^\/drive\/(?:u\/\d+\/)?folders\/[^/]+\/?$/.test(
                url.pathname
            )
        );
    } catch {
        return false;
    }
}

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
            include: {
                versions: {
                    orderBy: {
                        version: "desc" as const,
                    },
                },
            },
            orderBy: {
                createdAt: "desc" as const,
            },
        },

        reviews: {
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
                        resolvedBy: {
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
                id: projectId,
                project: {
                    organizationId: user.creatorProfile.organizationId,
                    creatorId: user.creatorProfile.id,
                },
            },
            include: includeData,
        });
    }

    const fullAccessOrganizationIds = user.memberships
        .filter(
            (membership) =>
                membership.role === "ADMIN" ||
                membership.role === "MANAGER"
        )
        .map((membership) => membership.organizationId);

    const editorOrganizationIds = user.memberships
        .filter(
            (membership) =>
                membership.role === "EDITOR"
        )
        .map((membership) => membership.organizationId);

    if (
        fullAccessOrganizationIds.length === 0 &&
        editorOrganizationIds.length === 0
    ) {
        return null;
    }

    return prisma.contentItem.findFirst({
        where: {
            id: projectId,

            OR: [
                ...(fullAccessOrganizationIds.length > 0
                    ? [
                          {
                              project: {
                                  organizationId: {
                                      in: fullAccessOrganizationIds,
                                  },
                              },
                          },
                      ]
                    : []),

                ...(editorOrganizationIds.length > 0
                    ? [
                          {
                              AND: [
                                  {
                                      project: {
                                          organizationId: {
                                              in: editorOrganizationIds,
                                          },
                                      },
                                  },
                                  {
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
                              ],
                          },
                      ]
                    : []),
            ],
        },

        include: includeData,
    });
}

async function deleteR2Objects(storageKeys: string[]) {
    const uniqueKeys = Array.from(
        new Set(storageKeys.filter(Boolean))
    );

    if (uniqueKeys.length === 0) {
        return;
    }

    const client = getR2Client();
    const bucket = getR2BucketName();

    for (let index = 0; index < uniqueKeys.length; index += 1000) {
        const batch = uniqueKeys.slice(index, index + 1000);

        const result = await client.send(
            new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                    Objects: batch.map((Key) => ({ Key })),
                    Quiet: true,
                },
            })
        );

        if (result.Errors?.length) {
            const failedKeys = result.Errors
                .map((error) => error.Key)
                .filter(Boolean)
                .join(", ");

            throw new Error(
                `Cloudflare R2 could not delete one or more project assets: ${failedKeys || "unknown object"}`
            );
        }
    }
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

            assetVersion: review.assetVersion
                ? {
                      id: review.assetVersion.id,
                      version: review.assetVersion.version,
                      fileName: review.assetVersion.fileName,
                      fileSize:
                          review.assetVersion.fileSize?.toString() ??
                          null,
                      mimeType: review.assetVersion.mimeType,
                      assetId: review.assetVersion.assetId,
                      assetType:
                          review.assetVersion.asset.assetType,
                      createdAt:
                          review.assetVersion.createdAt,
                  }
                : null,

            comments: review.comments.map((comment) => ({
                id: comment.id,
                comment: comment.comment,
                timestamp: comment.timestamp,
                resolved: comment.resolved,
                resolvedAt: comment.resolvedAt,
                resolvedBy: comment.resolvedBy,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
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

    let body: {
        status?: unknown;
        reviewNotes?: unknown;
        title?: unknown;
        description?: unknown;
        footageLink?: unknown;
        contentType?: unknown;
        dueDate?: unknown;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 }
        );
    }

    const requestedStatus =
        typeof body.status === "string"
            ? (body.status as ContentStatusValue)
            : undefined;

    const reviewNotes =
        typeof body.reviewNotes === "string"
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

    const detailFields = [
        "title",
        "description",
        "footageLink",
        "contentType",
        "dueDate",
    ] as const;

    const requestedDetailFields = detailFields.filter(
        (field) => body[field] !== undefined
    );

    if (requestedDetailFields.length > 0) {
        const membership =
            user.accountType === "CREATOR"
                ? null
                : user.memberships.find(
                      (item) =>
                          item.organizationId ===
                          content.project.organizationId
                  );

        const isManagement =
            membership?.role === "ADMIN" ||
            membership?.role === "MANAGER";

        const isOwningCreator =
            user.accountType === "CREATOR" &&
            user.creatorProfile?.id ===
                content.project.creator?.id;

        if (!isOwningCreator && !isManagement) {
            return NextResponse.json(
                {
                    error:
                        "Only the owning Creator, Admins, and Managers can edit project details.",
                },
                { status: 403 }
            );
        }

        if (
            isOwningCreator &&
            content.status === "APPROVED"
        ) {
            return NextResponse.json(
                {
                    error:
                        "Approved projects are read-only for Creator accounts.",
                },
                { status: 403 }
            );
        }

        const creatorAllowedFields: Record<
            string,
            readonly string[]
        > = {
            REQUESTED: detailFields,
            IN_PRODUCTION: [
                "title",
                "description",
                "footageLink",
                "dueDate",
            ],
            IN_REVIEW: [
                "title",
                "description",
                "dueDate",
            ],
            REVISION: [
                "title",
                "description",
                "dueDate",
            ],
            APPROVED: [],
        };

        if (isOwningCreator) {
            const allowedFields =
                creatorAllowedFields[content.status] || [];

            const blockedField =
                requestedDetailFields.find(
                    (field) =>
                        !allowedFields.includes(field)
                );

            if (blockedField) {
                return NextResponse.json(
                    {
                        error:
                            `${blockedField} cannot be changed while this project is ${content.status.toLowerCase().replaceAll("_", " ")}.`,
                    },
                    { status: 403 }
                );
            }
        }

        const updateData: {
            title?: string;
            description?: string | null;
            footageLink?: string;
            contentType?: (typeof CONTENT_TYPES)[number];
            dueDate?: Date | null;
        } = {};

        if (body.title !== undefined) {
            if (
                typeof body.title !== "string" ||
                !body.title.trim()
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Project title cannot be empty.",
                    },
                    { status: 400 }
                );
            }

            updateData.title = body.title.trim();
        }

        if (body.description !== undefined) {
            if (typeof body.description !== "string") {
                return NextResponse.json(
                    {
                        error:
                            "Project description must be text.",
                    },
                    { status: 400 }
                );
            }

            updateData.description =
                body.description.trim() || null;
        }

        if (body.footageLink !== undefined) {
            if (
                typeof body.footageLink !== "string" ||
                !isGoogleDriveFolderUrl(
                    body.footageLink.trim()
                )
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Please provide a valid Google Drive folder URL.",
                    },
                    { status: 400 }
                );
            }

            updateData.footageLink =
                body.footageLink.trim();
        }

        if (body.contentType !== undefined) {
            if (
                typeof body.contentType !== "string" ||
                !CONTENT_TYPES.includes(
                    body.contentType as
                        (typeof CONTENT_TYPES)[number]
                )
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Invalid content type.",
                    },
                    { status: 400 }
                );
            }

            updateData.contentType =
                body.contentType as
                    (typeof CONTENT_TYPES)[number];
        }

        if (body.dueDate !== undefined) {
            if (
                body.dueDate === null ||
                body.dueDate === ""
            ) {
                updateData.dueDate = null;
            } else if (typeof body.dueDate === "string") {
                const parsedDueDate =
                    new Date(body.dueDate);

                if (
                    Number.isNaN(
                        parsedDueDate.getTime()
                    )
                ) {
                    return NextResponse.json(
                        {
                            error:
                                "Invalid due date.",
                        },
                        { status: 400 }
                    );
                }

                updateData.dueDate = parsedDueDate;
            } else {
                return NextResponse.json(
                    {
                        error:
                            "Invalid due date.",
                    },
                    { status: 400 }
                );
            }
        }

        const updatedContent =
            await prisma.$transaction(
                async (tx) => {
                    const updated =
                        await tx.contentItem.update({
                            where: {
                                id: content.id,
                            },
                            data: updateData,
                        });

                    await tx.auditLog.create({
                        data: {
                            action:
                                "CONTENT_DETAILS_UPDATED",
                            resource:
                                "ContentItem",
                            resourceId:
                                content.id,
                            userId: user.id,
                            metadata: {
                                title:
                                    updateData.title ??
                                    content.title,
                                changedFields:
                                    requestedDetailFields,
                                organizationId:
                                    content.project
                                        .organizationId,
                                creatorId:
                                    content.project
                                        .creator?.id ??
                                    null,
                            },
                        },
                    });

                    return updated;
                }
            );

        return NextResponse.json({
            success: true,
            content: {
                id: updatedContent.id,
                title: updatedContent.title,
                description:
                    updatedContent.description,
                footageLink:
                    updatedContent.footageLink,
                contentType:
                    updatedContent.contentType,
                dueDate: updatedContent.dueDate,
                status: updatedContent.status,
                updatedAt:
                    updatedContent.updatedAt,
            },
        });
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
                    "Creator accounts cannot directly change production status.",
            },
            { status: 403 }
        );
    }

    const membership = user.memberships.find(
        (item) =>
            item.organizationId ===
            content.project.organizationId
    );

    if (!membership) {
        return NextResponse.json(
            {
                error:
                    "You do not have permission to change production status.",
            },
            { status: 403 }
        );
    }

    if (membership.role === "EDITOR") {
        const allowedEditorTransitions: Record<
            string,
            ContentStatusValue[]
        > = {
            REQUESTED: ["IN_PRODUCTION"],
            IN_PRODUCTION: ["IN_REVIEW"],
            REVISION: ["IN_PRODUCTION", "IN_REVIEW"],
            IN_REVIEW: [],
            APPROVED: [],
        };

        const allowedNextStatuses =
            allowedEditorTransitions[content.status] || [];

        if (!allowedNextStatuses.includes(requestedStatus)) {
            return NextResponse.json(
                {
                    error:
                        "Editors can only move assigned work through production and submit it for review.",
                },
                { status: 403 }
            );
        }
    } else if (
        membership.role !== "ADMIN" &&
        membership.role !== "MANAGER"
    ) {
        return NextResponse.json(
            {
                error:
                    "You do not have permission to change production status.",
            },
            { status: 403 }
        );
    }

    const statusChanged =
        content.status !== requestedStatus;

    if (!statusChanged) {
        return NextResponse.json({
            success: true,
            content: {
                id: content.id,
                status: content.status,
                updatedAt: content.updatedAt,
            },
        });
    }

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

            if (requestedStatus === "IN_REVIEW") {
                const latestVideoVersion =
                    await tx.assetVersion.findFirst({
                        where: {
                            asset: {
                                contentId: content.id,
                                assetType: "VIDEO",
                            },
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                        select: {
                            id: true,
                        },
                    });

                const latestAssetVersion =
                    latestVideoVersion ??
                    (await tx.assetVersion.findFirst({
                        where: {
                            asset: {
                                contentId: content.id,
                            },
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                        select: {
                            id: true,
                        },
                    }));

                const existingPendingReview =
                    await tx.review.findFirst({
                        where: {
                            contentId: content.id,
                            status: "PENDING",
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                    });

                if (!existingPendingReview) {
                    await tx.review.create({
                        data: {
                            contentId: content.id,
                            authorId: user.id,
                            status: "PENDING",
                            notes: reviewNotes || null,
                            assetVersionId:
                                latestAssetVersion?.id ?? null,
                        },
                    });
                }
            }

            if (
                requestedStatus === "APPROVED" ||
                requestedStatus === "REVISION"
            ) {
                const pendingReview =
                    await tx.review.findFirst({
                        where: {
                            contentId: content.id,
                            status: "PENDING",
                        },
                        orderBy: {
                            createdAt: "desc",
                        },
                    });

                const reviewStatus =
                    requestedStatus === "APPROVED"
                        ? "APPROVED"
                        : "REVISION_REQUESTED";

                if (pendingReview) {
                    await tx.review.update({
                        where: {
                            id: pendingReview.id,
                        },
                        data: {
                            status: reviewStatus,
                            ...(reviewNotes
                                ? { notes: reviewNotes }
                                : {}),
                        },
                    });
                } else {
                    const latestVideoVersion =
                        await tx.assetVersion.findFirst({
                            where: {
                                asset: {
                                    contentId: content.id,
                                    assetType: "VIDEO",
                                },
                            },
                            orderBy: {
                                createdAt: "desc",
                            },
                            select: {
                                id: true,
                            },
                        });

                    const latestAssetVersion =
                        latestVideoVersion ??
                        (await tx.assetVersion.findFirst({
                            where: {
                                asset: {
                                    contentId: content.id,
                                },
                            },
                            orderBy: {
                                createdAt: "desc",
                            },
                            select: {
                                id: true,
                            },
                        }));

                    await tx.review.create({
                        data: {
                            contentId: content.id,
                            authorId: user.id,
                            status: reviewStatus,
                            notes: reviewNotes || null,
                            assetVersionId:
                                latestAssetVersion?.id ?? null,
                        },
                    });
                }
            }

            await tx.auditLog.create({
                data: {
                    action: "CONTENT_STATUS_CHANGED",
                    resource: "ContentItem",
                    resourceId: content.id,
                    userId: user.id,
                    metadata: {
                        title: content.title,
                        previousStatus: content.status,
                        newStatus: requestedStatus,
                        organizationId:
                            content.project.organizationId,
                        creatorId:
                            content.project.creator?.id ?? null,
                    },
                },
            });

            return updated;
        }
    );

    const creatorId =
        content.project.creator?.id ?? null;

    const creatorUserId =
        await getCreatorAccountUserId(creatorId);

    if (requestedStatus === "IN_REVIEW") {
        await notifyUsers(
            [creatorUserId],
            "Project ready for review",
            `${content.title} is ready for your review.`,
            user.id
        );
    }

    if (
        requestedStatus === "APPROVED" ||
        requestedStatus === "REVISION"
    ) {
        const assignedEditorUserIds =
            await getAssignedEditorUserIds(
                content.id
            );

        const managementUserIds =
            requestedStatus === "APPROVED"
                ? await getManagementUserIds(
                      content.project.organizationId
                  )
                : [];

        await notifyUsers(
            [
                ...assignedEditorUserIds,
                ...managementUserIds,
                creatorUserId,
            ],
            requestedStatus === "APPROVED"
                ? "Project approved"
                : "Revision requested",
            requestedStatus === "APPROVED"
                ? `${content.title} was approved.`
                : `${content.title} needs another revision.`,
            user.id
        );
    }

    return NextResponse.json({
        success: true,
        content: {
            id: updatedContent.id,
            status: updatedContent.status,
            updatedAt: updatedContent.updatedAt,
        },
    });
}

// DELETE /api/projects/[projectId]
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { projectId } = await params;
        const content = await getAccessibleContent(
            projectId,
            user
        );

        if (!content) {
            return NextResponse.json(
                {
                    error:
                        "Project not found or access denied.",
                },
                { status: 404 }
            );
        }

        if (user.accountType !== "CREATOR") {
            const membership = user.memberships.find(
                (item) =>
                    item.organizationId ===
                    content.project.organizationId
            );

            if (
                !membership ||
                (membership.role !== "ADMIN" &&
                    membership.role !== "MANAGER")
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Only the owning Creator, Admins, and Managers can delete projects.",
                    },
                    { status: 403 }
                );
            }
        }

        const storageKeys = content.assets.flatMap(
            (asset) => [
                asset.storageKey,
                ...asset.versions.map(
                    (version) => version.storageKey
                ),
            ]
        );

        await deleteR2Objects(storageKeys);

        await prisma.$transaction(async (tx) => {
            await tx.auditLog.create({
                data: {
                    action: "CONTENT_DELETED",
                    resource: "ContentItem",
                    resourceId: content.id,
                    userId: user.id,
                    metadata: {
                        title: content.title,
                        organizationId:
                            content.project.organizationId,
                        creatorId:
                            content.project.creator?.id ?? null,
                        projectId:
                            content.project.id,
                    },
                },
            });

            await tx.contentItem.delete({
                where: {
                    id: content.id,
                },
            });
        });

        return NextResponse.json({
            success: true,
            deletedProjectId: content.id,
        });
    } catch (error) {
        console.error(
            "DELETE /api/projects/[projectId] failed:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to delete project.",
            },
            { status: 500 }
        );
    }
}

