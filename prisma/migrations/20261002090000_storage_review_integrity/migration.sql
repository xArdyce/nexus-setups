-- Stop if historical duplicate keys or pending reviews exist. Do not silently
-- discard production review/version history; reconcile before deployment.
BEGIN;
CREATE UNIQUE INDEX "AssetVersion_storageKey_key" ON "AssetVersion"("storageKey");
CREATE UNIQUE INDEX "Review_one_pending_per_content" ON "Review"("contentId") WHERE "status" = 'PENDING';
ALTER TABLE "AssetVersion" ADD CONSTRAINT "AssetVersion_positive_version" CHECK ("version" > 0);
COMMIT;
