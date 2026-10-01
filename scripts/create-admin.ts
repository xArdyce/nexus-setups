import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { logServerError } from "../src/lib/server-log";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.warn("PRODUCTION: this operation can create an account or explicitly change credentials. Verify the target database before proceeding.");
  }
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("ADMIN_INITIAL_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.");
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const email = "admin@nexussetups.com";
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && !process.argv.includes("--update-existing-password")) {
      throw new Error("Account already exists. Use --update-existing-password only for an intentional credential change.");
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashedPassword, sessionVersion: { increment: 1 } },
      });
      console.log("Existing account password changed; previous sessions revoked.");
    } else {
      // create, not upsert: a concurrent invocation cannot overwrite a password.
      await prisma.user.create({ data: {
        email, name: "Nexus Admin", password: hashedPassword, accountType: "EDITOR",
      } });
      console.log("Account created. Workspace roles must be assigned separately.");
    }
  } finally { await prisma.$disconnect(); }
}

main().catch(error => {
  // Static operator guidance; provider errors can contain connection strings.
  console.error("Admin setup failed. Check password requirements, DATABASE_URL and whether the account exists. No credentials are printed.");
  logServerError("Admin setup failure", error);
  process.exitCode = 1;
});
