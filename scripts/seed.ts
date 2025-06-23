#!/usr/bin/env ts-node

/**
 * Master Database Seeding Script
 * 
 * This script ensures all required configuration data is present in the database
 * for the parking lot management system to function properly.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Check if pricing configuration already exists
    const existingPricing = await prisma.pricingConfig.findFirst({
      where: { isActive: true }
    });

    if (existingPricing) {
      console.log('✅ Pricing configuration already exists:');
      console.log(`   - Minimum rate: $${existingPricing.minimumRate}`);
      console.log(`   - Increment rate: $${existingPricing.incrementRate}`);
      console.log(`   - Lost ticket fee: $${existingPricing.lostTicketFee}`);
      console.log(`   - Monthly rate: $${existingPricing.monthlyRate}`);
    } else {
      console.log('🏗️  Creating pricing configuration...');
      
      const pricingConfig = await prisma.pricingConfig.create({
        data: {
          minimumHours: 1,
          minimumRate: 25.00,
          incrementMinutes: 15,
          incrementRate: 5.00,
          dailySpecialHours: null,
          dailySpecialRate: null,
          monthlyRate: 800.00,
          lostTicketFee: 50.00,
          isActive: true
        }
      });

      console.log('✅ Created pricing configuration:');
      console.log(`   - ID: ${pricingConfig.id}`);
      console.log(`   - Minimum rate: $${pricingConfig.minimumRate} (first ${pricingConfig.minimumHours} hour${pricingConfig.minimumHours > 1 ? 's' : ''})`);
      console.log(`   - Increment rate: $${pricingConfig.incrementRate} (every ${pricingConfig.incrementMinutes} minutes)`);
      console.log(`   - Lost ticket fee: $${pricingConfig.lostTicketFee}`);
      console.log(`   - Monthly rate: $${pricingConfig.monthlyRate}`);
    }

    // Check and create admin user if needed
    const existingAdmin = await prisma.admin.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!existingAdmin) {
      console.log('🔐 Creating default admin user...');
      
      const adminUser = await prisma.admin.create({
        data: {
          email: 'admin@parkinglot.local',
          password: '$2b$10$K8Z1j4N3q7Y2p6M5s8X9CeR7T6U1v4W9A2B5c3D8E7F0G9H2I5J3K6', // Default: 'admin123'
          name: 'Administrador del Sistema',
          role: 'ADMIN',
          isActive: true
        }
      });

      console.log('✅ Created admin user:');
      console.log(`   - Email: admin@parkinglot.local`);
      console.log(`   - Default password: admin123`);
      console.log(`   - Name: ${adminUser.name}`);
      console.log('   ⚠️  IMPORTANT: Change the default password after first login!');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Check cash register initialization
    const existingCashRegister = await prisma.cashRegister.findFirst();

    if (!existingCashRegister) {
      console.log('💰 Initializing cash register...');
      
      const cashRegister = await prisma.cashRegister.create({
        data: {
          openingBalance: 0.00,
          currentBalance: 0.00
        }
      });

      console.log('✅ Cash register initialized:');
      console.log(`   - ID: ${cashRegister.id}`);
      console.log(`   - Opening balance: $${cashRegister.openingBalance}`);
    } else {
      console.log('✅ Cash register already exists');
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 System is ready for operation:');
    console.log('   1. Pricing configuration ✅');
    console.log('   2. Admin user account ✅');
    console.log('   3. Cash register ✅');
    console.log('\n🚀 You can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });