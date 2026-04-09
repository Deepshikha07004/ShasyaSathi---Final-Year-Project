/*
  Warnings:

  - A unique constraint covering the columns `[locationId]` on the table `weather_data` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "weather_data_locationId_key" ON "weather_data"("locationId");
