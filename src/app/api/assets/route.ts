import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";

function serializeAsset(asset: {
    id: string;
    fileName: string;
    fileSize: bigint | null;
    mimeType: string | null;
    storageKey: string;
    assetType: string;
    contentId: string;
    uploadedById: string;
    createdAt: Date;
    updatedAt: Date;
    versions: {
        id: string;
        version: number;
        storageKey: string;
        fileName: string;
        fileSize: bigint | null;
        mimeType: string | null;
        createdAt: Date;
    }[];
    content: {
        id: string;
        title: string;
        contentType: string;
        project: {
            id: string;
            name: string;
            organizationId: string;
        };
    };
}) {
    return {
        id: asset.id,
        fileName: asset.fileName,
        fileSize: asset.fileSize?.toString() ?? null,
        mimeType: asset.mimeType,
        storageKey: asset.storageKey,
        assetType: asset.assetType,
        contentId: asset.contentId,
        uploadedById: asset.uploadedById,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
        latestVersion:
            asset.versions[0]?.version ?? 1,
        versions: asset.versions.map((version) => ({
            id: version.id,
            version: version.version,
            storageKey: version.storageKey,
            fileName: version.fileName,
            fileSize:
                version.fileSize?.toString() ?? null,
            mimeType: version.mimeType,
            createdAt: version.createdAt,
        })),

        content: {
            id: asset.content.id,
            title: asset.content.title,
            contentType: asset.content.contentType,
        },

        project: {
            id: asset.content.project.id,
            name: asset.content.project.name,
            organizationId: asset.content.project.organizationId,
        },
    };
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

        const organizationId =
            searchParams.get("organizationId")?.trim() || "";

        const projectId =
            searchParams.get("projectId")?.trim() || "";

        const search =
            searchParams.get("search")?.trim() || "";

        if (!organizationId) {
            return NextResponse.json(
                {
                    error: "organizationId is required.",
                },
                { status: 400 }
            );
        }

        /*
         * ============================================================
         * CREATOR ACCESS
         * ============================================================
         *
         * Creators may only see assets belonging to their own
         * creator profile and organization.
         */
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

            if (
                organizationId !==
                user.creatorProfile.organizationId
            ) {
                return NextResponse.json(
                    {
                        error:
                            "You do not have access to this organization.",
                    },
                    { status: 403 }
                );
            }

            const assets = await prisma.asset.findMany({
                where: {
                    content: {
                        project: {
                            organizationId:
                                user.creatorProfile.organizationId,
                            creatorId:
                                user.creatorProfile.id,

                            ...(projectId
                                ? {
                                      id: projectId,
                                  }
                                : {}),
                        },
                    },

                    ...(search
                        ? {
                              OR: [
                                  {
                                      fileName: {
                                          contains: search,
                                          mode: "insensitive",
                                      },
                                  },
                                  {
                                      mimeType: {
                                          contains: search,
                                          mode: "insensitive",
                                      },
                                  },
                                  {
                                      assetType: {
                                          equals: search.toUpperCase() as
                                              | "VIDEO"
                                              | "IMAGE"
                                              | "AUDIO"
                                              | "DOCUMENT"
                                              | "OTHER",
                                      },
                                  },
                                  {
                                      content: {
                                          title: {
                                              contains: search,
                                              mode: "insensitive",
                                          },
                                      },
                                  },
                              ],
                          }
                        : {}),
                },

                include: {
                    versions: {
                        orderBy: {
                            version: "desc",
                        },
                    },
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
                                },
                            },
                        },
                    },
                },

                orderBy: {
                    createdAt: "desc",
                },
            });

            return NextResponse.json({
                assets: assets.map(serializeAsset),
            });
        }

        /*
         * ============================================================
         * ADMIN / MANAGER / EDITOR ACCESS
         * ============================================================
         *
         * ADMIN / MANAGER:
         *   All assets in their organization.
         *
         * EDITOR:
         *   Only assets from projects assigned to that Editor.
         */
        const membership = user.memberships.find(
            (item) =>
                item.organizationId === organizationId
        );

        if (!membership) {
            return NextResponse.json(
                {
                    error:
                        "You do not have access to this organization.",
                },
                { status: 403 }
            );
        }

        const canSeeAllAssets =
            membership.role === "ADMIN" ||
            membership.role === "MANAGER";

        const isEditor =
            membership.role === "EDITOR";

        if (!canSeeAllAssets && !isEditor) {
            return NextResponse.json({
                assets: [],
            });
        }

        const assets = await prisma.asset.findMany({
            where: {
                content: {
                    project: {
                        organizationId,

                        ...(projectId
                            ? {
                                  id: projectId,
                              }
                            : {}),
                    },

                    ...(isEditor
                        ? {
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
                          }
                        : {}),
                },

                ...(search
                    ? {
                          OR: [
                              {
                                  fileName: {
                                      contains: search,
                                      mode: "insensitive",
                                  },
                              },
                              {
                                  mimeType: {
                                      contains: search,
                                      mode: "insensitive",
                                  },
                              },
                              {
                                  assetType: {
                                      equals: search.toUpperCase() as
                                          | "VIDEO"
                                          | "IMAGE"
                                          | "AUDIO"
                                          | "DOCUMENT"
                                          | "OTHER",
                                  },
                              },
                              {
                                  content: {
                                      title: {
                                          contains: search,
                                          mode: "insensitive",
                                      },
                                  },
                              },
                          ],
                      }
                    : {}),
            },

            include: {
                versions: {
                    orderBy: {
                        version: "desc",
                    },
                },
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
                            },
                        },
                    },
                },
            },

            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json({
            assets: assets.map(serializeAsset),
        });
    } catch (error) {
        console.error("GET /api/assets failed:", error);

        return NextResponse.json(
            {
                error: "Failed to load assets.",
            },
            { status: 500 }
        );
    }
}

