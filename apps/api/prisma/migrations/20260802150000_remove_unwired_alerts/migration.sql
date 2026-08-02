DELETE FROM "system_configs"
WHERE "key" = 'alert_config';

DROP TABLE IF EXISTS "alert_events" CASCADE;

DROP TYPE IF EXISTS "AlertTargetType";
DROP TYPE IF EXISTS "AlertStatus";
DROP TYPE IF EXISTS "AlertChannel";
DROP TYPE IF EXISTS "AlertSeverity";
