-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'property_owner', 'analyst', 'admin');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'house', 'villa', 'commercial', 'land', 'office');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('new', 'excellent', 'good', 'fair', 'needs_renovation');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'archived', 'active', 'inactive', 'sold', 'rented');

-- CreateEnum
CREATE TYPE "EconomicIndicatorType" AS ENUM ('inflation', 'interest_rate', 'exchange_rate', 'construction_cost');

-- CreateEnum
CREATE TYPE "ForecastType" AS ENUM ('price', 'rental');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('local', 'google');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'local',
    "google_id" VARCHAR(255),
    "profile_picture" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "city" VARCHAR(150) NOT NULL DEFAULT 'Addis Ababa',
    "description" TEXT,
    "area_sqkm" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "neighborhood_id" UUID,
    "address" TEXT,
    "sub_area" VARCHAR(150),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "property_type" "PropertyType" NOT NULL,
    "condition" "PropertyCondition" NOT NULL,
    "neighborhood_id" UUID NOT NULL,
    "location_id" UUID,
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "size_sqm" DECIMAL(10,2) NOT NULL,
    "bedrooms" SMALLINT NOT NULL DEFAULT 0,
    "bathrooms" SMALLINT NOT NULL DEFAULT 0,
    "asking_price" DECIMAL(15,2) NOT NULL,
    "rental_price" DECIMAL(15,2),
    "listing_date" DATE NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'draft',
    "owner_id" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_statistics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "neighborhood_id" UUID,
    "property_type" "PropertyType",
    "period" VARCHAR(7) NOT NULL,
    "avg_price" DECIMAL(15,2),
    "median_price" DECIMAL(15,2),
    "price_per_sqm" DECIMAL(10,2),
    "avg_rental_price" DECIMAL(15,2),
    "rental_yield" DECIMAL(6,4),
    "price_growth" DECIMAL(8,4),
    "rent_growth" DECIMAL(8,4),
    "active_listings" INTEGER,
    "sample_size" INTEGER,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economic_indicators" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "indicator_type" "EconomicIndicatorType" NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "recorded_at" DATE NOT NULL,
    "source" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "valuations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "estimated_value" DECIMAL(15,2) NOT NULL,
    "asking_price" DECIMAL(15,2) NOT NULL,
    "price_difference" DECIMAL(15,2) NOT NULL,
    "price_difference_pct" DECIMAL(8,4) NOT NULL,
    "comparable_count" INTEGER NOT NULL DEFAULT 0,
    "methodology" TEXT,
    "confidence_score" DECIMAL(4,3),
    "calculated_by" UUID,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "neighborhood_id" UUID,
    "property_type" "PropertyType",
    "forecast_type" "ForecastType" NOT NULL,
    "base_value" DECIMAL(15,2) NOT NULL,
    "forecast_months" SMALLINT NOT NULL DEFAULT 6,
    "trend_slope" DECIMAL(12,6),
    "r_squared" DECIMAL(6,4),
    "data_points" INTEGER,
    "forecast_data" JSONB NOT NULL,
    "assumptions" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "parameters" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "scenario_id" UUID NOT NULL,
    "neighborhood_id" UUID,
    "price_impact_pct" DECIMAL(8,4),
    "rental_impact_pct" DECIMAL(8,4),
    "demand_impact" VARCHAR(50),
    "supply_impact" VARCHAR(50),
    "calculated_results" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "ai_explanation" TEXT,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "alert_type" VARCHAR(100) NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "neighborhood_id" UUID,
    "property_id" UUID,
    "metadata" JSONB,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_import_jobs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "source_id" UUID,
    "job_type" VARCHAR(100) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "records_received" INTEGER NOT NULL DEFAULT 0,
    "records_valid" INTEGER NOT NULL DEFAULT 0,
    "records_rejected" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "file_name" VARCHAR(255),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(255),
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_google_id_idx" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_name_key" ON "neighborhoods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_slug_key" ON "neighborhoods"("slug");

-- CreateIndex
CREATE INDEX "neighborhoods_slug_idx" ON "neighborhoods"("slug");

-- CreateIndex
CREATE INDEX "locations_neighborhood_id_idx" ON "locations"("neighborhood_id");

-- CreateIndex
CREATE INDEX "properties_neighborhood_id_idx" ON "properties"("neighborhood_id");

-- CreateIndex
CREATE INDEX "properties_property_type_idx" ON "properties"("property_type");

-- CreateIndex
CREATE INDEX "properties_status_idx" ON "properties"("status");

-- CreateIndex
CREATE INDEX "properties_owner_id_idx" ON "properties"("owner_id");

-- CreateIndex
CREATE INDEX "properties_asking_price_idx" ON "properties"("asking_price");

-- CreateIndex
CREATE INDEX "properties_listing_date_idx" ON "properties"("listing_date" DESC);

-- CreateIndex
CREATE INDEX "property_history_property_id_idx" ON "property_history"("property_id");

-- CreateIndex
CREATE INDEX "property_history_changed_at_idx" ON "property_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "market_statistics_neighborhood_id_idx" ON "market_statistics"("neighborhood_id");

-- CreateIndex
CREATE INDEX "market_statistics_period_idx" ON "market_statistics"("period" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "market_statistics_neighborhood_id_property_type_period_key" ON "market_statistics"("neighborhood_id", "property_type", "period");

-- CreateIndex
CREATE INDEX "economic_indicators_indicator_type_idx" ON "economic_indicators"("indicator_type");

-- CreateIndex
CREATE INDEX "economic_indicators_recorded_at_idx" ON "economic_indicators"("recorded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "economic_indicators_indicator_type_recorded_at_key" ON "economic_indicators"("indicator_type", "recorded_at");

-- CreateIndex
CREATE INDEX "valuations_property_id_idx" ON "valuations"("property_id");

-- CreateIndex
CREATE INDEX "forecasts_neighborhood_id_idx" ON "forecasts"("neighborhood_id");

-- CreateIndex
CREATE INDEX "forecasts_generated_at_idx" ON "forecasts"("generated_at" DESC);

-- CreateIndex
CREATE INDEX "scenarios_created_by_idx" ON "scenarios"("created_by");

-- CreateIndex
CREATE INDEX "scenario_results_scenario_id_idx" ON "scenario_results"("scenario_id");

-- CreateIndex
CREATE INDEX "alerts_alert_type_idx" ON "alerts"("alert_type");

-- CreateIndex
CREATE INDEX "alerts_created_at_idx" ON "alerts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "data_import_jobs_status_idx" ON "data_import_jobs"("status");

-- CreateIndex
CREATE INDEX "data_import_jobs_created_at_idx" ON "data_import_jobs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_history" ADD CONSTRAINT "property_history_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_statistics" ADD CONSTRAINT "market_statistics_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_results" ADD CONSTRAINT "scenario_results_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_results" ADD CONSTRAINT "scenario_results_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_import_jobs" ADD CONSTRAINT "data_import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
