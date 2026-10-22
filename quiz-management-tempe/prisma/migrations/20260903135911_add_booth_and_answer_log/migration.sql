-- CreateTable
CREATE TABLE "Booth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnswerLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "boothId" INTEGER NOT NULL,
    "quizId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnswerLog_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GachaLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "boothId" INTEGER,
    "quizId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GachaLog_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GachaLog" ("createdAt", "id", "quizId", "score") SELECT "createdAt", "id", "quizId", "score" FROM "GachaLog";
DROP TABLE "GachaLog";
ALTER TABLE "new_GachaLog" RENAME TO "GachaLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Booth_name_key" ON "Booth"("name");
