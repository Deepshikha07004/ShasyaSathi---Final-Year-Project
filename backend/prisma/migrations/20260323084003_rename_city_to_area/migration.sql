/*
  Warnings:

  - You are about to drop the column `city` on the `farmer_locations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "farmer_locations" DROP COLUMN "city",
ADD COLUMN     "area" TEXT;
