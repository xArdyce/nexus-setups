import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getR2BucketName,
    getR2Client,
    sanitizeR2FileName,
} from "@/lib/r2";

const MAX_SINGLE_UPLOAD_BYTES =
    5 * 1024 * 1024 * 1024;

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

async function getAccessibleContent(
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

// POST /api/assets/upload-url
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
            fileName?: unknown;
            fileSize?: unknown;
            mimeType?: unknown;
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

        const fileName = String(
            body.fileName || ""
        ).trim();

        const mimeType =
            String(
                body.mimeType ||
                    "application/octet-stream"
            ).trim() ||
            "application/octet-stream";

        const fileSize = Number(
            body.fileSize
        );

        if (
            !contentId ||
            !fileName ||
            !Number.isFinite(fileSize) ||
            fileSize <= 0
        ) {
            return NextResponse.json(
                {
                    error:
                        "contentId, fileName, and a valid fileSize are required.",
                },
                { status: 400 }
            );
        }

        if (
            fileSize >
            MAX_SINGLE_UPLOAD_BYTES
        ) {
            return NextResponse.json(
                {
                    error:
                        "This upload is larger than 5 GiB. Multipart upload support has not been enabled yet.",
                },
                { status: 413 }
            );
        }

        const content =
            await getAccessibleContent(
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

        const safeName =
            sanitizeR2FileName(fileName);

        const storageKey = [
            "organizations",
            content.project.organizationId,
            "content",
            content.id,
            `${Date.now()}-${randomUUID()}-${safeName}`,
        ].join("/");

        const command =
            new PutObjectCommand({
                Bucket:
                    getR2BucketName(),
                Key: storageKey,
                ContentType: mimeType,
            });

        const uploadUrl =
            await getSignedUrl(
                getR2Client(),
                command,
                {
                    expiresIn: 15 * 60,
                }
            );

        return NextResponse.json({
            uploadUrl,
            storageKey,
            expiresInSeconds:
                15 * 60,
            requiredHeaders: {
                "Content-Type":
                    mimeType,
            },
            maxSingleUploadBytes:
                MAX_SINGLE_UPLOAD_BYTES,
        });
    } catch (error) {
        console.error(
            "POST /api/assets/upload-url failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to prepare the R2 upload.",
            },
            { status: 500 }
        );
    }
}
