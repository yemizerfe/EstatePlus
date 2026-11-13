import argon2 from 'argon2';
import { prisma } from '../src/infrastructure/database/prisma';
import { logger } from '../src/shared/utils/logger';

async function createAdmin(): Promise<void> {
  try {
    logger.info('Creating admin user...');

    const email = 'yyy@gmail.com';
    const password = 'pass@Ferideme1';

    // Hash the password
    const passwordHash = await argon2.hash(password);

    // Create or update the admin user
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        // Prisma enum values are upper-case; the API maps them to lower-case
        // roles on the way out.
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
      },
    });

    logger.info({ 
      msg: 'Admin user created successfully', 
      id: admin.id,
      email: admin.email,
      role: admin.role
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password: pass@Ferideme1');
    console.log('Role: ADMIN');
    console.log('\nYou can now login at /login\n');

  } catch (error) {
    logger.error({ msg: 'Failed to create admin user', error });
    console.error('\n❌ Failed to create admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
