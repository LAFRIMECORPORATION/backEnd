/*
  Warnings:

  - Added the required column `user_id` to the `investments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "FeedEventType" ADD VALUE 'project_view';

-- AlterTable
ALTER TABLE "escrow_milestones" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "investments" ADD COLUMN     "refund_reason" TEXT,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "pay_token" TEXT,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "reference_id" TEXT,
ADD COLUMN     "stripe_payment_intent_id" TEXT;
