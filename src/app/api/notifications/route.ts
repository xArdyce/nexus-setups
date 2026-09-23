import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
        },
    });
}

// GET /api/notifications
// Optional: ?limit=20&unreadOnly=true
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
        const requestedLimit = Number(
            searchParams.get("limit") || "20"
        );
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(
                  Math.max(Math.floor(requestedLimit), 1),
                  50
              )
            : 20;
        const unreadOnly =
            searchParams.get("unreadOnly") === "true";

        const [notifications, unreadCount] =
            await Promise.all([
                prisma.notification.findMany({
                    where: {
                        userId: user.id,
                        ...(unreadOnly
                            ? { read: false }
                            : {}),
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    take: limit,
                }),
                prisma.notification.count({
                    where: {
                        userId: user.id,
                        read: false,
                    },
                }),
            ]);

        return NextResponse.json({
            notifications,
            unreadCount,
        });
    } catch (error) {
        console.error(
            "GET /api/notifications failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to load notifications." },
            { status: 500 }
        );
    }
}

// PATCH /api/notifications
// { "notificationId": "..." }
// or { "markAllRead": true }
export async function PATCH(request: Request) {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        let body: {
            notificationId?: unknown;
            markAllRead?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        if (body.markAllRead === true) {
            const result =
                await prisma.notification.updateMany({
                    where: {
                        userId: user.id,
                        read: false,
                    },
                    data: {
                        read: true,
                    },
                });

            return NextResponse.json({
                success: true,
                updatedCount: result.count,
            });
        }

        const notificationId =
            typeof body.notificationId === "string"
                ? body.notificationId.trim()
                : "";

        if (!notificationId) {
            return NextResponse.json(
                {
                    error:
                        "notificationId is required unless markAllRead is true.",
                },
                { status: 400 }
            );
        }

        const result =
            await prisma.notification.updateMany({
                where: {
                    id: notificationId,
                    userId: user.id,
                },
                data: {
                    read: true,
                },
            });

        if (result.count === 0) {
            return NextResponse.json(
                { error: "Notification not found." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error(
            "PATCH /api/notifications failed:",
            error
        );

        return NextResponse.json(
            { error: "Failed to update notification." },
            { status: 500 }
        );
    }
}
