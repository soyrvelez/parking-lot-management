#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
    include: {
      ticket: {
        select: {
          plateNumber: true,
          barcode: true
        }
      }
    }
  });
  
  console.log(`Found ${transactions.length} transactions:`);
  transactions.forEach(t => {
    const plateInfo = t.ticket ? ` (${t.ticket.plateNumber})` : '';
    console.log(`- ${t.type}: $${t.amount} - ${t.description}${plateInfo} - ${t.timestamp.toLocaleString()}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);