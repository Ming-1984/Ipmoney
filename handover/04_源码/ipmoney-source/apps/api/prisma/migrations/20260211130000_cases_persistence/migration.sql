-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "cs_cases"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "requester_name" TEXT,
  ADD COLUMN "priority" "CasePriority",
  ADD COLUMN "description" TEXT,
  ADD COLUMN "due_at" TIMESTAMP(3),
  ALTER COLUMN "order_id" DROP NOT NULL,
  ALTER COLUMN "cs_user_id" DROP NOT NULL;

UPDATE "cs_cases"
SET "status" = 'OPEN'
WHERE "status" IS NULL OR "status" NOT IN ('OPEN', 'IN_PROGRESS', 'CLOSED');

ALTER TABLE "cs_cases"
  ALTER COLUMN "status" TYPE "CaseStatus" USING ("status"::text::"CaseStatus"),
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- CreateTable
CREATE TABLE "cs_case_notes" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "author_name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cs_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cs_case_evidences" (
  "id" UUID NOT NULL,
  "case_id" UUID NOT NULL,
  "file_id" UUID NOT NULL,
  "file_name" TEXT,
  "url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cs_case_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cs_cases_cs_user_id_idx" ON "cs_cases"("cs_user_id");

-- CreateIndex
CREATE INDEX "cs_case_notes_case_id_created_at_idx" ON "cs_case_notes"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "cs_case_evidences_case_id_created_at_idx" ON "cs_case_evidences"("case_id", "created_at");
CREATE INDEX "cs_case_evidences_file_id_idx" ON "cs_case_evidences"("file_id");

-- AddForeignKey
ALTER TABLE "cs_case_notes" ADD CONSTRAINT "cs_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cs_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cs_case_notes" ADD CONSTRAINT "cs_case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_case_evidences" ADD CONSTRAINT "cs_case_evidences_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cs_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cs_case_evidences" ADD CONSTRAINT "cs_case_evidences_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
