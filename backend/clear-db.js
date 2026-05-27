const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDB() {
  console.log('🗑️  Clearing tables...');
  
  await prisma.coldStorageCrop.deleteMany({});
  console.log('✅ Cleared ColdStorageCrop');
  
  await prisma.coldStorage.deleteMany({});
  console.log('✅ Cleared ColdStorage');
  
  await prisma.harvestRecord.deleteMany({});
  console.log('✅ Cleared HarvestRecord');
  
  await prisma.farmerCrop.deleteMany({});
  console.log('✅ Cleared FarmerCrop');
  
  await prisma.cropMaster.deleteMany({});
  console.log('✅ Cleared CropMaster');
  
  console.log('\n🎉 All tables cleared! Now run the seed script.');
  await prisma.$disconnect();
}

clearDB().catch(e => {
  console.error('❌ Error:', e);
  prisma.$disconnect();
  process.exit(1);
});node src/cold-storage/scripts/seedColdStorage.js