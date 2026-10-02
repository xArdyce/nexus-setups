import { logServerError } from "@/lib/server-log";
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

    if (user.memberships.some((member) => member.role === "CREATOR" && member.organizationId === user.creatorProfile?.organizationId)) {
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
        logServerError(
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

        await prisma.$transaction(
            async (tx) => {
                await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${asset.content.id} FOR UPDATE`;
                const currentAsset = await tx.asset.findUnique({ where: { id: asset.id }, include: { versions: true } });
                if (!currentAsset) throw new Error("Asset no longer exists.");
                const boundReview = await tx.review.findFirst({
                    where: { assetVersion: { assetId: asset.id } }, select: { id: true },
                });
                if (boundReview) {
                    throw Object.assign(new Error("Asset is reviewed"), { response: NextResponse.json({ error: "Assets referenced by reviews cannot be deleted. Delete the project to remove its history." }, { status: 409 }) });
                }

                const storageKeys = Array.from(
                    new Set([
                        currentAsset.storageKey,
                        ...currentAsset.versions.map(
                            (version) =>
                                version.storageKey
                        ),
                    ])
                ).filter(Boolean);

                for (let index = 0; index < storageKeys.length; index += 1000) {
                    const result = await getR2Client().send(
                        new DeleteObjectsCommand({
                            Bucket:
                                getR2BucketName(),
                            Delete: {
                                Objects:
                                    storageKeys.slice(index, index + 1000).map(
                                        (Key) => ({
                                            Key,
                                        })
                                    ),
                                Quiet: true,
                            },
                        })
                    );
                    if (result.Errors?.length) throw new Error("R2 object deletion failed.");
                }

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
            },
            { timeout: 60_000 }
        );

        return NextResponse.json({
            success: true,
            deletedAssetId: assetId,
        });
    } catch (error) {
        if (error && typeof error === "object" && "response" in error && error.response instanceof Response) return error.response;
        logServerError(
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
