const XLSX = require('xlsx');
const prisma = require('../config/database');

async function importWithCoordinates() {
  try {
    console.log('📊 Importing with ACCURATE GEOCODED coordinates...\n');
    console.log('=' .repeat(70));

    // ===================================
    // STEP 1: READ EXCEL WITH COORDINATES
    // ===================================
    console.log('\n📂 Reading geocoded Excel file...');
    
    const filePath = 'data/WEST_BENGAL_WAREHOUSE_DATA.xlsx'; // YOUR ACCURATE GEOCODED FILE
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Sheet: ${sheetName}`);
    console.log(`✅ Total rows: ${rawData.length}\n`);

    // ===================================
    // STEP 2: GET ALL CROPS
    // ===================================
    console.log('🌾 Fetching crops from database...');

    const cropsInDb = await prisma.cropMaster.findMany({
      select: { id: true, cropNameEn: true }
    });

    console.log(`✅ Found ${cropsInDb.length} crops\n`);

    // Create comprehensive crop mapping
    const cropMapping = {};
    cropsInDb.forEach(crop => {
      const nameLower = crop.cropNameEn.toLowerCase();
      cropMapping[nameLower] = crop.id;
    });

    // Add all common variations
    const variations = {
      'rice': ['paddy', 'dhan'],
      'potato': ['potatoes', 'aloo'],
      'tomato': ['tomatoes'],
      'wheat': ['gehun'],
      'maize': ['corn', 'makka', 'bhutta'],
      'jute': ['pat'],
      'brinjal': ['eggplant', 'baingan'],
      'eggplant': ['brinjal', 'baingan'],
      'chilli': ['chili', 'mirch', 'green chilli'],
      'green chilli': ['chilli', 'chili', 'mirch'],
      'ladyfinger': ['okra', 'bhindi'],
      'coriander': ['cilantro', 'dhania'],
      'carrot': ['carrots', 'gajar'],
      'carrots': ['carrot', 'gajar'],
      'banana': ['bananas', 'kela'],
      'guava': ['guavas', 'amrud'],
      'mango': ['mangoes', 'aam'],
      'orange': ['oranges', 'santra'],
      'pineapple': ['pineapples'],
      'litchi': ['lychee', 'litchis', 'lichi'],
      'coconut': ['coconuts', 'nariyal'],
      'cashew': ['cashews', 'cashewnut', 'kaju'],
      'beans': ['bean'],
      'cucumber': ['cucumbers', 'kheera'],
      'pumpkin': ['pumpkins', 'kaddu'],
      'cauliflower': ['cauliflowers', 'gobhi'],
      'cabbage': ['cabbages', 'patta gobhi']
    };

    Object.entries(variations).forEach(([mainName, alts]) => {
      const mainId = cropMapping[mainName];
      if (mainId) {
        alts.forEach(alt => {
          cropMapping[alt.toLowerCase()] = mainId;
        });
      }
    });

    console.log(`✅ Crop mapping ready (${Object.keys(cropMapping).length} variations)\n`);

    // ===================================
    // STEP 3: IMPORT WITH COORDINATES
    // ===================================
    console.log('📥 Importing warehouses with accurate coordinates...\n');

    let imported = 0;
    let skipped = 0;
    let totalCropsLinked = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      
      const name = row['WH Name'];
      if (!name) continue;

      // READ COORDINATES FROM EXCEL
      const latitude = parseFloat(row['Latitude']);
      const longitude = parseFloat(row['Longitude']);

      // Validate coordinates
      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        console.log(`⚠️  [${i + 1}] Skipping ${name.substring(0, 40)}... - No valid coordinates`);
        skipped++;
        continue;
      }

      // Skip if coordinates are "Not Found" or "Error"
      if (row['Latitude'] === 'Not Found' || row['Latitude'] === 'Error') {
        console.log(`⚠️  [${i + 1}] Skipping ${name.substring(0, 40)}... - Geocoding failed`);
        skipped++;
        continue;
      }

      // Get district name
      const district = (row['District'] || 'West Bengal').toString().trim();

      console.log(`✅ [${imported + 1}] ${name.substring(0, 40)}...`);
      console.log(`   📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      console.log(`   🏛️  District: ${district}`);

      // ✅ CREATE COLD STORAGE (UPDATED - removed pincode and pricePerKg, changed ownerName to registeredUnder)
      const storage = await prisma.coldStorage.create({
        data: {
          name: name.toString().trim(),
          nameBn: row['WH Name Bengali'] ? row['WH Name Bengali'].toString().trim() : null,
          nameHi: row['WH Name Hindi'] ? row['WH Name Hindi'].toString().trim() : null,
          registeredUnder: 'West Bengal Govt Registered',  // ✅ Changed from ownerName
          ownerContact: (row['Contact No.'] || 'Not Available').toString().trim().replace(/[\s-]/g, ''),
          latitude: latitude,
          longitude: longitude,
          address: (row['Address'] || '').toString().trim(),
          district: district,
          state: 'West Bengal',
          capacity: parseInt(row['Capacity(in MT)']) || 0,
          isActive: true
        }
      });

      imported++;

      // LINK ALL CROPS
      const commodities = row['Commodities'] || '';
      if (commodities) {
        const cropNames = commodities
          .toString()
          .split(',')
          .map(c => c.trim().toLowerCase())
          .filter(c => c.length > 0);

        let linkedForThis = 0;

        for (const cropName of cropNames) {
          const cropId = cropMapping[cropName];
          
          if (cropId) {
            try {
              await prisma.coldStorageCrop.create({
                data: {
                  coldStorageId: storage.id,
                  cropId: cropId
                }
              });
              linkedForThis++;
              totalCropsLinked++;
            } catch (error) {
              // Duplicate, skip
            }
          } else {
            if (imported <= 5) {
              console.log(`   ⚠️  Unknown crop: "${cropName}"`);
            }
          }
        }

        console.log(`   🌾 Linked ${linkedForThis} crops\n`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('🎉 IMPORT COMPLETE WITH ACCURATE COORDINATES!');
    console.log(`   ✅ Successfully imported: ${imported} cold storages`);
    console.log(`   ⚠️  Skipped (no coords): ${skipped}`);
    console.log(`   ✅ Total crop links: ${totalCropsLinked}`);
    console.log('='.repeat(70));

    // ===================================
    // DISTRICT BREAKDOWN
    // ===================================
    console.log('\n📊 District-wise Distribution:\n');

    const districtStats = {};
    rawData.forEach(row => {
      if (row['District']) {
        const dist = row['District'].toString().trim();
        districtStats[dist] = (districtStats[dist] || 0) + 1;
      }
    });

    Object.entries(districtStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([district, count]) => {
        console.log(`   ${district}: ${count} warehouses`);
      });

    console.log('\n✅ All warehouses across ALL DISTRICTS imported!');
    console.log('🎯 Farmers from ANY district can find nearby cold storages!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  importWithCoordinates();
}

module.exports = importWithCoordinates;