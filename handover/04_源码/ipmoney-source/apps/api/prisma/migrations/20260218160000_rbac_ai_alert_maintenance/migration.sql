-- CreateEnum
CREATE TYPE "AiContentType" AS ENUM ('LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK');
CREATE TYPE "AiParseStatus" AS ENUM ('ACTIVE', 'REVIEW_REQUIRED', 'REPLACED');
CREATE TYPE "AiParseFeedbackActorType" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AlertChannel" AS ENUM ('SMS', 'EMAIL', 'IN_APP');
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'SENT', 'ACKED', 'SUPPRESSED');
CREATE TYPE "AlertTargetType" AS ENUM ('PATENT', 'ORDER', 'LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK', 'AI_PARSE', 'IMPORT', 'PAYMENT', 'REFUND', 'SYSTEM');
CREATE TYPE "PatentMaintenanceStatus" AS ENUM ('DUE', 'PAID', 'OVERDUE', 'WAIVED');
CREATE TYPE "PatentMaintenanceTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "rbac_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permission_ids_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rbac_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rbac_user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rbac_user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

-- CreateTable
CREATE TABLE "ai_parse_results" (
    "id" UUID NOT NULL,
    "content_type" "AiContentType" NOT NULL,
    "content_id" UUID NOT NULL,
    "summary_plain" TEXT,
    "features_plain" TEXT,
    "keywords_json" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "model_version" TEXT,
    "status" "AiParseStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_parse_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_parse_feedbacks" (
    "id" UUID NOT NULL,
    "parse_result_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_type" "AiParseFeedbackActorType" NOT NULL,
    "score" INTEGER NOT NULL,
    "reason_tags_json" JSONB,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_parse_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "target_type" "AlertTargetType",
    "target_id" UUID,
    "message" TEXT,
    "triggered_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_maintenance_schedules" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "year_no" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "grace_period_end" DATE,
    "status" "PatentMaintenanceStatus" NOT NULL DEFAULT 'DUE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_maintenance_tasks" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "assigned_cs_user_id" UUID,
    "status" "PatentMaintenanceTaskStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "evidence_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_maintenance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rbac_user_roles_role_id_idx" ON "rbac_user_roles"("role_id");

-- CreateIndex
CREATE INDEX "ai_parse_results_content_type_content_id_idx" ON "ai_parse_results"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "ai_parse_results_status_created_at_idx" ON "ai_parse_results"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_parse_feedbacks_parse_result_id_created_at_idx" ON "ai_parse_feedbacks"("parse_result_id", "created_at");

-- CreateIndex
CREATE INDEX "alert_events_status_triggered_at_idx" ON "alert_events"("status", "triggered_at");

-- CreateIndex
CREATE INDEX "alert_events_target_type_target_id_idx" ON "alert_events"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "patent_maintenance_schedules_patent_id_year_no_key" ON "patent_maintenance_schedules"("patent_id", "year_no");

-- CreateIndex
CREATE INDEX "patent_maintenance_schedules_status_due_date_idx" ON "patent_maintenance_schedules"("status", "due_date");

-- CreateIndex
CREATE INDEX "patent_maintenance_tasks_schedule_id_status_idx" ON "patent_maintenance_tasks"("schedule_id", "status");

-- CreateIndex
CREATE INDEX "patent_maintenance_tasks_assigned_cs_user_id_idx" ON "patent_maintenance_tasks"("assigned_cs_user_id");

-- AddForeignKey
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "rbac_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parse_feedbacks" ADD CONSTRAINT "ai_parse_feedbacks_parse_result_id_fkey" FOREIGN KEY ("parse_result_id") REFERENCES "ai_parse_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_parse_feedbacks" ADD CONSTRAINT "ai_parse_feedbacks_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_maintenance_schedules" ADD CONSTRAINT "patent_maintenance_schedules_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_maintenance_tasks" ADD CONSTRAINT "patent_maintenance_tasks_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "patent_maintenance_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_maintenance_tasks" ADD CONSTRAINT "patent_maintenance_tasks_assigned_cs_user_id_fkey" FOREIGN KEY ("assigned_cs_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_maintenance_tasks" ADD CONSTRAINT "patent_maintenance_tasks_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
