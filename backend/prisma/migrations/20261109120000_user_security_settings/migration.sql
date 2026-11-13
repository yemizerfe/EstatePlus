-- Per-user security preferences, edited from the profile screens.
ALTER TABLE "users" ADD COLUMN "security_settings" JSONB;
