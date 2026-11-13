-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ViewingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "inquiries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "sender_id" UUID,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(40),
    "message" VARCHAR(2000) NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "response" VARCHAR(2000),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "property_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "client_name" VARCHAR(150) NOT NULL,
    "client_email" VARCHAR(255) NOT NULL,
    "client_phone" VARCHAR(40),
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "ViewingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "viewings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "owner_id" UUID NOT NULL,
    "property_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_owner_id_status_idx" ON "inquiries"("owner_id", "status");

-- CreateIndex
CREATE INDEX "inquiries_property_id_idx" ON "inquiries"("property_id");

-- CreateIndex
CREATE INDEX "inquiries_created_at_idx" ON "inquiries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "viewings_owner_id_status_idx" ON "viewings"("owner_id", "status");

-- CreateIndex
CREATE INDEX "viewings_owner_id_scheduled_at_idx" ON "viewings"("owner_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "property_documents_owner_id_created_at_idx" ON "property_documents"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "property_documents_property_id_idx" ON "property_documents"("property_id");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
