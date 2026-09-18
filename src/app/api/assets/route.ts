import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
