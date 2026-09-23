import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getAuthenticatedUser() {
    const session = await auth();

    if (!session?.user?.email) {
        return null;
    }

    return prisma.user.findUnique({
        where: {
            email: session.user.email.toLowerCase(),
        },
        select: {
            id: true,
            name: true,
            email: true,
            password: true,
            accountType: true,

            creatorProfile: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    organizationId: true,
                },
            },

            memberships: {
                select: {
                    organizationId: true,
                    role: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            },
        },
    });
}

function serializeSettingsUser(
    user: NonNullable<
        Awaited<ReturnType<typeof getAuthenticatedUser>>
    >
) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        hasPassword: Boolean(user.password),

        creatorProfile: user.creatorProfile
            ? {
                  id: user.creatorProfile.id,
                  name: user.creatorProfile.name,
                  email: user.creatorProfile.email,
                  organizationId:
                      user.creatorProfile.organizationId,
              }
            : null,

        workspaces: user.memberships.map(
            (membership) => ({
                id: membership.organization.id,
                name: membership.organization.name,
                role: membership.role,
            })
        ),
    };
}

// GET /api/settings
export async function GET() {
    try {
        const user = await getAuthenticatedUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            profile: serializeSettingsUser(user),
        });
    } catch (error) {
        console.error(
            "GET /api/settings failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to load account settings.",
            },
            { status: 500 }
        );
    }
}

