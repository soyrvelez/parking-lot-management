#!/usr/bin/env ts-node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true
    }
  });
  
  console.log(`Found ${admins.length} admin users:`);
  admins.forEach(admin => {
    console.log(`- ${admin.email} (${admin.role}) - Active: ${admin.isActive}`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);