import { prisma } from "@/lib/prisma";

export async function notifyUsers(
    userIds: Array<string | null | undefined>,
    title: string,
    message: string,
    excludeUserId?: string | null
) {
    const recipients = Array.from(
        new Set(
            userIds.filter(
                (userId): userId is string =>
                    Boolean(userId) &&
                    userId !== excludeUserId
            )
        )
    );

    if (recipients.length === 0) {
        return;
    }

    await prisma.notification.createMany({
        data: recipients.map((userId) => ({
            userId,
            title,
            message,
        })),
    });
}

export async function getManagementUserIds(
    organizationId: string
) {
    const memberships =
        await prisma.organizationMember.findMany({
            where: {
                organizationId,
                role: {
                    in: ["ADMIN", "MANAGER"],
                },
            },
            select: {
                userId: true,
            },
        });

    return memberships.map(
        (membership) => membership.userId
    );
}

export async function getAssignedEditorUserIds(
    contentId: string
) {
    const content = await prisma.contentItem.findUnique({
        where: {
            id: contentId,
        },
        select: {
            editorAssignments: {
                select: {
                    userId: true,
                },
            },
            project: {
                select: {
                    creatorId: true,
                },
            },
        },
    });

    if (!content) {
        return [];
    }

    const inheritedAssignments =
        content.project.creatorId
            ? await prisma.creatorAssignment.findMany({
                  where: {
                      creatorId:
                          content.project.creatorId,
                  },
                  select: {
                      userId: true,
                  },
              })
            : [];

    return Array.from(
        new Set([
            ...content.editorAssignments.map(
                (assignment) => assignment.userId
            ),
            ...inheritedAssignments.map(
                (assignment) => assignment.userId
            ),
        ])
    );
}

export async function getCreatorAccountUserId(
    creatorId: string | null | undefined
) {
    if (!creatorId) {
        return null;
    }

    const creator = await prisma.creator.findUnique({
        where: {
            id: creatorId,
        },
        select: {
            userId: true,
        },
    });

    return creator?.userId || null;
}
