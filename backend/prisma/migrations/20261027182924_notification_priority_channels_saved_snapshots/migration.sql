-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PROPERTY';
ALTER TYPE "NotificationType" ADD VALUE 'ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'MARKET';
ALTER TYPE "NotificationType" ADD VALUE 'ANALYSIS';
ALTER TYPE "NotificationType" ADD VALUE 'FORECAST';
ALTER TYPE "NotificationType" ADD VALUE 'NOTICE';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
ADD COLUMN     "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "saved_properties" ADD COLUMN     "baths" SMALLINT,
ADD COLUMN     "beds" SMALLINT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "neighborhood" VARCHAR(150),
ADD COLUMN     "price" DECIMAL(15,2),
ADD COLUMN     "size" DECIMAL(10,2),
ADD COLUMN     "title" VARCHAR(255);
