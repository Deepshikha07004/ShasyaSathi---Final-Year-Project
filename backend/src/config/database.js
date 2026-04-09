const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
});

prisma.$connect()
  .then(() => {
    console.log('✅ Database connection ready');
  })
  .catch((error) => {
    console.error('❌ Database connection error:', error.message);
  });

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;