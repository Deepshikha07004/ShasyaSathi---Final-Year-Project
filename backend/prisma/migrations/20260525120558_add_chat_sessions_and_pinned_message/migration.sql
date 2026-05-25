-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('CROP', 'GENERAL');

-- AlterTable
ALTER TABLE "chat_history" ADD COLUMN     "sessionId" TEXT;

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "chatType" "ChatType" NOT NULL DEFAULT 'GENERAL',
    "cropName" TEXT,
    "sowingDate" TIMESTAMP(3),
    "pinnedMessage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_sessions_farmerId_locationId_idx" ON "chat_sessions"("farmerId", "locationId");

-- CreateIndex
CREATE INDEX "chat_history_sessionId_idx" ON "chat_history"("sessionId");

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "farmer_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_history" ADD CONSTRAINT "chat_history_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