const ASSET_TYPES = [
    "VIDEO",
    "IMAGE",
    "AUDIO",
    "DOCUMENT",
    "OTHER",
] as const;

type AssetTypeValue =
    (typeof ASSET_TYPES)[number];

async function getUploadableContent(
    contentId: string,
    user: NonNullable<
        Awaited<
            ReturnType<
                typeof getAuthenticatedUser
            >
        >
    >
) {
    if (user.accountType === "CREATOR") {
        if (!user.creatorProfile) {
            return null;
        }

        return prisma.contentItem.findFirst({
            where: {
                id: contentId,
                project: {
                    organizationId:
                        user.creatorProfile
                            .organizationId,
                    creatorId:
                        user.creatorProfile.id,
                },
            },
            select: {
                id: true,
                title: true,
                project: {
                    select: {
                        organizationId: true,
                        creatorId: true,
                    },
                },
            },
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

    return prisma.contentItem.findFirst({
        where: {
            id: contentId,

            OR: [
                ...(fullAccessOrganizationIds.length >
                0
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

                ...(editorOrganizationIds.length >
                0
                    ? [
                          {
                              AND: [
                                  {
                                      project: {
                                          organizationId:
                                              {
                                                  in: editorOrganizationIds,
                                              },
                                      },
                                  },
                                  {
                                      OR: [
                                          {
                                              editorAssignments:
                                                  {
                                                      some: {
                                                          userId:
                                                              user.id,
                                                      },
                                                  },
                                          },
                                          {
                                              project: {
                                                  creator:
                                                      {
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
                              ],
                          },
                      ]
                    : []),
            ],
        },

        select: {
            id: true,
            title: true,
            project: {
                select: {
                    organizationId: true,
                    creatorId: true,
                },
            },
        },
    });
}

// POST /api/assets
//
// Finalizes an object already uploaded directly to R2.
export async function POST(request: Request) {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        let body: {
            contentId?: unknown;
            assetId?: unknown;
            storageKey?: unknown;
            fileName?: unknown;
            fileSize?: unknown;
            mimeType?: unknown;
            assetType?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    error:
                        "Invalid JSON body.",
                },
                { status: 400 }
            );
        }

        const contentId = String(
            body.contentId || ""
        ).trim();

        const assetId = String(
            body.assetId || ""
        ).trim();

        const storageKey = String(
            body.storageKey || ""
        ).trim();

        const fileName = String(
            body.fileName || ""
        ).trim();

        const mimeType =
            String(
                body.mimeType ||
                    "application/octet-stream"
            ).trim() ||
            "application/octet-stream";

        const assetType = String(
            body.assetType || ""
        ).trim() as AssetTypeValue;

        const requestedFileSize =
            Number(body.fileSize);

        if (
            !contentId ||
            !storageKey ||
            !fileName ||
            !ASSET_TYPES.includes(
                assetType
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "contentId, storageKey, fileName, and a valid assetType are required.",
                },
                { status: 400 }
            );
        }

        const content =
            await getUploadableContent(
                contentId,
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

        const versionTarget = assetId
            ? await prisma.asset.findFirst({
                  where: {
                      id: assetId,
                      contentId: content.id,
                  },
                  select: {
                      id: true,
                      assetType: true,
                  },
              })
            : null;

        if (assetId && !versionTarget) {
            return NextResponse.json(
                {
                    error:
                        "Asset not found in this project or access denied.",
                },
                { status: 404 }
            );
        }

        const requiredPrefix = [
            "organizations",
            content.project.organizationId,
            "content",
            content.id,
            "",
        ].join("/");

        if (
            !storageKey.startsWith(
                requiredPrefix
            )
        ) {
            return NextResponse.json(
                {
                    error:
                        "Invalid R2 storage key for this project.",
                },
                { status: 400 }
            );
        }

        const [existingAsset, existingVersion] =
            await Promise.all([
                prisma.asset.findUnique({
                    where: {
                        storageKey,
                    },
                    select: {
                        id: true,
                    },
                }),
                prisma.assetVersion.findFirst({
                    where: {
                        storageKey,
                    },
                    select: {
                        id: true,
                    },
                }),
            ]);

        if (existingAsset || existingVersion) {
            return NextResponse.json(
                {
                    error:
                        "This uploaded object has already been registered.",
                },
                { status: 409 }
            );
        }

        const head =
            await getR2Client().send(
                new HeadObjectCommand({
                    Bucket:
                        getR2BucketName(),
                    Key: storageKey,
                })
            );

        const actualFileSize =
            typeof head.ContentLength ===
            "number"
                ? head.ContentLength
                : Number.isFinite(
                      requestedFileSize
                  )
                ? requestedFileSize
                : null;

        const actualMimeType =
            head.ContentType ||
            mimeType ||
            null;

        if (versionTarget) {
            const updatedAsset =
                await prisma.$transaction(
                    async (tx) => {
                        const latestVersion =
                            await tx.assetVersion.findFirst({
                                where: {
                                    assetId: versionTarget.id,
                                },
                                orderBy: {
                                    version: "desc",
                                },
                                select: {
                                    version: true,
                                },
                            });

                        const nextVersion =
                            (latestVersion?.version ?? 0) + 1;

                        await tx.assetVersion.create({
                            data: {
                                version: nextVersion,
                                storageKey,
                                fileName,
                                fileSize:
                                    actualFileSize !== null
                                        ? BigInt(actualFileSize)
                                        : null,
                                mimeType: actualMimeType,
                                assetId: versionTarget.id,
                            },
                        });

                        const asset =
                            await tx.asset.update({
                                where: {
                                    id: versionTarget.id,
                                },
                                data: {
                                    fileName,
                                    fileSize:
                                        actualFileSize !== null
                                            ? BigInt(actualFileSize)
                                            : null,
                                    mimeType: actualMimeType,
                                    storageKey,
                                },
                                include: {
                                    versions: {
                                        orderBy: {
                                            version: "desc",
                                        },
                                    },
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
                                                },
                                            },
                                        },
                                    },
                                },
                            });

                        await tx.auditLog.create({
                            data: {
                                action:
                                    "ASSET_VERSION_UPLOADED",
                                resource: "Asset",
                                resourceId: asset.id,
                                userId: user.id,
                                metadata: {
                                    organizationId:
                                        content.project.organizationId,
                                    creatorId:
                                        content.project.creatorId,
                                    contentId: content.id,
                                    contentTitle: content.title,
                                    assetId: asset.id,
                                    fileName,
                                    assetType:
                                        versionTarget.assetType,
                                    version: nextVersion,
                                    fileSize: actualFileSize,
                                },
                            },
                        });

                        return asset;
                    }
                );

            return NextResponse.json(
                {
                    asset:
                        serializeAsset(
                            updatedAsset
                        ),
                },
                { status: 201 }
            );
        }

        const created =
            await prisma.$transaction(
                async (tx) => {
                    const asset =
                        await tx.asset.create({
                            data: {
                                fileName,
                                fileSize:
                                    actualFileSize !== null
                                        ? BigInt(actualFileSize)
                                        : null,
                                mimeType: actualMimeType,
                                storageKey,
                                assetType,
                                contentId: content.id,
                                uploadedById: user.id,
                            },
                            include: {
                                versions: true,
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
                                            },
                                        },
                                    },
                                },
                            },
                        });

                    const initialVersion =
                        await tx.assetVersion.create({
                            data: {
                                version: 1,
                                storageKey,
                                fileName,
                                fileSize:
                                    actualFileSize !== null
                                        ? BigInt(actualFileSize)
                                        : null,
                                mimeType: actualMimeType,
                                assetId: asset.id,
                            },
                        });

                    await tx.auditLog.create({
                        data: {
                            action: "ASSET_UPLOADED",
                            resource: "Asset",
                            resourceId: asset.id,
                            userId: user.id,
                            metadata: {
                                organizationId:
                                    content.project.organizationId,
                                creatorId:
                                    content.project.creatorId,
                                contentId: content.id,
                                contentTitle: content.title,
                                assetId: asset.id,
                                fileName,
                                assetType,
                                fileSize: actualFileSize,
                            },
                        },
                    });

                    return {
                        ...asset,
                        versions: [initialVersion],
                    };
                }
            );

        return NextResponse.json(
            {
                asset:
                    serializeAsset(
                        created
                    ),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "POST /api/assets failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to register the uploaded asset.",
            },
            { status: 500 }
        );
    }
}

