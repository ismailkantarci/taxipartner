-- AlterTable
ALTER TABLE "User" ADD COLUMN "fullName" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "preferredLanguage" TEXT DEFAULT 'de-AT';
ALTER TABLE "User" ADD COLUMN "preferredTheme" TEXT DEFAULT 'system';
