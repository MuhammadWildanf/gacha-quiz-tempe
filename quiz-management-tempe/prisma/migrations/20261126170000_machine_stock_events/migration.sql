-- AlterTable
ALTER TABLE "StockLog" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockLog_eventId_key" ON "StockLog"("eventId");

-- CreateTable
CREATE TABLE "MachineStock" (
    "machineId" TEXT NOT NULL PRIMARY KEY,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
