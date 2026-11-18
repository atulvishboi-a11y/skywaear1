const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_UNPOOLED
    }
  }
});

async function main() {
  try {
    const users = await prisma.user.findMany({ take: 5 });
    console.log('Prisma Client connected successfully! Users:', users.length);
  } catch (e) {
    console.error('Prisma Client Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

