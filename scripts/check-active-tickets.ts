#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const activeTickets = await prisma.ticket.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      plateNumber: true,
      barcode: true,
      entryTime: true,
      status: true
    },
    take: 5
  });
  
  console.log(`Found ${activeTickets.length} active tickets:`);
  activeTickets.forEach(ticket => {
    console.log(`- ID: ${ticket.id} | Placa: ${ticket.plateNumber} | Entrada: ${ticket.entryTime.toLocaleString()}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);