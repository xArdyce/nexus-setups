-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "assetVersionId" TEXT;

-- CreateIndex
CREATE INDEX "Review_assetVersionId_idx" ON "Review"("assetVersionId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "AssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
