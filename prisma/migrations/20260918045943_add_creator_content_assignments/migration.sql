-- CreateTable
CREATE TABLE "CreatorAssignment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAssignment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorAssignment_creatorId_idx" ON "CreatorAssignment"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorAssignment_userId_idx" ON "CreatorAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorAssignment_creatorId_userId_key" ON "CreatorAssignment"("creatorId", "userId");

-- CreateIndex
CREATE INDEX "ContentAssignment_contentId_idx" ON "ContentAssignment"("contentId");

-- CreateIndex
CREATE INDEX "ContentAssignment_userId_idx" ON "ContentAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAssignment_contentId_userId_key" ON "ContentAssignment"("contentId", "userId");

-- AddForeignKey
ALTER TABLE "CreatorAssignment" ADD CONSTRAINT "CreatorAssignment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorAssignment" ADD CONSTRAINT "CreatorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAssignment" ADD CONSTRAINT "ContentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
