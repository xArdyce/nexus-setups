import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Metadata = Record<string, unknown>;

function asMetadata(value: unknown): Metadata {
    if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    ) {
        return value as Metadata;
    }

    return {};
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
    return typeof value === "number" &&
        Number.isFinite(value)
        ? value
        : null;
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

function sanitizeMetadata(metadata: Metadata) {
    return {
        title: stringValue(metadata.title),
        contentTitle: stringValue(metadata.contentTitle),
        creatorName: stringValue(metadata.creatorName),
        editorName: stringValue(metadata.editorName),
        previousStatus: stringValue(
            metadata.previousStatus
        ),
        newStatus: stringValue(metadata.newStatus),
        timestamp: numberValue(metadata.timestamp),
    };
}

// GET /api/activity?organizationId=...&limit=12
export async function GET(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);

        const requestedOrganizationId =
            searchParams.get("organizationId");

        const requestedLimit = Number(
            searchParams.get("limit") || "12"
        );

        const limit = Number.isFinite(requestedLimit)
            ? Math.min(
                  Math.max(Math.floor(requestedLimit), 1),
                  50
              )
            : 12;

        let organizationId: string;
        let membershipRole: string | null = null;

        if (user.accountType === "CREATOR") {
            if (!user.creatorProfile) {
                return NextResponse.json(
                    {
                        error:
                            "Your creator account is not linked to a creator profile yet.",
                    },
                    { status: 403 }
                );
            }

            organizationId =
                user.creatorProfile.organizationId;

            if (
                requestedOrganizationId &&
                requestedOrganizationId !==
                    organizationId
            ) {
                return NextResponse.json(
                    {
                        error:
                            "You do not have access to this organization.",
                    },
                    { status: 403 }
                );
            }
        } else {
            const membership =
                requestedOrganizationId
                    ? user.memberships.find(
                          (item) =>
                              item.organizationId ===
                              requestedOrganizationId
                      )
                    : user.memberships[0];

            if (!membership) {
                return NextResponse.json(
                    {
                        error:
                            "You do not have access to this organization.",
                    },
                    { status: 403 }
                );
            }

            organizationId =
                membership.organizationId;
            membershipRole = membership.role;
        }

        const logs = await prisma.auditLog.findMany({
            where: {
                metadata: {
                    path: ["organizationId"],
                    equals: organizationId,
                },
            },
            select: {
                id: true,
                action: true,
                resource: true,
                resourceId: true,
                metadata: true,
                createdAt: true,

                user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            take: Math.max(limit * 10, 100),
        });

        let visibleLogs = logs;

        if (user.accountType === "CREATOR") {
            const creatorId =
                user.creatorProfile!.id;

            const ownContent =
                await prisma.contentItem.findMany({
                    where: {
                        project: {
                            organizationId,
                            creatorId,
                        },
                    },
                    select: {
                        id: true,
                    },
                });

            const ownContentIds = new Set(
                ownContent.map((item) => item.id)
            );

            visibleLogs = logs.filter((log) => {
                const metadata = asMetadata(
                    log.metadata
                );

                const metadataCreatorId =
                    stringValue(metadata.creatorId);

                const metadataContentId =
                    stringValue(metadata.contentId);

                return (
                    metadataCreatorId === creatorId ||
                    (metadataContentId
                        ? ownContentIds.has(
                              metadataContentId
                          )
                        : false) ||
                    (log.resource === "ContentItem" &&
                    log.resourceId
                        ? ownContentIds.has(
                              log.resourceId
                          )
                        : false)
                );
            });
        } else if (membershipRole === "EDITOR") {
            const [
                accessibleContent,
                directCreatorAssignments,
            ] = await Promise.all([
                prisma.contentItem.findMany({
                    where: {
                        project: {
                            organizationId,
                        },

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
                                        editorAssignments:
                                            {
                                                some: {
                                                    userId:
                                                        user.id,
                                                },
                                            },
                                    },
                                },
                            },
                        ],
                    },
                    select: {
                        id: true,
                        project: {
                            select: {
                                creatorId: true,
                            },
                        },
                    },
                }),

                prisma.creatorAssignment.findMany({
                    where: {
                        userId: user.id,
                        creator: {
                            organizationId,
                        },
                    },
                    select: {
                        creatorId: true,
                    },
                }),
            ]);

            const accessibleContentIds = new Set(
                accessibleContent.map(
                    (item) => item.id
                )
            );

            const accessibleCreatorIds = new Set(
                [
                    ...accessibleContent
                        .map(
                            (item) =>
                                item.project.creatorId
                        )
                        .filter(
                            (
                                creatorId
                            ): creatorId is string =>
                                Boolean(creatorId)
                        ),

                    ...directCreatorAssignments.map(
                        (assignment) =>
                            assignment.creatorId
                    ),
                ]
            );

            visibleLogs = logs.filter((log) => {
                const metadata = asMetadata(
                    log.metadata
                );

                const metadataContentId =
                    stringValue(metadata.contentId);

                const metadataCreatorId =
                    stringValue(metadata.creatorId);

                return (
                    (metadataContentId
                        ? accessibleContentIds.has(
                              metadataContentId
                          )
                        : false) ||
                    (metadataCreatorId
                        ? accessibleCreatorIds.has(
                              metadataCreatorId
                          )
                        : false) ||
                    (log.resource === "ContentItem" &&
                    log.resourceId
                        ? accessibleContentIds.has(
                              log.resourceId
                          )
                        : false)
                );
            });
        } else if (
            membershipRole !== "ADMIN" &&
            membershipRole !== "MANAGER"
        ) {
            visibleLogs = [];
        }

        const activity = visibleLogs
            .slice(0, limit)
            .map((log) => ({
                id: log.id,
                action: log.action,
                resource: log.resource,
                resourceId: log.resourceId,
                createdAt: log.createdAt,
                actorName:
                    log.user?.name || "Nexus user",
                metadata: sanitizeMetadata(
                    asMetadata(log.metadata)
                ),
            }));

        return NextResponse.json({
            activity,
            organizationId,
        });
    } catch (error) {
        console.error(
            "GET /api/activity failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load system activity.",
            },
            { status: 500 }
        );
    }
}
