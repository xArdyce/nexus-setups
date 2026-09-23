import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getR2BucketName,
    getR2Client,
} from "@/lib/r2";

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

        return prisma.asset.findFirst({
            where: {
                id: assetId,
                content: {
                    project: {
                        organizationId:
                            user.creatorProfile
                                .organizationId,
                        creatorId:
                            user.creatorProfile.id,
                    },
                },
            },
            select: {
                id: true,
                fileName: true,
                mimeType: true,
                storageKey: true,
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

    return prisma.asset.findFirst({
        where: {
            id: assetId,

            OR: [
                ...(fullAccessOrganizationIds.length >
                0
                    ? [
                          {
                              content: {
                                  project: {
                                      organizationId:
                                          {
                                              in: fullAccessOrganizationIds,
                                          },
                                  },
                              },
                          },
                      ]
                    : []),

                ...(editorOrganizationIds.length >
                0
                    ? [
                          {
                              content: {
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
                          },
                      ]
                    : []),
            ],
        },
        select: {
            id: true,
            fileName: true,
            mimeType: true,
            storageKey: true,
        },
    });
}

function safeDispositionFileName(
    fileName: string
) {
    return fileName
        .replace(/[\r\n"]/g, "_")
        .slice(0, 180);
}

// GET /api/assets/[assetId]/download?mode=inline|attachment
export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const user =
            await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { assetId } =
            await context.params;

        const asset =
            await getAccessibleAsset(
                assetId,
                user
            );

        if (!asset) {
            return NextResponse.json(
                {
                    error:
                        "Asset not found or access denied.",
                },
                { status: 404 }
            );
        }

        const { searchParams } =
            new URL(request.url);

        const mode =
            searchParams.get("mode") ===
            "inline"
                ? "inline"
                : "attachment";

        const command =
            new GetObjectCommand({
                Bucket:
                    getR2BucketName(),
                Key: asset.storageKey,
                ResponseContentType:
                    asset.mimeType ||
                    undefined,
                ResponseContentDisposition:
                    `${mode}; filename="${safeDispositionFileName(
                        asset.fileName
                    )}"`,
            });

        const signedUrl =
            await getSignedUrl(
                getR2Client(),
                command,
                {
                    expiresIn: 5 * 60,
                }
            );

        return NextResponse.redirect(
            signedUrl
        );
    } catch (error) {
        console.error(
            "GET /api/assets/[assetId]/download failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to prepare this asset.",
            },
            { status: 500 }
        );
    }
}
