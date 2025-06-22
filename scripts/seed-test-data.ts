#!/usr/bin/env ts-node
/**
 * Seed test data for operator interface testing
 */

import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test data...');

  // Create pricing configuration
  const pricing = await prisma.pricingConfig.upsert({
    where: { id: 'default-pricing' },
    update: {},
    create: {
      id: 'default-pricing',
      minimumHours: 1,
      minimumRate: new Decimal(25.00),
      incrementMinutes: 15,
      incrementRate: new Decimal(5.00),
      dailySpecialHours: 8,
      dailySpecialRate: new Decimal(100.00),
      monthlyRate: new Decimal(800.00),
      lostTicketFee: new Decimal(50.00),
      isActive: true
    }
  });
  console.log('✅ Pricing configuration created');

  // Create cash register
  const cashRegister = await prisma.cashRegister.upsert({
    where: { id: 'main-register' },
    update: {},
    create: {
      id: 'main-register',
      openingBalance: new Decimal(500.00),
      currentBalance: new Decimal(500.00),
      lastUpdated: new Date()
    }
  });
  console.log('✅ Cash register initialized');

  // Create test tickets
  const activeTicket = await prisma.ticket.create({
    data: {
      plateNumber: 'ABC123',
      entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'ACTIVE',
      barcode: 'PARK123456',
      printedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  });
  console.log('✅ Test ticket PARK123456 created (2 hours parking)');

  const paidTicket = await prisma.ticket.create({
    data: {
      plateNumber: 'XYZ789',
      entryTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      exitTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      status: 'PAID',
      totalAmount: new Decimal(45.00),
      barcode: 'PARK789012',
      printedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      paymentMethod: 'EFECTIVO'
    }
  });
  console.log('✅ Test ticket PARK789012 created (already paid)');

  // Create test pension customer
  const pensionCustomer = await prisma.pensionCustomer.create({
    data: {
      name: 'Juan Pérez García',
      phone: '555-123-4567',
      plateNumber: 'MEX456',
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      monthlyRate: new Decimal(800.00),
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true
    }
  });
  console.log('✅ Test pension customer PENS001234 created');

  // Create test transaction
  const transaction = await prisma.transaction.create({
    data: {
      type: 'PARKING',
      amount: new Decimal(35.00),
      description: 'Pago de estacionamiento - 2 horas',
      operatorId: 'OPERATOR1',
      ticketId: activeTicket.id,
      timestamp: new Date()
    }
  });
  console.log('✅ Test transaction created');

  console.log('\n✅ Test data seeded successfully!');
  console.log('\n📋 Test Barcodes:');
  console.log('   Active ticket: PARK123456 (2 hours, owes $35)');
  console.log('   Paid ticket: PARK789012 (already paid)');
  console.log('   Pension customer: PENS001234 (Juan Pérez)');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });