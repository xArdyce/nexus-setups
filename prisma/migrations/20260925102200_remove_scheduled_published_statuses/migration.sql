/*
  Warnings:

  - The values [SCHEDULED,PUBLISHED] on the enum `ContentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ContentStatus_new" AS ENUM ('REQUESTED', 'IN_PRODUCTION', 'IN_REVIEW', 'REVISION', 'APPROVED');
ALTER TABLE "public"."ContentItem" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ContentItem" ALTER COLUMN "status" TYPE "ContentStatus_new" USING ("status"::text::"ContentStatus_new");
ALTER TYPE "ContentStatus" RENAME TO "ContentStatus_old";
ALTER TYPE "ContentStatus_new" RENAME TO "ContentStatus";
DROP TYPE "public"."ContentStatus_old";
ALTER TABLE "ContentItem" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';
COMMIT;
