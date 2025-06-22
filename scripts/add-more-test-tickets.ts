#!/usr/bin/env ts-node
/**
 * Add more test tickets for testing the active tickets display
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎫 Adding more test tickets...');

  // Create tickets with different entry times to simulate real parking activity
  const now = new Date();
  
  const testTickets = [
    {
      plateNumber: 'DEF456',
      entryTime: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
      barcode: 'PARK345678'
    },
    {
      plateNumber: 'GHI789',
      entryTime: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      barcode: 'PARK456789'
    },
    {
      plateNumber: 'JKL012',
      entryTime: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5 hours ago
      barcode: 'PARK567890'
    },
    {
      plateNumber: 'MNO345',
      entryTime: new Date(now.getTime() - 45 * 60 * 1000), // 45 minutes ago
      barcode: 'PARK678901'
    }
  ];

  for (const ticketData of testTickets) {
    try {
      const ticket = await prisma.ticket.create({
        data: {
          plateNumber: ticketData.plateNumber,
          entryTime: ticketData.entryTime,
          status: 'ACTIVE',
          barcode: ticketData.barcode,
          printedAt: ticketData.entryTime
        }
      });
      
      const durationMs = now.getTime() - ticketData.entryTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      
      console.log(`✅ Created ticket ${ticketData.plateNumber} (${ticketData.barcode}) - ${duration} parked`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`⚠️  Ticket ${ticketData.plateNumber} already exists, skipping...`);
      } else {
        console.error(`❌ Error creating ticket ${ticketData.plateNumber}:`, error);
      }
    }
  }

  // Display all active tickets
  const activeTickets = await prisma.ticket.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { entryTime: 'desc' }
  });

  console.log('\n📋 All Active Tickets:');
  activeTickets.forEach(ticket => {
    const durationMs = now.getTime() - ticket.entryTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    console.log(`   ${ticket.plateNumber} (${ticket.barcode}) - ${duration} parked`);
  });

  console.log(`\n✅ Total active tickets: ${activeTickets.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });