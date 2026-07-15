CREATE TYPE "TechManagerBadgeCategory" AS ENUM ('HONOR', 'STATUS');

CREATE TYPE "TechManagerBadgeSource" AS ENUM ('ADMIN_MANUAL', 'ADMIN_BATCH', 'IMPORT', 'MIGRATION');

CREATE TABLE "tech_manager_badge_definitions" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "TechManagerBadgeCategory" NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "style_token" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tech_manager_badge_definitions_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "tech_manager_badges" (
  "id" UUID NOT NULL,
  "tech_manager_user_id" UUID NOT NULL,
  "badge_code" TEXT NOT NULL,
  "assigned_by_user_id" UUID,
  "source" "TechManagerBadgeSource" NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tech_manager_badges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tech_manager_badges_tech_manager_user_id_assigned_at_idx"
ON "tech_manager_badges"("tech_manager_user_id", "assigned_at");

CREATE INDEX "tech_manager_badges_badge_code_assigned_at_idx"
ON "tech_manager_badges"("badge_code", "assigned_at");

CREATE UNIQUE INDEX "tech_manager_badges_active_unique_idx"
ON "tech_manager_badges"("tech_manager_user_id", "badge_code")
WHERE "expires_at" IS NULL;

ALTER TABLE "tech_manager_badges"
ADD CONSTRAINT "tech_manager_badges_tech_manager_user_id_fkey"
FOREIGN KEY ("tech_manager_user_id") REFERENCES "tech_manager_profiles"("user_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tech_manager_badges"
ADD CONSTRAINT "tech_manager_badges_badge_code_fkey"
FOREIGN KEY ("badge_code") REFERENCES "tech_manager_badge_definitions"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tech_manager_badges"
ADD CONSTRAINT "tech_manager_badges_assigned_by_user_id_fkey"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "tech_manager_badge_definitions" ("code", "name", "category", "sort_order", "enabled", "style_token", "created_at", "updated_at")
VALUES
  ('TOP10_TECH_MANAGER', '十佳技术经理人', 'HONOR', 10, true, 'gold', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('GOLD_MANAGER', '金牌经理人', 'HONOR', 20, true, 'amber', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('BENCHMARK_MANAGER', '标杆技术经理人', 'HONOR', 30, true, 'sun', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('EXCELLENT_TECH_MANAGER', '卓越技术经理人', 'HONOR', 40, true, 'ocean', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CERTIFIED_MANAGER', '认证经理人', 'STATUS', 50, true, 'ink', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SIGNED_MANAGER', '签约经理人', 'STATUS', 60, true, 'emerald', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