// PATCH /api/settings
//
// PROFILE:
// {
//   action: "PROFILE",
//   name,
//   email,
//   currentPassword? // required when changing email
// }
//
// PASSWORD:
// {
//   action: "PASSWORD",
//   currentPassword,
//   newPassword
// }
//
// WORKSPACE:
// {
//   action: "WORKSPACE",
//   organizationId,
//   name
// }
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
            action?: unknown;
            name?: unknown;
            email?: unknown;
            currentPassword?: unknown;
            newPassword?: unknown;
            organizationId?: unknown;
        };

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body." },
                { status: 400 }
            );
        }

        const action = String(
            body.action || ""
        ).trim();

        /*
         * ============================================================
         * PROFILE
         * ============================================================
         */
        if (action === "PROFILE") {
            const name = String(
                body.name || ""
            ).trim();

            const email = String(
                body.email || ""
            )
                .trim()
                .toLowerCase();

            const currentPassword =
                typeof body.currentPassword === "string"
                    ? body.currentPassword
                    : "";

            if (!name) {
                return NextResponse.json(
                    {
                        error:
                            "Account name is required.",
                    },
                    { status: 400 }
                );
            }

            if (
                !email ||
                !EMAIL_REGEX.test(email)
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Enter a valid email address.",
                    },
                    { status: 400 }
                );
            }

            const emailChanged =
                email !== user.email.toLowerCase();

            if (emailChanged) {
                if (!user.password) {
                    return NextResponse.json(
                        {
                            error:
                                "This account does not have a password that can verify an email change.",
                        },
                        { status: 400 }
                    );
                }

                if (!currentPassword) {
                    return NextResponse.json(
                        {
                            error:
                                "Enter your current password to change your email address.",
                        },
                        { status: 400 }
                    );
                }

                const passwordMatches =
                    await bcrypt.compare(
                        currentPassword,
                        user.password
                    );

                if (!passwordMatches) {
                    return NextResponse.json(
                        {
                            error:
                                "Current password is incorrect.",
                        },
                        { status: 403 }
                    );
                }

                const existing =
                    await prisma.user.findUnique({
                        where: {
                            email,
                        },
                        select: {
                            id: true,
                        },
                    });

                if (
                    existing &&
                    existing.id !== user.id
                ) {
                    return NextResponse.json(
                        {
                            error:
                                "An account with this email already exists.",
                        },
                        { status: 409 }
                    );
                }
            }

            await prisma.$transaction(
                async (tx) => {
                    await tx.user.update({
                        where: {
                            id: user.id,
                        },
                        data: {
                            name,
                            email,
                        },
                    });

                    if (user.creatorProfile) {
                        await tx.creator.update({
                            where: {
                                id: user.creatorProfile.id,
                            },
                            data: {
                                name,
                                email,
                            },
                        });
                    }
                }
            );

            const refreshed =
                await prisma.user.findUnique({
                    where: {
                        id: user.id,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        accountType: true,
                    },
                });

            return NextResponse.json({
                success: true,
                profile: refreshed,
                emailChanged,
            });
        }

        /*
         * ============================================================
         * PASSWORD
         * ============================================================
         */
        if (action === "PASSWORD") {
            const currentPassword =
                typeof body.currentPassword === "string"
                    ? body.currentPassword
                    : "";

            const newPassword =
                typeof body.newPassword === "string"
                    ? body.newPassword
                    : "";

            if (!user.password) {
                return NextResponse.json(
                    {
                        error:
                            "This account does not currently use a password.",
                    },
                    { status: 400 }
                );
            }

            if (!currentPassword) {
                return NextResponse.json(
                    {
                        error:
                            "Current password is required.",
                    },
                    { status: 400 }
                );
            }

            if (newPassword.length < 8) {
                return NextResponse.json(
                    {
                        error:
                            "New password must be at least 8 characters.",
                    },
                    { status: 400 }
                );
            }

            const passwordMatches =
                await bcrypt.compare(
                    currentPassword,
                    user.password
                );

            if (!passwordMatches) {
                return NextResponse.json(
                    {
                        error:
                            "Current password is incorrect.",
                    },
                    { status: 403 }
                );
            }

            const samePassword =
                await bcrypt.compare(
                    newPassword,
                    user.password
                );

            if (samePassword) {
                return NextResponse.json(
                    {
                        error:
                            "Choose a new password that is different from your current password.",
                    },
                    { status: 400 }
                );
            }

            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    12
                );

            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    password:
                        hashedPassword,
                },
            });

            return NextResponse.json({
                success: true,
                message:
                    "Password updated successfully.",
            });
        }

        /*
         * ============================================================
         * WORKSPACE
         * ============================================================
         */
        if (action === "WORKSPACE") {
            const organizationId = String(
                body.organizationId || ""
            ).trim();

            const name = String(
                body.name || ""
            ).trim();

            if (!organizationId || !name) {
                return NextResponse.json(
                    {
                        error:
                            "Workspace and name are required.",
                    },
                    { status: 400 }
                );
            }

            const membership =
                user.memberships.find(
                    (item) =>
                        item.organizationId ===
                        organizationId
                );

            if (!membership) {
                return NextResponse.json(
                    {
                        error:
                            "You do not have access to this workspace.",
                    },
                    { status: 403 }
                );
            }

            if (
                membership.role !== "ADMIN" &&
                membership.role !== "MANAGER"
            ) {
                return NextResponse.json(
                    {
                        error:
                            "Only an Admin or Manager can rename this workspace.",
                    },
                    { status: 403 }
                );
            }

            const previousName =
                membership.organization.name;

            const updatedOrganization =
                await prisma.$transaction(
                    async (tx) => {
                        const updated =
                            await tx.organization.update({
                                where: {
                                    id: organizationId,
                                },
                                data: {
                                    name,
                                },
                                select: {
                                    id: true,
                                    name: true,
                                },
                            });

                        await tx.auditLog.create({
                            data: {
                                action:
                                    "ORGANIZATION_RENAMED",
                                resource:
                                    "Organization",
                                resourceId:
                                    organizationId,
                                userId: user.id,
                                metadata: {
                                    organizationId,
                                    previousName,
                                    newName:
                                        updated.name,
                                },
                            },
                        });

                        return updated;
                    }
                );

            return NextResponse.json({
                success: true,
                workspace: {
                    ...updatedOrganization,
                    role: membership.role,
                },
            });
        }

        return NextResponse.json(
            {
                error:
                    "Unknown settings action.",
            },
            { status: 400 }
        );
    } catch (error) {
        console.error(
            "PATCH /api/settings failed:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Failed to update account settings.",
            },
            { status: 500 }
        );
    }
}
