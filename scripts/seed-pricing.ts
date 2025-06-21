/**
 * Seed script to initialize pricing configuration
 * Run with: npx ts-node scripts/seed-pricing.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPricing() {
  try {
    console.log('🌱 Seeding pricing configuration...');

    // Check if pricing already exists
    const existingPricing = await prisma.pricingConfig.findFirst();
    
    if (existingPricing) {
      console.log('✅ Pricing configuration already exists');
      return;
    }

    // Create default pricing configuration for Mexican parking lot
    const pricing = await prisma.pricingConfig.create({
      data: {
        minimumHours: 1,           // 1 hour minimum
        minimumRate: 25.00,        // $25 MXN for first hour
        incrementMinutes: 15,      // 15-minute increments after first hour
        incrementRate: 5.00,       // $5 MXN per 15-minute increment
        dailySpecialHours: 12,     // 12-hour daily special
        dailySpecialRate: 150.00,  // $150 MXN for full day
        monthlyRate: 2000.00,      // $2000 MXN monthly pension
        lostTicketFee: 100.00,     // $100 MXN lost ticket fee
        isActive: true
      }
    });

    console.log('✅ Created pricing configuration:', {
      id: pricing.id,
      minimumRate: `$${pricing.minimumRate} MXN`,
      incrementRate: `$${pricing.incrementRate} MXN per ${pricing.incrementMinutes} min`,
      dailySpecial: `$${pricing.dailySpecialRate} MXN for ${pricing.dailySpecialHours} hours`,
      monthlyRate: `$${pricing.monthlyRate} MXN`,
      lostTicketFee: `$${pricing.lostTicketFee} MXN`
    });

    console.log('🎉 Pricing configuration seeded successfully!');

  } catch (error) {
    console.error('❌ Error seeding pricing configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedPricing()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });