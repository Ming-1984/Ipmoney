-- Drop legacy content tables
DROP TABLE IF EXISTS "artwork_stats" CASCADE;
DROP TABLE IF EXISTS "artwork_favorites" CASCADE;
DROP TABLE IF EXISTS "artwork_media" CASCADE;
DROP TABLE IF EXISTS "artworks" CASCADE;
DROP TABLE IF EXISTS "achievement_stats" CASCADE;
DROP TABLE IF EXISTS "achievement_favorites" CASCADE;
DROP TABLE IF EXISTS "achievement_media" CASCADE;
DROP TABLE IF EXISTS "achievements" CASCADE;
DROP TABLE IF EXISTS "demand_stats" CASCADE;
DROP TABLE IF EXISTS "demand_favorites" CASCADE;
DROP TABLE IF EXISTS "demand_media" CASCADE;
DROP TABLE IF EXISTS "demands" CASCADE;
DROP TABLE IF EXISTS "patent_map_entries" CASCADE;
DROP TABLE IF EXISTS "announcements" CASCADE;

-- Drop legacy enum types
DROP TYPE IF EXISTS "ContentStatus";
DROP TYPE IF EXISTS "ArtworkStatus";
DROP TYPE IF EXISTS "ContentMediaType";
DROP TYPE IF EXISTS "ArtworkCategory";
DROP TYPE IF EXISTS "CalligraphyScript";
DROP TYPE IF EXISTS "PaintingGenre";
DROP TYPE IF EXISTS "AchievementMaturity";
DROP TYPE IF EXISTS "DeliveryPeriod";
DROP TYPE IF EXISTS "AnnouncementStatus";
