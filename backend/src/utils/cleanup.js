const prisma = require('../config/database');

async function cleanup() {
  try {
    console.log('🗑️  Deleting old data...\n');

    // Delete crop links first (foreign key constraint)
    const deletedCrops = await prisma.coldStorageCrop.deleteMany({});
    console.log(`✅ Deleted ${deletedCrops.count} crop links`);

    // Delete warehouses
    const deletedWarehouses = await prisma.coldStorage.deleteMany({});
    console.log(`✅ Deleted ${deletedWarehouses.count} warehouses`);

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();