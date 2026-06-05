import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@variete.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });

  // Global config
  await prisma.globalConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      lowStockThreshold: 10,
      adminWhatsappNumber: process.env.ADMIN_WHATSAPP_NUMBER || '',
      emailFrom: process.env.EMAIL_FROM || '',
    },
  });

  // Global cashback config
  await prisma.globalCashbackConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      stackRules: false,
      maxPercentage: 20,
      balanceExpiryDays: null,
    },
  });

  // Default cashback rule — 5% global
  const existingRule = await prisma.cashbackRule.findFirst({
    where: { type: 'GLOBAL', isActive: true },
  });

  if (!existingRule) {
    await prisma.cashbackRule.create({
      data: {
        type: 'GLOBAL',
        percentage: 5,
        isActive: true,
      },
    });
  }

  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
