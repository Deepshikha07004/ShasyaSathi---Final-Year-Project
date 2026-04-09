-- CreateTable
CREATE TABLE "harvest_records" (
    "id" TEXT NOT NULL,
    "farmerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "farmerCropId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "harvestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "harvest_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cold_storages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "nameHi" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerContact" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cold_storages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cold_storage_crops" (
    "id" TEXT NOT NULL,
    "coldStorageId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,

    CONSTRAINT "cold_storage_crops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "harvest_records_farmerId_locationId_idx" ON "harvest_records"("farmerId", "locationId");

-- CreateIndex
CREATE INDEX "harvest_records_farmerCropId_idx" ON "harvest_records"("farmerCropId");

-- CreateIndex
CREATE INDEX "cold_storages_latitude_longitude_idx" ON "cold_storages"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "cold_storages_district_state_idx" ON "cold_storages"("district", "state");

-- CreateIndex
CREATE INDEX "cold_storage_crops_coldStorageId_idx" ON "cold_storage_crops"("coldStorageId");

-- CreateIndex
CREATE INDEX "cold_storage_crops_cropId_idx" ON "cold_storage_crops"("cropId");

-- CreateIndex
CREATE UNIQUE INDEX "cold_storage_crops_coldStorageId_cropId_key" ON "cold_storage_crops"("coldStorageId", "cropId");

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_farmerId_fkey" FOREIGN KEY ("farmerId") REFERENCES "farmers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "farmer_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_records" ADD CONSTRAINT "harvest_records_farmerCropId_fkey" FOREIGN KEY ("farmerCropId") REFERENCES "farmer_crops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_storage_crops" ADD CONSTRAINT "cold_storage_crops_coldStorageId_fkey" FOREIGN KEY ("coldStorageId") REFERENCES "cold_storages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cold_storage_crops" ADD CONSTRAINT "cold_storage_crops_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "crops_master"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
