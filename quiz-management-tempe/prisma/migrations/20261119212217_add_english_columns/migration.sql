-- AlterTable
ALTER TABLE "Answer" ADD COLUMN "answerTextEn" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "nameEn" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "questionEn" TEXT;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN "descriptionEn" TEXT;
ALTER TABLE "Quiz" ADD COLUMN "titleEn" TEXT;
