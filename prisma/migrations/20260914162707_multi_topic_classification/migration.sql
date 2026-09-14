-- CreateEnum
CREATE TYPE "VideoClassification" AS ENUM ('INHERITED', 'CLASSIFIED', 'MANUAL', 'PENDING', 'EXCLUDED');

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "multiTopic" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "topicId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "keywords" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "classification" "VideoClassification" NOT NULL DEFAULT 'INHERITED',
ADD COLUMN     "topicId" TEXT;

-- CreateIndex
CREATE INDEX "Video_topicId_idx" ON "Video"("topicId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
