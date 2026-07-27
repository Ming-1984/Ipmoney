UPDATE "notifications"
SET "kind" = 'system'
WHERE "kind"::text = 'cs';

ALTER TYPE "NotificationKind" RENAME TO "NotificationKind_old";

CREATE TYPE "NotificationKind" AS ENUM ('system');

ALTER TABLE "notifications"
  ALTER COLUMN "kind" TYPE "NotificationKind"
  USING ("kind"::text::"NotificationKind");

DROP TYPE "NotificationKind_old";
