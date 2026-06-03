-- Remove demand/artwork data and schema
DELETE FROM "conversation_messages"
WHERE "conversation_id" IN (
  SELECT "id" FROM "conversations" WHERE "content_type" IN ('DEMAND', 'ARTWORK')
);

DELETE FROM "conversation_participants"
WHERE "conversation_id" IN (
  SELECT "id" FROM "conversations" WHERE "content_type" IN ('DEMAND', 'ARTWORK')
);

DELETE FROM "conversations" WHERE "content_type" IN ('DEMAND', 'ARTWORK');
DELETE FROM "content_events" WHERE "content_type" IN ('DEMAND', 'ARTWORK');
DELETE FROM "comments" WHERE "content_type" IN ('DEMAND', 'ARTWORK');

DELETE FROM "ai_parse_feedbacks"
WHERE "parse_result_id" IN (
  SELECT "id" FROM "ai_parse_results" WHERE "content_type" IN ('DEMAND', 'ARTWORK')
);
DELETE FROM "ai_parse_results" WHERE "content_type" IN ('DEMAND', 'ARTWORK');

DELETE FROM "alert_events" WHERE "target_type" IN ('DEMAND', 'ARTWORK');
DELETE FROM "files" WHERE "owner_scope" IN ('DEMAND', 'ARTWORK');

DROP TABLE IF EXISTS "demand_media" CASCADE;
DROP TABLE IF EXISTS "demand_favorites" CASCADE;
DROP TABLE IF EXISTS "demand_stats" CASCADE;
DROP TABLE IF EXISTS "demands" CASCADE;

DROP TABLE IF EXISTS "artwork_media" CASCADE;
DROP TABLE IF EXISTS "artwork_favorites" CASCADE;
DROP TABLE IF EXISTS "artwork_stats" CASCADE;
DROP TABLE IF EXISTS "artworks" CASCADE;

-- Recreate enums without demand/artwork values
CREATE TYPE "FileOwnerScope_new" AS ENUM (
  'LISTING',
  'ACHIEVEMENT',
  'CASE',
  'REFUND_REQUEST',
  'INVOICE',
  'USER',
  'USER_VERIFICATION',
  'MESSAGE'
);
ALTER TABLE "files"
  ALTER COLUMN "owner_scope" TYPE "FileOwnerScope_new"
  USING ("owner_scope"::text::"FileOwnerScope_new");
DROP TYPE "FileOwnerScope";
ALTER TYPE "FileOwnerScope_new" RENAME TO "FileOwnerScope";

CREATE TYPE "ConversationContentType_new" AS ENUM ('LISTING', 'ACHIEVEMENT', 'TECH_MANAGER');
ALTER TABLE "conversations"
  ALTER COLUMN "content_type" TYPE "ConversationContentType_new"
  USING ("content_type"::text::"ConversationContentType_new");
DROP TYPE "ConversationContentType";
ALTER TYPE "ConversationContentType_new" RENAME TO "ConversationContentType";

CREATE TYPE "CommentContentType_new" AS ENUM ('LISTING', 'ACHIEVEMENT');
ALTER TABLE "comments"
  ALTER COLUMN "content_type" TYPE "CommentContentType_new"
  USING ("content_type"::text::"CommentContentType_new");
ALTER TABLE "content_events"
  ALTER COLUMN "content_type" TYPE "CommentContentType_new"
  USING ("content_type"::text::"CommentContentType_new");
DROP TYPE "CommentContentType";
ALTER TYPE "CommentContentType_new" RENAME TO "CommentContentType";

CREATE TYPE "AiContentType_new" AS ENUM ('LISTING', 'ACHIEVEMENT');
ALTER TABLE "ai_parse_results"
  ALTER COLUMN "content_type" TYPE "AiContentType_new"
  USING ("content_type"::text::"AiContentType_new");
DROP TYPE "AiContentType";
ALTER TYPE "AiContentType_new" RENAME TO "AiContentType";

CREATE TYPE "AlertTargetType_new" AS ENUM (
  'PATENT',
  'ORDER',
  'LISTING',
  'ACHIEVEMENT',
  'AI_PARSE',
  'IMPORT',
  'PAYMENT',
  'REFUND',
  'SYSTEM'
);
ALTER TABLE "alert_events"
  ALTER COLUMN "target_type" TYPE "AlertTargetType_new"
  USING ("target_type"::text::"AlertTargetType_new");
DROP TYPE "AlertTargetType";
ALTER TYPE "AlertTargetType_new" RENAME TO "AlertTargetType";

DROP TYPE IF EXISTS "ArtworkStatus";
DROP TYPE IF EXISTS "ArtworkCategory";
DROP TYPE IF EXISTS "CalligraphyScript";
DROP TYPE IF EXISTS "PaintingGenre";
DROP TYPE IF EXISTS "DeliveryPeriod";
