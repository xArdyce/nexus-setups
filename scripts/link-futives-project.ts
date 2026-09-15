import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const creatorId = "cmu306x7c0000fw6xt2skdm4u";
  const projectId = "cmszb0plo0002946xqs4cle3p";

  const creator = await prisma.creator.findUnique({
    where: {
      id: creatorId,
    },
  });

  if (!creator) {
    throw new Error("Futives creator profile not found.");
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    throw new Error("Futives project not found.");
  }

  if (creator.organizationId !== project.organizationId) {
    throw new Error(
      "Creator and project belong to different organizations."
    );
  }

  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      creatorId: creator.id,
    },
  });

  console.log("Successfully linked Futives to General Content.");
  console.log({
    creatorId: creator.id,
    projectId: project.id,
    organizationId: project.organizationId,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });