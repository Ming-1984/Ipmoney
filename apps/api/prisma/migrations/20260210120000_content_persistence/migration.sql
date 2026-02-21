-- AlterEnum
ALTER TYPE "FileOwnerScope" ADD VALUE 'DEMAND';
ALTER TYPE "FileOwnerScope" ADD VALUE 'ACHIEVEMENT';
ALTER TYPE "FileOwnerScope" ADD VALUE 'ARTWORK';

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OFF_SHELF');

-- CreateEnum
CREATE TYPE "ArtworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OFF_SHELF', 'SOLD');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('USER', 'PLATFORM', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContentMediaType" AS ENUM ('IMAGE', 'VIDEO', 'FILE');

-- CreateEnum
CREATE TYPE "ArtworkCategory" AS ENUM ('CALLIGRAPHY', 'PAINTING');

-- CreateEnum
CREATE TYPE "CalligraphyScript" AS ENUM ('KAISHU', 'XINGSHU', 'CAOSHU', 'LISHU', 'ZHUANSHU');

-- CreateEnum
CREATE TYPE "PaintingGenre" AS ENUM ('FIGURE', 'LANDSCAPE', 'BIRD_FLOWER', 'OTHER');

-- CreateEnum
CREATE TYPE "AchievementMaturity" AS ENUM ('CONCEPT', 'PROTOTYPE', 'PILOT', 'MASS_PRODUCTION', 'COMMERCIALIZED', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryPeriod" AS ENUM ('WITHIN_1_MONTH', 'MONTH_1_3', 'MONTH_3_6', 'OVER_6_MONTHS', 'OTHER');

-- CreateTable
CREATE TABLE "demands" (
    "id" UUID NOT NULL,
    "publisher_user_id" UUID NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'USER',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "keywords_json" JSONB,
    "delivery_period" "DeliveryPeriod",
    "cooperation_modes_json" JSONB,
    "budget_type" "PriceType",
    "budget_min_fen" INTEGER,
    "budget_max_fen" INTEGER,
    "contact_name" TEXT,
    "contact_title" TEXT,
    "contact_phone_masked" TEXT,
    "cover_file_id" UUID,
    "region_code" TEXT,
    "industry_tags_json" JSONB,
    "audit_status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_media" (
    "id" UUID NOT NULL,
    "demand_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "type" "ContentMediaType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "demand_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_favorites" (
    "id" UUID NOT NULL,
    "demand_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_stats" (
    "demand_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demand_stats_pkey" PRIMARY KEY ("demand_id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "achievement_media" (
    "id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "type" "ContentMediaType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "achievement_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_favorites" (
    "id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_stats" (
    "achievement_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "achievement_stats_pkey" PRIMARY KEY ("achievement_id")
);

-- CreateTable
CREATE TABLE "artworks" (
    "id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "source" "ContentSource" NOT NULL DEFAULT 'USER',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ArtworkCategory" NOT NULL,
    "calligraphy_script" "CalligraphyScript",
    "painting_genre" "PaintingGenre",
    "creator_name" TEXT NOT NULL,
    "creation_date" DATE,
    "creation_year" INTEGER,
    "certificate_no" TEXT,
    "certificate_file_ids_json" JSONB,
    "price_type" "PriceType" NOT NULL,
    "price_amount_fen" INTEGER,
    "deposit_amount_fen" INTEGER NOT NULL DEFAULT 0,
    "region_code" TEXT,
    "material" TEXT,
    "size" TEXT,
    "cover_file_id" UUID,
    "audit_status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "status" "ArtworkStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_media" (
    "id" UUID NOT NULL,
    "artwork_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "type" "ContentMediaType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "artwork_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_favorites" (
    "id" UUID NOT NULL,
    "artwork_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_stats" (
    "artwork_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artwork_stats_pkey" PRIMARY KEY ("artwork_id")
);

-- CreateIndex
CREATE INDEX "demands_publisher_user_id_created_at_idx" ON "demands"("publisher_user_id", "created_at");

-- CreateIndex
CREATE INDEX "demands_audit_status_status_idx" ON "demands"("audit_status", "status");

-- CreateIndex
CREATE INDEX "demands_status_audit_status_created_at_idx" ON "demands"("status", "audit_status", "created_at");

-- CreateIndex
CREATE INDEX "demands_region_code_idx" ON "demands"("region_code");

-- CreateIndex
CREATE INDEX "demand_media_demand_id_sort_idx" ON "demand_media"("demand_id", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "demand_favorites_demand_id_user_id_key" ON "demand_favorites"("demand_id", "user_id");

-- CreateIndex
CREATE INDEX "achievements_publisher_user_id_created_at_idx" ON "achievements"("publisher_user_id", "created_at");

-- CreateIndex
CREATE INDEX "achievements_audit_status_status_idx" ON "achievements"("audit_status", "status");

-- CreateIndex
CREATE INDEX "achievements_status_audit_status_created_at_idx" ON "achievements"("status", "audit_status", "created_at");

-- CreateIndex
CREATE INDEX "achievements_region_code_idx" ON "achievements"("region_code");

-- CreateIndex
CREATE INDEX "achievement_media_achievement_id_sort_idx" ON "achievement_media"("achievement_id", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_favorites_achievement_id_user_id_key" ON "achievement_favorites"("achievement_id", "user_id");

-- CreateIndex
CREATE INDEX "artworks_seller_user_id_created_at_idx" ON "artworks"("seller_user_id", "created_at");

-- CreateIndex
CREATE INDEX "artworks_audit_status_status_idx" ON "artworks"("audit_status", "status");

-- CreateIndex
CREATE INDEX "artworks_status_audit_status_created_at_idx" ON "artworks"("status", "audit_status", "created_at");

-- CreateIndex
CREATE INDEX "artworks_region_code_idx" ON "artworks"("region_code");

-- CreateIndex
CREATE INDEX "artwork_media_artwork_id_sort_idx" ON "artwork_media"("artwork_id", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "artwork_favorites_artwork_id_user_id_key" ON "artwork_favorites"("artwork_id", "user_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_publisher_user_id_fkey" FOREIGN KEY ("publisher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_media" ADD CONSTRAINT "demand_media_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_media" ADD CONSTRAINT "demand_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_favorites" ADD CONSTRAINT "demand_favorites_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_favorites" ADD CONSTRAINT "demand_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_stats" ADD CONSTRAINT "demand_stats_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_publisher_user_id_fkey" FOREIGN KEY ("publisher_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_media" ADD CONSTRAINT "achievement_media_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_media" ADD CONSTRAINT "achievement_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_favorites" ADD CONSTRAINT "achievement_favorites_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_favorites" ADD CONSTRAINT "achievement_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_stats" ADD CONSTRAINT "achievement_stats_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_cover_file_id_fkey" FOREIGN KEY ("cover_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_media" ADD CONSTRAINT "artwork_media_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_media" ADD CONSTRAINT "artwork_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_favorites" ADD CONSTRAINT "artwork_favorites_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_favorites" ADD CONSTRAINT "artwork_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_stats" ADD CONSTRAINT "artwork_stats_artwork_id_fkey" FOREIGN KEY ("artwork_id") REFERENCES "artworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
