-- Restore achievement enums
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OFF_SHELF');
CREATE TYPE "ContentMediaType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');
CREATE TYPE "AchievementMaturity" AS ENUM ('CONCEPT', 'PROTOTYPE', 'PILOT', 'MASS_PRODUCTION', 'COMMERCIALIZED', 'OTHER');

-- Extend enums to include ACHIEVEMENT
ALTER TYPE "AiContentType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
ALTER TYPE "AlertTargetType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
ALTER TYPE "CommentContentType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
ALTER TYPE "ConversationContentType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';
ALTER TYPE "FileOwnerScope" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT';

-- Create achievements table
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "publisher_user_id" UUID NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'USER',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "keywords_json" JSONB,
    "maturity" "AchievementMaturity",
    "cooperation_modes_json" JSONB,
    "cover_file_id" UUID,
    "region_code" TEXT,
    "industry_tags_json" JSONB,
    "audit_status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- Create achievement media
CREATE TABLE "achievement_media" (
    "id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "type" "ContentMediaType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievement_media_pkey" PRIMARY KEY ("id")
);

-- Create achievement favorites
CREATE TABLE "achievement_favorites" (
    "id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_favorites_pkey" PRIMARY KEY ("id")
);

-- Create achievement stats
CREATE TABLE "achievement_stats" (
    "achievement_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_stats_pkey" PRIMARY KEY ("achievement_id")
);

-- Indexes
CREATE INDEX "achievements_publisher_user_id_created_at_idx" ON "achievements"("publisher_user_id", "created_at");
CREATE INDEX "achievements_audit_status_status_idx" ON "achievements"("audit_status", "status");
CREATE INDEX "achievements_status_audit_status_created_at_idx" ON "achievements"("status", "audit_status", "created_at");
CREATE INDEX "achievements_region_code_idx" ON "achievements"("region_code");
CREATE INDEX "achievement_media_achievement_id_sort_idx" ON "achievement_media"("achievement_id", "sort");

-- Constraints
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_publisher_user_id_fkey" FOREIGN KEY ("publisher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "achievement_media" ADD CONSTRAINT "achievement_media_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "achievement_media" ADD CONSTRAINT "achievement_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "achievement_favorites" ADD CONSTRAINT "achievement_favorites_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "achievement_favorites" ADD CONSTRAINT "achievement_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "achievement_stats" ADD CONSTRAINT "achievement_stats_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
