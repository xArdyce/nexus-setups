import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
    params: Promise<{
        assetId: string;
    }>;
};

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const { assetId } = await context.params;

        const asset = await prisma.asset.findUnique({
            where: {
                id: assetId,
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

                uploadedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },

                versions: {
                    orderBy: {
                        version: "desc",
                    },
                },
            },
        });

        if (!asset) {
            return NextResponse.json(
                {
                    error: "Asset not found.",
                },
                { status: 404 }
            );
        }

        return NextResponse.json({
            asset: {
                ...asset,
                fileSize: asset.fileSize?.toString() ?? null,

                versions: asset.versions.map((version) => ({
                    ...version,
                    fileSize:
                        version.fileSize?.toString() ?? null,
                })),
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
        const { assetId } = await context.params;

        const asset = await prisma.asset.findUnique({
            where: {
                id: assetId,
            },

            include: {
                content: {
                    select: {
                        project: {
                            select: {
                                organizationId: true,
                            },
                        },
                    },
                },
            },
        });

        if (!asset) {
            return NextResponse.json(
                {
                    error: "Asset not found.",
                },
                { status: 404 }
            );
        }

        await prisma.asset.delete({
            where: {
                id: assetId,
            },
        });

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