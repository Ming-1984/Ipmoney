-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('buyer', 'seller', 'cs', 'admin');

-- CreateEnum
CREATE TYPE "RegionLevel" AS ENUM ('PROVINCE', 'CITY', 'DISTRICT');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('PERSON', 'COMPANY', 'ACADEMY', 'GOVERNMENT', 'ASSOCIATION', 'TECH_MANAGER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PatentType" AS ENUM ('INVENTION', 'UTILITY_MODEL', 'DESIGN');

-- CreateEnum
CREATE TYPE "PatentSourcePrimary" AS ENUM ('USER', 'ADMIN', 'PROVIDER');

-- CreateEnum
CREATE TYPE "PatentIdentifierType" AS ENUM ('APPLICATION', 'PATENT', 'PUBLICATION');

-- CreateEnum
CREATE TYPE "ClassificationSystem" AS ENUM ('IPC', 'LOC', 'CPC');

-- CreateEnum
CREATE TYPE "PatentPartyRole" AS ENUM ('APPLICANT', 'INVENTOR', 'ASSIGNEE');

-- CreateEnum
CREATE TYPE "FileOwnerScope" AS ENUM ('LISTING', 'CASE', 'REFUND_REQUEST', 'INVOICE', 'USER', 'USER_VERIFICATION', 'MESSAGE');

-- CreateEnum
CREATE TYPE "ListingTradeMode" AS ENUM ('ASSIGNMENT', 'LICENSE');

-- CreateEnum
CREATE TYPE "LicenseMode" AS ENUM ('EXCLUSIVE', 'SOLE', 'NON_EXCLUSIVE');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'NEGOTIABLE');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OFF_SHELF', 'SOLD');

-- CreateEnum
CREATE TYPE "FeaturedLevel" AS ENUM ('NONE', 'CITY', 'PROVINCE');

