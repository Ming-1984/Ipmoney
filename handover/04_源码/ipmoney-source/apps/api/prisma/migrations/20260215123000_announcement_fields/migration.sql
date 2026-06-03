-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OFF_SHELF');

-- AlterTable
ALTER TABLE "announcements"
ADD COLUMN "publisher_name" TEXT,
ADD COLUMN "issue_no" TEXT,
ADD COLUMN "source_url" TEXT,
ADD COLUMN "tags_json" JSONB,
ADD COLUMN "related_patents_json" JSONB,
ADD COLUMN "status" "AnnouncementStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "published_at" TIMESTAMP(3);
