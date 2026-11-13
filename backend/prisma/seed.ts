import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Hash passwords
  const adminPassword = await argon2.hash('@Ferideme22');
  const analystPassword = await argon2.hash('@Ferideme');

  // Create Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'yemizerfe22@gmail.com' },
    update: {
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: 'yemizerfe22@gmail.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      authProvider: 'LOCAL',
      isActive: true,
    },
  });

  console.log('✓ Admin user created:', { email: admin.email, role: admin.role });

  // Create Analyst user
  const analyst = await prisma.user.upsert({
    where: { email: 'yy@gmail.com' },
    update: {
      passwordHash: analystPassword,
      role: 'ANALYST',
      isActive: true,
    },
    create: {
      email: 'yy@gmail.com',
      passwordHash: analystPassword,
      firstName: 'Analyst',
      lastName: 'User',
      role: 'ANALYST',
      authProvider: 'LOCAL',
      isActive: true,
    },
  });

  console.log('✓ Analyst user created:', { email: analyst.email, role: analyst.role });

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
