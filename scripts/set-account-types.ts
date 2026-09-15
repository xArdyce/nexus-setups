import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.findUnique({
    where: {
      email: "admin@nexussetups.com",
    },
  });

  if (!admin) {
    throw new Error("Admin account not found.");
  }

  await prisma.user.update({
    where: {
      id: admin.id,
    },
    data: {
      accountType: "EDITOR",
    },
  });

  console.log(`Updated ${admin.email} -> EDITOR`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });