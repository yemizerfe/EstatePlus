-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'RENT', 'BOTH');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SOLD', 'RENTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AmenityType" AS ENUM ('SCHOOL', 'HOSPITAL', 'CLINIC', 'PHARMACY', 'SUPERMARKET', 'RESTAURANT', 'BANK', 'ATM', 'GAS_STATION', 'PUBLIC_TRANSPORT', 'PARK', 'MOSQUE', 'CHURCH', 'SHOPPING_MALL', 'MARKET', 'POLICE_STATION', 'FIRE_STATION', 'POST_OFFICE', 'LIBRARY', 'GYM', 'HOTEL', 'ENTERTAINMENT', 'GOVERNMENT_OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "StatisticType" AS ENUM ('POPULATION_DENSITY', 'CRIME_RATE', 'TRAFFIC_VOLUME', 'AIR_QUALITY', 'NOISE_LEVEL', 'AMENITY_COUNT', 'WALKABILITY_SCORE', 'TRANSIT_SCORE', 'BIKE_SCORE', 'EDUCATION_SCORE', 'SAFETY_SCORE', 'LIVABILITY_INDEX', 'PROPERTY_DEMAND', 'PROPERTY_SUPPLY', 'RENT_AFFORDABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PRICE_ALERT', 'NEW_LISTING', 'PROPERTY_APPROVED', 'PROPERTY_REJECTED', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "AuthProvider_new" AS ENUM ('LOCAL', 'GOOGLE');
ALTER TABLE "users" ALTER COLUMN "auth_provider" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "auth_provider" TYPE "AuthProvider_new" USING (upper("auth_provider"::text)::"AuthProvider_new");
ALTER TYPE "AuthProvider" RENAME TO "AuthProvider_old";
ALTER TYPE "AuthProvider_new" RENAME TO "AuthProvider";
DROP TYPE "AuthProvider_old";
ALTER TABLE "users" ALTER COLUMN "auth_provider" SET DEFAULT 'LOCAL';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EconomicIndicatorType_new" AS ENUM ('INFLATION_RATE', 'INTEREST_RATE', 'EXCHANGE_RATE', 'CONSTRUCTION_COST_INDEX', 'GDP_GROWTH', 'UNEMPLOYMENT_RATE', 'CONSUMER_PRICE_INDEX', 'MONEY_SUPPLY', 'BANK_LENDING_RATE', 'GOVERNMENT_DEBT', 'IMPORT_PRICE_INDEX', 'EXPORT_PRICE_INDEX', 'REAL_ESTATE_PRICE_INDEX', 'RENTAL_YIELD_INDEX', 'HOUSING_AFFORDABILITY', 'MORTGAGE_RATE', 'CREDIT_GROWTH', 'FOREIGN_INVESTMENT', 'TAX_REVENUE', 'OTHER');
ALTER TABLE "economic_indicators" ALTER COLUMN "indicator_type" TYPE "EconomicIndicatorType_new" USING (
  CASE "indicator_type"::text
    WHEN 'inflation' THEN 'INFLATION_RATE'
    WHEN 'interest_rate' THEN 'INTEREST_RATE'
    WHEN 'exchange_rate' THEN 'EXCHANGE_RATE'
    WHEN 'construction_cost' THEN 'CONSTRUCTION_COST_INDEX'
    ELSE upper("indicator_type"::text)
  END::"EconomicIndicatorType_new"
);
ALTER TYPE "EconomicIndicatorType" RENAME TO "EconomicIndicatorType_old";
ALTER TYPE "EconomicIndicatorType_new" RENAME TO "EconomicIndicatorType";
DROP TYPE "EconomicIndicatorType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyCondition_new" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'NEEDS_RENOVATION');
ALTER TABLE "properties" ALTER COLUMN "condition" TYPE "PropertyCondition_new" USING (upper("condition"::text)::"PropertyCondition_new");
ALTER TYPE "PropertyCondition" RENAME TO "PropertyCondition_old";
ALTER TYPE "PropertyCondition_new" RENAME TO "PropertyCondition";
DROP TYPE "PropertyCondition_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyStatus_new" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED', 'ACTIVE', 'INACTIVE', 'SOLD', 'RENTED', 'UNDER_CONTRACT');
ALTER TABLE "properties" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "properties" ALTER COLUMN "status" TYPE "PropertyStatus_new" USING (upper("status"::text)::"PropertyStatus_new");
ALTER TYPE "PropertyStatus" RENAME TO "PropertyStatus_old";
ALTER TYPE "PropertyStatus_new" RENAME TO "PropertyStatus";
DROP TYPE "PropertyStatus_old";
ALTER TABLE "properties" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyType_new" AS ENUM ('APARTMENT', 'VILLA', 'CONDOMINIUM', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND');
ALTER TABLE "properties" ALTER COLUMN "property_type" TYPE "PropertyType_new" USING (
  CASE "property_type"::text
    WHEN 'house' THEN 'VILLA'
    WHEN 'commercial' THEN 'OFFICE'
    ELSE upper("property_type"::text)
  END::"PropertyType_new"
);
ALTER TABLE "market_statistics" ALTER COLUMN "property_type" TYPE "PropertyType_new" USING (
  CASE "property_type"::text
    WHEN 'house' THEN 'VILLA'
    WHEN 'commercial' THEN 'OFFICE'
    ELSE upper("property_type"::text)
  END::"PropertyType_new"
);
ALTER TABLE "forecasts" ALTER COLUMN "property_type" TYPE "PropertyType_new" USING (
  CASE "property_type"::text
    WHEN 'house' THEN 'VILLA'
    WHEN 'commercial' THEN 'OFFICE'
    ELSE upper("property_type"::text)
  END::"PropertyType_new"
);
ALTER TYPE "PropertyType" RENAME TO "PropertyType_old";
ALTER TYPE "PropertyType_new" RENAME TO "PropertyType";
DROP TYPE "PropertyType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'PROPERTY_OWNER', 'ANALYST', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING (upper("role"::text)::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "economic_indicators" ADD COLUMN     "created_by" UUID,
ADD COLUMN     "source_url" TEXT;

