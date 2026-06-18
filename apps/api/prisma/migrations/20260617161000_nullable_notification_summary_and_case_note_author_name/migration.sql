ALTER TABLE "notifications"
  ALTER COLUMN "summary" DROP NOT NULL;

ALTER TABLE "cs_case_notes"
  ALTER COLUMN "author_name" DROP NOT NULL;
