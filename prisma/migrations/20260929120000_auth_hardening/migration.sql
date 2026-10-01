-- Additive migration. Existing sessions use version 0 until a password changes.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
