import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
    getR2BucketName,
    getR2Client,
} from "@/lib/r2";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{
        projectId: string;
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

function safeFileName(value: string) {
    const cleaned = value
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned.slice(0, 180) || "file";
}

function uniqueZipName(
    folder: string,
    fileName: string,
    usedNames: Set<string>
) {
    const safeName = safeFileName(fileName);
    const dotIndex = safeName.lastIndexOf(".");
    const base =
        dotIndex > 0
            ? safeName.slice(0, dotIndex)
            : safeName;
    const extension =
        dotIndex > 0
            ? safeName.slice(dotIndex)
            : "";

    let candidate = `${folder}/${safeName}`;
    let counter = 2;

    while (usedNames.has(candidate.toLowerCase())) {
        candidate =
            `${folder}/${base} (${counter})${extension}`;
        counter += 1;
    }

    usedNames.add(candidate.toLowerCase());
    return candidate;
}

async function getAccessibleApprovedContent(
    projectId: string,
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >
) {
    const includeData = {
        project: {
            include: {
                creator: true,
            },
        },
        assets: {
            include: {
                versions: {
                    orderBy: {
                        version: "desc" as const,
                    },
                },
            },
            orderBy: {
                createdAt: "desc" as const,
            },
        },
        reviews: {
            where: {
                status: "APPROVED" as const,
            },
            include: {
                assetVersion: {
                    include: {
                        asset: {
                            select: {
                                id: true,
                                contentId: true,
                                assetType: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                updatedAt: "desc" as const,
            },
        },
    };

    if (user.accountType === "CREATOR") {
        if (!user.creatorProfile) {
            return null;
        }

        return prisma.contentItem.findFirst({
            where: {
                id: projectId,
                status: "APPROVED",
                project: {
                    organizationId:
                        user.creatorProfile.organizationId,
                    creatorId:
                        user.creatorProfile.id,
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

    if (
        fullAccessOrganizationIds.length === 0 &&
        editorOrganizationIds.length === 0
    ) {
        return null;
    }

    return prisma.contentItem.findFirst({
        where: {
            id: projectId,
            status: "APPROVED",
            OR: [
                ...(fullAccessOrganizationIds.length > 0
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
                ...(editorOrganizationIds.length > 0
                    ? [
                          {
                              AND: [
                                  {
                                      project: {
                                          organizationId: {
                                              in: editorOrganizationIds,
                                          },
                                      },
                                  },
                                  {
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
                              ],
                          },
                      ]
                    : []),
            ],
        },
        include: includeData,
    });
}

function asNodeReadable(
    body: unknown
): NodeJS.ReadableStream {
    if (
        body &&
        typeof body === "object" &&
        "pipe" in body &&
        typeof (body as { pipe?: unknown }).pipe ===
            "function"
    ) {
        return body as NodeJS.ReadableStream;
    }

    if (
        body &&
        typeof body === "object" &&
        "transformToWebStream" in body &&
        typeof (
            body as {
                transformToWebStream?: unknown;
            }
        ).transformToWebStream === "function"
    ) {
        const webStream = (
            body as {
                transformToWebStream: () =>
                    ReadableStream<Uint8Array>;
            }
        ).transformToWebStream();

        return Readable.fromWeb(
            webStream as never
        );
    }

    throw new Error(
        "R2 returned an unsupported object body."
    );
}

// GET /api/projects/[projectId]/delivery
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

        const { projectId } = await context.params;

        const content =
            await getAccessibleApprovedContent(
                projectId,
                user
            );

        if (!content) {
            return NextResponse.json(
                {
                    error:
                        "Approved project not found or access denied.",
                },
                { status: 404 }
            );
        }

        const approvedReview =
            content.reviews.find(
                (review) =>
                    review.assetVersion &&
                    review.assetVersion.asset
                        .contentId === content.id
            ) || null;

        const approvedVersion =
            approvedReview?.assetVersion || null;

        if (!approvedReview || !approvedVersion) {
            return NextResponse.json(
                {
                    error:
                        "This approved project does not have a version-specific approved cut.",
                },
                { status: 409 }
            );
        }

        const supportingAssets =
            content.assets.filter(
                (asset) =>
                    asset.id !==
                    approvedVersion.assetId
            );

        const r2 = getR2Client();
        const bucket = getR2BucketName();

        const passThrough = new PassThrough();
        const archive = new ZipArchive({
            zlib: {
                level: 0,
            },
        });

        const usedNames = new Set<string>();

        archive.on("warning", (error) => {
            console.warn(
                "Delivery ZIP warning:",
                error
            );
        });

        archive.on("error", (error) => {
            console.error(
                "Delivery ZIP failed:",
                error
            );

            passThrough.destroy(error);
        });

        archive.pipe(passThrough);

        const approvedObject =
            await r2.send(
                new GetObjectCommand({
                    Bucket: bucket,
                    Key: approvedVersion.storageKey,
                })
            );

        if (!approvedObject.Body) {
            return NextResponse.json(
                {
                    error:
                        "The approved cut could not be read from storage.",
                },
                { status: 502 }
            );
        }

        archive.append(
            asNodeReadable(
                approvedObject.Body
            ) as never,
            {
                name: uniqueZipName(
                    "Approved Cut",
                    approvedVersion.fileName,
                    usedNames
                ),
            }
        );

        for (const asset of supportingAssets) {
            const object =
                await r2.send(
                    new GetObjectCommand({
                        Bucket: bucket,
                        Key: asset.storageKey,
                    })
                );

            if (!object.Body) {
                throw new Error(
                    `Could not read ${asset.fileName} from R2.`
                );
            }

            archive.append(
                asNodeReadable(
                    object.Body
                ) as never,
                {
                    name: uniqueZipName(
                        "Supporting Files",
                        asset.fileName,
                        usedNames
                    ),
                }
            );
        }

        void archive.finalize();

        const zipFileName =
            safeFileName(
                `${content.title}-Nexus-Delivery.zip`
            );

        await prisma.auditLog.create({
            data: {
                action:
                    "DELIVERY_PACKAGE_DOWNLOADED",
                resource: "ContentItem",
                resourceId: content.id,
                userId: user.id,
                metadata: {
                    title: content.title,
                    organizationId:
                        content.project.organizationId,
                    creatorId:
                        content.project.creatorId,
                    approvedReviewId:
                        approvedReview.id,
                    approvedAssetVersionId:
                        approvedVersion.id,
                    approvedAssetVersion:
                        approvedVersion.version,
                    supportingFileCount:
                        supportingAssets.length,
                },
            },
        });

        const webStream =
            Readable.toWeb(
                passThrough
            ) as ReadableStream<Uint8Array>;

        return new Response(webStream, {
            status: 200,
            headers: {
                "Content-Type":
                    "application/zip",
                "Content-Disposition":
                    `attachment; filename="${zipFileName.replace(
                        /"/g,
                        "_"
                    )}"`,
                "Cache-Control":
                    "private, no-store",
            },
        });
    } catch (error) {
        console.error(
            "GET /api/projects/[projectId]/delivery failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to prepare the delivery package.",
            },
            { status: 500 }
        );
    }
}