-- AlterTable
ALTER TABLE "neighborhoods" ADD COLUMN     "average_income" DECIMAL(12,2),
ADD COLUMN     "center_lat" DECIMAL(10,8),
ADD COLUMN     "center_lng" DECIMAL(11,8),
ADD COLUMN     "coordinates" JSONB,
ADD COLUMN     "established_year" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "population" INTEGER,
ADD COLUMN     "safety_rating" DECIMAL(3,2),
ADD COLUMN     "subcity" VARCHAR(150),
ADD COLUMN     "walk_score" INTEGER;

-- AlterTable
ALTER TABLE "properties" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_password_change" TIMESTAMP(3),
ADD COLUMN     "microsoft_id" VARCHAR(255),
ALTER COLUMN "role" SET DEFAULT 'USER',
ALTER COLUMN "auth_provider" SET DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "neighborhood_amenities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "neighborhood_id" UUID NOT NULL,
    "amenity_type" "AmenityType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "address" VARCHAR(300),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "distance" INTEGER,
    "rating" DECIMAL(3,2),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "neighborhood_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhood_statistics" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "neighborhood_id" UUID NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "statistic_type" "StatisticType" NOT NULL,
    "value" DECIMAL(15,4) NOT NULL,
    "unit" VARCHAR(50),
    "metadata" JSONB,
    "source" VARCHAR(200),
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhood_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" VARCHAR(255),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "listing_type" "ListingType" NOT NULL,
    "current_price" DECIMAL(15,2) NOT NULL,
    "original_price" DECIMAL(15,2) NOT NULL,
    "rental_price" DECIMAL(15,2),
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "listed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "inquiry_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_price_history" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "listing_id" UUID NOT NULL,
    "old_price" DECIMAL(15,2) NOT NULL,
    "new_price" DECIMAL(15,2) NOT NULL,
    "change_reason" VARCHAR(255),
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_properties" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "filters" JSONB NOT NULL,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "period" VARCHAR(7),
    "neighborhood_ids" JSONB,
    "market_data" JSONB NOT NULL,
    "economic_data" JSONB,
    "analysis" TEXT,
    "conclusions" TEXT,
    "author_id" UUID NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM',
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "link" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "neighborhood_amenities_neighborhood_id_amenity_type_idx" ON "neighborhood_amenities"("neighborhood_id", "amenity_type");

-- CreateIndex
CREATE INDEX "neighborhood_amenities_amenity_type_idx" ON "neighborhood_amenities"("amenity_type");

-- CreateIndex
CREATE INDEX "neighborhood_statistics_period_idx" ON "neighborhood_statistics"("period");

-- CreateIndex
CREATE INDEX "neighborhood_statistics_statistic_type_idx" ON "neighborhood_statistics"("statistic_type");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhood_statistics_neighborhood_id_period_statistic_ty_key" ON "neighborhood_statistics"("neighborhood_id", "period", "statistic_type");

-- CreateIndex
CREATE INDEX "property_images_property_id_sort_order_idx" ON "property_images"("property_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "property_images_property_id_is_primary_key" ON "property_images"("property_id", "is_primary");

-- CreateIndex
CREATE INDEX "listings_property_id_idx" ON "listings"("property_id");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "listings_listing_type_idx" ON "listings"("listing_type");

-- CreateIndex
CREATE INDEX "listings_listed_at_idx" ON "listings"("listed_at" DESC);

-- CreateIndex
CREATE INDEX "listing_price_history_listing_id_idx" ON "listing_price_history"("listing_id");

-- CreateIndex
CREATE INDEX "listing_price_history_changed_at_idx" ON "listing_price_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "saved_properties_user_id_idx" ON "saved_properties"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_properties_user_id_property_id_key" ON "saved_properties"("user_id", "property_id");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

-- CreateIndex
CREATE INDEX "saved_searches_last_used_at_idx" ON "saved_searches"("last_used_at");

-- CreateIndex
CREATE INDEX "reports_author_id_idx" ON "reports"("author_id");

-- CreateIndex
CREATE INDEX "reports_generated_at_idx" ON "reports"("generated_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "neighborhoods_city_subcity_idx" ON "neighborhoods"("city", "subcity");

-- CreateIndex
CREATE INDEX "neighborhoods_is_active_idx" ON "neighborhoods"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "users_microsoft_id_key" ON "users"("microsoft_id");

-- CreateIndex
CREATE INDEX "users_microsoft_id_idx" ON "users"("microsoft_id");

-- AddForeignKey
ALTER TABLE "neighborhood_amenities" ADD CONSTRAINT "neighborhood_amenities_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_statistics" ADD CONSTRAINT "neighborhood_statistics_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_properties" ADD CONSTRAINT "saved_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economic_indicators" ADD CONSTRAINT "economic_indicators_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

