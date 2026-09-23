import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";

type RouteContext = {
    params: Promise<{
        assetId: string;
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

async function getAccessibleAsset(
    assetId: string,
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >
) {
    const includeData = {
        content: {
            select: {
                id: true,
                title: true,
                contentType: true,

                project: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        creatorId: true,
                    },
                },
            },
        },

        uploadedBy: {
            select: {
                id: true,
                name: true,
                email: true,
            },
        },

        versions: {
            orderBy: {
                version: "desc" as const,
            },
        },
    };

    /*
     * Creator accounts may only access assets belonging to
     * their own creator profile.
     */
    if (user.accountType === "CREATOR") {
        if (!user.creatorProfile) {
            return null;
        }

        return prisma.asset.findFirst({
            where: {
                id: assetId,

                content: {
                    project: {
                        organizationId:
                            user.creatorProfile.organizationId,
                        creatorId:
                            user.creatorProfile.id,
                    },
                },
            },

            include: includeData,
        });
    }

    /*
     * ADMIN / MANAGER have organization-wide access.
     */
    const fullAccessOrganizationIds =
        user.memberships
            .filter(
                (membership) =>
                    membership.role === "ADMIN" ||
                    membership.role === "MANAGER"
            )
            .map(
                (membership) =>
                    membership.organizationId
            );

    if (fullAccessOrganizationIds.length > 0) {
        const asset =
            await prisma.asset.findFirst({
                where: {
                    id: assetId,

                    content: {
                        project: {
                            organizationId: {
                                in: fullAccessOrganizationIds,
                            },
                        },
                    },
                },

                include: includeData,
            });

        if (asset) {
            return asset;
        }
    }

    /*
     * EDITOR access is limited to assigned projects.
     */
    const editorOrganizationIds =
        user.memberships
            .filter(
                (membership) =>
                    membership.role === "EDITOR"
            )
            .map(
                (membership) =>
                    membership.organizationId
            );

    if (editorOrganizationIds.length === 0) {
        return null;
    }

    return prisma.asset.findFirst({
        where: {
            id: assetId,

            content: {
                project: {
                    organizationId: {
                        in: editorOrganizationIds,
                    },
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
        },

        include: includeData,
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

        const { assetId } = await context.params;

        const asset =
            await getAccessibleAsset(assetId, user);

        if (!asset) {
            return NextResponse.json(
                {
                    error:
                        "Asset not found or access denied.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            asset: {
                ...asset,
                fileSize:
                    asset.fileSize?.toString() ?? null,

                versions: asset.versions.map(
                    (version) => ({
                        ...version,
                        fileSize:
                            version.fileSize?.toString() ??
                            null,
                    })
                ),
            },
        });
    } catch (error) {
        console.error(
            "GET /api/assets/[assetId] failed:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to load asset.",
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

        const { assetId } = await context.params;

        const asset =
            await getAccessibleAsset(assetId, user);

        if (!asset) {
            return NextResponse.json(
                {
                    error:
                        "Asset not found or access denied.",
                },
                { status: 404 }
            );
        }

        const storageKeys = Array.from(
            new Set([
                asset.storageKey,
                ...asset.versions.map(
                    (version) =>
                        version.storageKey
                ),
            ])
        ).filter(Boolean);

        if (storageKeys.length > 0) {
            await getR2Client().send(
                new DeleteObjectsCommand({
                    Bucket:
                        getR2BucketName(),
                    Delete: {
                        Objects:
                            storageKeys.map(
                                (Key) => ({
                                    Key,
                                })
                            ),
                        Quiet: true,
                    },
                })
            );
        }

        await prisma.$transaction(
            async (tx) => {
                await tx.auditLog.create({
                    data: {
                        action:
                            "ASSET_DELETED",
                        resource:
                            "Asset",
                        resourceId:
                            asset.id,
                        userId: user.id,
                        metadata: {
                            organizationId:
                                asset.content
                                    .project
                                    .organizationId,
                            creatorId:
                                asset.content
                                    .project
                                    .creatorId,
                            contentId:
                                asset.content.id,
                            contentTitle:
                                asset.content.title,
                            assetId:
                                asset.id,
                            fileName:
                                asset.fileName,
                            assetType:
                                asset.assetType,
                        },
                    },
                });

                await tx.asset.delete({
                    where: {
                        id: assetId,
                    },
                });
            }
        );

        return NextResponse.json({
            success: true,
            deletedAssetId: assetId,
        });
    } catch (error) {
        console.error(
            "DELETE /api/assets/[assetId] failed:",
            error
        );

        return NextResponse.json(
            {
                error: "Failed to delete asset.",
            },
            { status: 500 }
        );
    }
}
