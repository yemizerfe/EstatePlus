-- AlterTable
ALTER TABLE "property_history" ADD COLUMN     "notes" TEXT;

-- AddForeignKey
ALTER TABLE "property_history" ADD CONSTRAINT "property_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

