-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'ar';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "recipient_lang" TEXT NOT NULL DEFAULT 'ar';
