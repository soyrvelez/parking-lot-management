#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Setting up default pricing configuration...');

  // Check if configuration already exists
  const existingConfig = await prisma.pricingConfig.findFirst({
    where: { isActive: true }
  });

  if (existingConfig) {
    console.log('✅ Pricing configuration already exists');
    console.log(`   - Minimum rate: $${existingConfig.minimumRate}`);
    console.log(`   - Lost ticket fee: $${existingConfig.lostTicketFee}`);
    console.log(`   - Monthly rate: $${existingConfig.monthlyRate}`);
    return;
  }

  // Create default configuration
  const defaultConfig = await prisma.pricingConfig.create({
    data: {
      minimumHours: 1,
      minimumRate: 25.00,
      incrementMinutes: 15,
      incrementRate: 5.00,
      dailySpecialHours: null,
      dailySpecialRate: null,
      monthlyRate: 300.00,
      lostTicketFee: 50.00,
      isActive: true,
      createdBy: 'SYSTEM'
    }
  });

  console.log('✅ Created default pricing configuration:');
  console.log(`   - ID: ${defaultConfig.id}`);
  console.log(`   - Minimum: ${defaultConfig.minimumHours} hour(s) @ $${defaultConfig.minimumRate}`);
  console.log(`   - Increments: $${defaultConfig.incrementRate} per ${defaultConfig.incrementMinutes} minutes`);
  console.log(`   - Lost ticket fee: $${defaultConfig.lostTicketFee}`);
  console.log(`   - Monthly rate: $${defaultConfig.monthlyRate}`);
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});