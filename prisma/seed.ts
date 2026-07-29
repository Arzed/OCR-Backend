import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'user@example.com';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`User ${email} already exists.`);
    return;
  }

  const passwordHash = await bcrypt.hash('Password123', 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: 'Budi Santoso',
      role: 'USER',
    },
  });

  console.log('✅ Seeded user successfully:', user);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
