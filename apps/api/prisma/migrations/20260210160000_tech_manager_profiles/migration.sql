-- CreateTable
CREATE TABLE "tech_manager_profiles" (
  "user_id" UUID NOT NULL,
  "intro" TEXT,
  "service_tags_json" JSONB,
  "featured_rank" INTEGER,
  "featured_until" TIMESTAMP(3),
  "consult_count" INTEGER NOT NULL DEFAULT 0,
  "deal_count" INTEGER NOT NULL DEFAULT 0,
  "rating_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rating_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tech_manager_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "tech_manager_profiles_featured_rank_idx" ON "tech_manager_profiles"("featured_rank");

-- AddForeignKey
ALTER TABLE "tech_manager_profiles" ADD CONSTRAINT "tech_manager_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