-- CreateEnum
CREATE TYPE "ListingMediaType" AS ENUM ('IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "ListingAuditAction" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ConsultChannel" AS ENUM ('WECHAT_CS', 'PHONE', 'FORM');

-- CreateEnum
CREATE TYPE "ConversationMessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('DEPOSIT', 'FINAL', 'REFUND', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('WECHAT');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REFUNDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('FOLLOWUP', 'REFUND', 'DISPUTE');

-- CreateEnum
CREATE TYPE "MilestoneName" AS ENUM ('CONTRACT_SIGNED', 'TRANSFER_SUBMITTED', 'TRANSFER_COMPLETED');

-- CreateEnum
CREATE TYPE "SettlementPayoutMethod" AS ENUM ('MANUAL', 'WECHAT');

-- CreateEnum
CREATE TYPE "SettlementPayoutStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SystemConfigValueType" AS ENUM ('INT', 'DECIMAL', 'STRING', 'JSON', 'BOOL');

-- CreateEnum
CREATE TYPE "SystemConfigScope" AS ENUM ('GLOBAL', 'TENANT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "nickname" TEXT,
    "role" "UserRole" NOT NULL,
    "region_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "RegionLevel" NOT NULL,
    "parent_code" TEXT,
    "center_lat" DOUBLE PRECISION,
    "center_lng" DOUBLE PRECISION,
    "industry_tags_json" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "industry_tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL,
    "display_name" TEXT NOT NULL,
    "unified_social_credit_code_enc" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "region_code" TEXT,
    "intro" TEXT,
    "logo_file_id" UUID,
    "evidence_file_ids_json" JSONB,
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patents" (
    "id" UUID NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'CN',
    "application_no_norm" TEXT NOT NULL,
    "application_no_display" TEXT,
    "patent_type" "PatentType" NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT,
    "filing_date" DATE,
    "publication_date" DATE,
    "grant_date" DATE,
    "legal_status" TEXT,
    "source_primary" "PatentSourcePrimary" NOT NULL DEFAULT 'USER',
    "source_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_identifiers" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "id_type" "PatentIdentifierType" NOT NULL,
    "id_value_norm" TEXT NOT NULL,
    "kind_code" TEXT,
    "date_ref" DATE,

    CONSTRAINT "patent_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_classifications" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "system" "ClassificationSystem" NOT NULL,
    "code" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "patent_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_parties" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "role" "PatentPartyRole" NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" TEXT,

    CONSTRAINT "patent_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "owner_scope" "FileOwnerScope" NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "trade_mode" "ListingTradeMode" NOT NULL,
    "license_mode" "LicenseMode",
    "price_type" "PriceType" NOT NULL,
    "price_amount" INTEGER,
    "deposit_amount" INTEGER NOT NULL,
    "region_code" TEXT,
    "industry_tags_json" JSONB,
    "featured_level" "FeaturedLevel" NOT NULL DEFAULT 'NONE',
    "featured_region_code" TEXT,
    "featured_rank" INTEGER,
    "featured_until" TIMESTAMP(3),
    "audit_status" "AuditStatus" NOT NULL DEFAULT 'PENDING',
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_media" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "type" "ListingMediaType" NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listing_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_audit_logs" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "action" "ListingAuditAction" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_stats" (
    "listing_id" UUID NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_count" INTEGER NOT NULL DEFAULT 0,
    "consult_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_stats_pkey" PRIMARY KEY ("listing_id")
);

-- CreateTable
CREATE TABLE "listing_favorites" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_consult_events" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "ConsultChannel" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_consult_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tag_scores" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tag_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "assigned_cs_user_id" UUID,
    "status" TEXT NOT NULL,
    "deal_amount" INTEGER,
    "deposit_amount" INTEGER NOT NULL,
    "final_amount" INTEGER,
    "commission_amount" INTEGER,
    "invoice_no" TEXT,
    "invoice_file_id" UUID,
    "invoice_issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "order_id" UUID,
    "buyer_user_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "type" "ConversationMessageType" NOT NULL,
    "text" TEXT,
    "file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "pay_type" "PaymentType" NOT NULL,
    "channel" "PaymentChannel" NOT NULL DEFAULT 'WECHAT',
    "trade_no" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reason_text" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cs_cases" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "cs_user_id" UUID NOT NULL,
    "type" "CaseType" NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cs_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cs_milestones" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "name" "MilestoneName" NOT NULL,
    "status" TEXT NOT NULL,
    "evidence_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cs_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "commission_amount" INTEGER NOT NULL,
    "payout_amount" INTEGER NOT NULL,
    "payout_method" "SettlementPayoutMethod" NOT NULL,
    "payout_status" "SettlementPayoutStatus" NOT NULL,
    "payout_ref" TEXT,
    "payout_evidence_file_id" UUID,
    "payout_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_map_entries" (
    "id" UUID NOT NULL,
    "region_code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "patent_count" INTEGER NOT NULL,
    "industry_breakdown_json" JSONB,
    "top_assignees_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_map_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value_type" "SystemConfigValueType" NOT NULL,
    "value" TEXT NOT NULL,
    "scope" "SystemConfigScope" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "industry_tags_name_key" ON "industry_tags"("name");

-- CreateIndex
CREATE INDEX "user_verifications_user_id_status_idx" ON "user_verifications"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "patents_application_no_norm_key" ON "patents"("application_no_norm");

-- CreateIndex
CREATE UNIQUE INDEX "patent_identifiers_id_type_id_value_norm_key" ON "patent_identifiers"("id_type", "id_value_norm");

-- CreateIndex
CREATE UNIQUE INDEX "patent_classifications_patent_id_system_code_key" ON "patent_classifications"("patent_id", "system", "code");

-- CreateIndex
CREATE INDEX "patent_parties_patent_id_role_idx" ON "patent_parties"("patent_id", "role");

-- CreateIndex
CREATE INDEX "files_owner_scope_owner_id_idx" ON "files"("owner_scope", "owner_id");

-- CreateIndex
CREATE INDEX "listings_audit_status_status_idx" ON "listings"("audit_status", "status");

-- CreateIndex
CREATE INDEX "listings_region_code_idx" ON "listings"("region_code");

-- CreateIndex
CREATE INDEX "listing_media_listing_id_sort_idx" ON "listing_media"("listing_id", "sort");

-- CreateIndex
CREATE INDEX "listing_audit_logs_listing_id_created_at_idx" ON "listing_audit_logs"("listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "listing_favorites_listing_id_user_id_key" ON "listing_favorites"("listing_id", "user_id");

-- CreateIndex
CREATE INDEX "listing_consult_events_listing_id_created_at_idx" ON "listing_consult_events"("listing_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_tag_scores_user_id_tag_key" ON "user_tag_scores"("user_id", "tag");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "conversations_listing_id_updated_at_idx" ON "conversations"("listing_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "conversation_messages_conversation_id_created_at_idx" ON "conversation_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_pay_type_idx" ON "payments"("order_id", "pay_type");

-- CreateIndex
CREATE INDEX "refund_requests_order_id_status_idx" ON "refund_requests"("order_id", "status");

-- CreateIndex
CREATE INDEX "cs_cases_order_id_type_idx" ON "cs_cases"("order_id", "type");

-- CreateIndex
CREATE INDEX "cs_milestones_case_id_name_idx" ON "cs_milestones"("case_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_order_id_key" ON "settlements"("order_id");

-- CreateIndex
CREATE INDEX "settlements_payout_status_idx" ON "settlements"("payout_status");

-- CreateIndex
CREATE UNIQUE INDEX "patent_map_entries_region_code_year_key" ON "patent_map_entries"("region_code", "year");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_logo_file_id_fkey" FOREIGN KEY ("logo_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_identifiers" ADD CONSTRAINT "patent_identifiers_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_classifications" ADD CONSTRAINT "patent_classifications_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_parties" ADD CONSTRAINT "patent_parties_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_audit_logs" ADD CONSTRAINT "listing_audit_logs_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_audit_logs" ADD CONSTRAINT "listing_audit_logs_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_stats" ADD CONSTRAINT "listing_stats_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_consult_events" ADD CONSTRAINT "listing_consult_events_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_consult_events" ADD CONSTRAINT "listing_consult_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tag_scores" ADD CONSTRAINT "user_tag_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_cs_user_id_fkey" FOREIGN KEY ("assigned_cs_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_file_id_fkey" FOREIGN KEY ("invoice_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_user_id_fkey" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_cases" ADD CONSTRAINT "cs_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_cases" ADD CONSTRAINT "cs_cases_cs_user_id_fkey" FOREIGN KEY ("cs_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_milestones" ADD CONSTRAINT "cs_milestones_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cs_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_milestones" ADD CONSTRAINT "cs_milestones_evidence_file_id_fkey" FOREIGN KEY ("evidence_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_payout_evidence_file_id_fkey" FOREIGN KEY ("payout_evidence_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_map_entries" ADD CONSTRAINT "patent_map_entries_region_code_fkey" FOREIGN KEY ("region_code") REFERENCES "regions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_configs" ADD CONSTRAINT "system_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

