#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('💰 Adding test transactions...');

  // Get some existing active tickets to reference
  const activeTickets = await prisma.ticket.findMany({
    where: { status: 'ACTIVE' },
    take: 3
  });

  const now = new Date();

  const testTransactions = [
    {
      type: 'PARKING' as const,
      amount: new Decimal(25.00),
      description: 'Pago de estacionamiento - 1 hora',
      ticketId: activeTickets[0]?.id,
      timestamp: new Date(now.getTime() - 15 * 60 * 1000) // 15 minutes ago
    },
    {
      type: 'PARKING' as const,
      amount: new Decimal(35.00),
      description: 'Pago de estacionamiento - 2 horas',
      ticketId: activeTickets[1]?.id,
      timestamp: new Date(now.getTime() - 45 * 60 * 1000) // 45 minutes ago
    },
    {
      type: 'LOST_TICKET' as const,
      amount: new Decimal(50.00),
      description: 'Cobro por boleto perdido',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
    },
    {
      type: 'PARKING' as const,
      amount: new Decimal(55.00),
      description: 'Pago de estacionamiento - 5 horas',
      ticketId: activeTickets[2]?.id,
      timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000) // 3 hours ago
    },
    {
      type: 'REFUND' as const,
      amount: new Decimal(15.00),
      description: 'Reembolso por error en cobro',
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000) // 4 hours ago
    }
  ];

  for (const transactionData of testTransactions) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          type: transactionData.type,
          amount: transactionData.amount,
          description: transactionData.description,
          operatorId: 'OPERATOR1',
          ticketId: transactionData.ticketId,
          timestamp: transactionData.timestamp,
          paymentMethod: 'CASH'
        }
      });
      
      console.log(`✅ Created ${transactionData.type} transaction: $${transactionData.amount} - ${transactionData.description}`);
    } catch (error: any) {
      console.error(`❌ Error creating transaction:`, error.message);
    }
  }

  // Display all recent transactions
  const allTransactions = await prisma.transaction.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
    include: {
      ticket: {
        select: { plateNumber: true }
      }
    }
  });

  console.log('\n📋 Recent Transactions:');
  allTransactions.forEach(t => {
    const plateInfo = t.ticket?.plateNumber ? ` (${t.ticket.plateNumber})` : '';
    const time = t.timestamp.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    console.log(`   ${time} - ${t.type}: $${t.amount}${plateInfo}`);
  });

  console.log(`\n✅ Total transactions: ${allTransactions.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });