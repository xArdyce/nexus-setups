import { logServerError } from "@/lib/server-log";
import type { Prisma } from "@/generated/prisma/client";
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

        if (user.memberships.some((member) => member.role === "CREATOR" && member.organizationId === user.creatorProfile?.organizationId)) {
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
                                  ...(ASSET_TYPES.includes(search.toUpperCase() as AssetTypeValue)
                                      ? [{ assetType: { equals: search.toUpperCase() as AssetTypeValue } }]
                                      : []),
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
                              ...(ASSET_TYPES.includes(search.toUpperCase() as AssetTypeValue)
                                  ? [{ assetType: { equals: search.toUpperCase() as AssetTypeValue } }]
                                  : []),
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
        logServerError("GET /api/assets failed:", error);

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
    if (user.memberships.some((member) => member.role === "CREATOR" && member.organizationId === user.creatorProfile?.organizationId)) {
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
            ...(versionTarget ? ["assets", versionTarget.id, "versions"] : []),
            "",
        ].join("/");

        const keyLeaf = storageKey.slice(requiredPrefix.length);
        if (!storageKey.startsWith(requiredPrefix) || !keyLeaf || keyLeaf.includes("/") || /[\\\x00-\x1f]/.test(keyLeaf) || keyLeaf === "." || keyLeaf === ".." || storageKey.length > 1024) {
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

        const actualFileSize = head.ContentLength;
        const actualMimeType = head.ContentType?.trim().toLowerCase();
        if (typeof actualFileSize !== "number" || !Number.isSafeInteger(actualFileSize) || actualFileSize <= 0 || actualFileSize > 5 * 1024 ** 3) {
            return NextResponse.json({ error: "Uploaded object must contain 1 byte to 5 GiB." }, { status: 400 });
        }
        if (!actualMimeType || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(actualMimeType)) {
            return NextResponse.json({ error: "Uploaded object has an invalid Content-Type." }, { status: 400 });
        }
        if (Number.isFinite(requestedFileSize) && requestedFileSize !== actualFileSize) {
            return NextResponse.json({ error: "Uploaded object size does not match the registration." }, { status: 400 });
        }
        const mediaPrefix = { VIDEO: "video/", IMAGE: "image/", AUDIO: "audio/" };
        const targetType = versionTarget?.assetType ?? assetType;
        if (targetType in mediaPrefix && !actualMimeType.startsWith(mediaPrefix[targetType as keyof typeof mediaPrefix])) {
            return NextResponse.json({ error: "Uploaded Content-Type does not match the asset type." }, { status: 400 });
        }

        // Recheck after obtaining the same lock used by every registration/deletion.
        const checkRegistration = async (tx: Prisma.TransactionClient) => {
            const current = await tx.contentItem.findUnique({ where: { id: content.id }, select: { id: true } });
            if (!current) throw Object.assign(new Error("Project removed"), { response: NextResponse.json({ error: "Project no longer exists." }, { status: 409 }) });
            const registered = await tx.assetVersion.findFirst({ where: { storageKey }, select: { id: true } });
            const currentObject = await tx.asset.findUnique({ where: { storageKey }, select: { id: true } });
            if (registered || currentObject) throw Object.assign(new Error("Object already registered"), { response: NextResponse.json({ error: "This uploaded object has already been registered." }, { status: 409 }) });
        };

        if (versionTarget) {
            const updatedAsset =
                await prisma.$transaction(
                    async (tx) => {
                        await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${content.id} FOR UPDATE`;
                        await checkRegistration(tx);
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
                    await tx.$queryRaw`SELECT id FROM "ContentItem" WHERE id = ${content.id} FOR UPDATE`;
                    await checkRegistration(tx);
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
        if (error && typeof error === "object" && "response" in error && error.response instanceof Response) return error.response;
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "This upload has already been registered." }, { status: 409 });
        logServerError(
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

