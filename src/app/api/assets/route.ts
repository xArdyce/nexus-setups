import { NextResponse } from "next/server";
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

export async function GET(request: Request) {
    try {
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