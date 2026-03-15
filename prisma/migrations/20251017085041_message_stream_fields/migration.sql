/*
  Warnings:

  - You are about to drop the column `conversationId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `chat_participants` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `conversations` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `title` on table `chats` required. This step will fail if there are existing NULL values in that column.
  - Made the column `chatId` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'STREAMING', 'DONE', 'ERROR');

-- DropForeignKey
ALTER TABLE "public"."chat_participants" DROP CONSTRAINT "chat_participants_chatId_fkey";

-- DropForeignKey
ALTER TABLE "public"."chat_participants" DROP CONSTRAINT "chat_participants_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."conversations" DROP CONSTRAINT "conversations_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropIndex
DROP INDEX "public"."messages_conversationId_idx";

-- AlterTable
ALTER TABLE "chats" ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "title" SET DEFAULT 'Nueva conversación';

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "conversationId",
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'DONE',
ADD COLUMN     "streamId" TEXT,
ALTER COLUMN "chatId" SET NOT NULL;

-- DropTable
DROP TABLE "public"."chat_participants";

-- DropTable
DROP TABLE "public"."conversations";

-- DropEnum
DROP TYPE "public"."ChatRole";
