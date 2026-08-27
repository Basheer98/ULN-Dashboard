-- AlterTable
CREATE TYPE "MileagePhotoKind" AS ENUM ('start_odometer', 'end_odometer');

-- CreateTable
CREATE TABLE "mileage_photos" (
    "id" TEXT NOT NULL,
    "mileage_entry_id" TEXT,
    "kind" "MileagePhotoKind" NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "stored_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "storage_file_id" TEXT,
    "storage_url" TEXT,
    "file_hash" TEXT,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mileage_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mileage_photos_mileage_entry_id_idx" ON "mileage_photos"("mileage_entry_id");

-- CreateIndex
CREATE INDEX "mileage_photos_file_hash_idx" ON "mileage_photos"("file_hash");

-- AddForeignKey
ALTER TABLE "mileage_photos" ADD CONSTRAINT "mileage_photos_mileage_entry_id_fkey" FOREIGN KEY ("mileage_entry_id") REFERENCES "mileage_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_photos" ADD CONSTRAINT "mileage_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
