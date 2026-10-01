import { Readable } from "node:stream";
import { createDeliveryZip } from "@/lib/delivery-zip";
import { logServerError } from "@/lib/server-log";
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
): Readable {
    if (
        body &&
        typeof body === "object" &&
        "pipe" in body &&
        typeof (body as { pipe?: unknown }).pipe ===
            "function"
    ) {
        return body as Readable;
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

        const usedNames = new Set<string>();
        const entries = [
            { key: approvedVersion.storageKey, name: uniqueZipName("Approved Cut", approvedVersion.fileName, usedNames) },
            ...supportingAssets.map(asset => ({
                key: asset.storageKey,
                name: uniqueZipName("Supporting Files", asset.fileName, usedNames),
            })),
        ];

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
                    transferStatus: "initiated",
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

        const delivery = createDeliveryZip(entries, async (key, signal) => {
            const object = await r2.send(
                new GetObjectCommand({ Bucket: bucket, Key: key }),
                { abortSignal: signal },
            );
            if (!object.Body) throw new Error("Storage object body missing.");
            return asNodeReadable(object.Body);
        }, request.signal);
        // Audit failures happen before opening any R2 source stream.
        let response: Response;
        try {
            response = new Response(delivery.stream, {
                status: 200,
                headers: {
                    "Content-Type": "application/zip",
                    "Content-Disposition": `attachment; filename="${zipFileName.replace(/"/g, "_")}"`,
                    "Cache-Control": "private, no-store",
                },
            });
        } catch (error) {
            delivery.cancel(error);
            throw error;
        }
        delivery.start();
        return response;
    } catch (error) {
        logServerError(
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
