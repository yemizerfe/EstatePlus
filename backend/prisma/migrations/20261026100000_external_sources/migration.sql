-- External data sources: exchange rates (CBE/NBE), World Bank macro
-- indicators, and administrative boundaries (geoBoundaries).

CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rate_date" DATE NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "base_currency" VARCHAR(10) NOT NULL DEFAULT 'ETB',
    "cash_buying" DECIMAL(18,6),
    "cash_selling" DECIMAL(18,6),
    "transactional_buying" DECIMAL(18,6),
    "transactional_selling" DECIMAL(18,6),
    "source" VARCHAR(50) NOT NULL,
    "source_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "exchange_rates_rate_date_currency_source_key" ON "exchange_rates"("rate_date", "currency", "source");
CREATE INDEX "exchange_rates_currency_rate_date_idx" ON "exchange_rates"("currency", "rate_date" DESC);

CREATE TABLE "macro_indicators" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "indicator_code" VARCHAR(50) NOT NULL,
    "indicator_name" VARCHAR(255) NOT NULL,
    "country" VARCHAR(8) NOT NULL DEFAULT 'ETH',
    "year" INTEGER NOT NULL,
    "value" DECIMAL(24,4) NOT NULL,
    "unit" VARCHAR(50),
    "source" VARCHAR(100) NOT NULL DEFAULT 'World Bank Open Data',
    "source_url" TEXT,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macro_indicators_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "macro_indicators_indicator_code_year_country_key" ON "macro_indicators"("indicator_code", "year", "country");
CREATE INDEX "macro_indicators_indicator_code_year_idx" ON "macro_indicators"("indicator_code", "year" DESC);

CREATE TABLE "geographic_boundaries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "country" VARCHAR(8) NOT NULL DEFAULT 'ETH',
    "admin_level" VARCHAR(10) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "geometry" JSONB NOT NULL,
    "properties" JSONB,
    "source" VARCHAR(100) NOT NULL DEFAULT 'geoBoundaries gbOpen',
    "license" VARCHAR(255),
    "source_year" INTEGER,
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geographic_boundaries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "geographic_boundaries_country_admin_level_name_key" ON "geographic_boundaries"("country", "admin_level", "name");
CREATE INDEX "geographic_boundaries_admin_level_idx" ON "geographic_boundaries"("admin_level");
