/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CREATOR', 'EDITOR');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType";

-- CreateIndex
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
