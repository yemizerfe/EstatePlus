import argon2 from 'argon2';
import { prisma } from '../src/infrastructure/database/prisma';
import { logger } from '../src/shared/utils/logger';

async function testLogin(): Promise<void> {
  try {
    const email = 'yyy@gmail.com';
    const password = 'pass@Ferideme1';

    logger.info({ msg: 'Testing login for', email });

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error('\n❌ User not found in database!');
      console.log('Available users:');
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, role: true, isActive: true }
      });
      console.table(allUsers);
      return;
    }

    console.log('\n✅ User found:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Role:', user.role);
    console.log('Active:', user.isActive);
    console.log('Has password hash:', !!user.passwordHash);

    // Test password verification
    if (user.passwordHash) {
      const isValid = await argon2.verify(user.passwordHash, password);
      console.log('\nPassword verification:', isValid ? '✅ VALID' : '❌ INVALID');
      
      if (!isValid) {
        console.log('\nℹ️ Resetting password to:', password);
        const newHash = await argon2.hash(password);
        await prisma.user.update({
          where: { email },
          data: { passwordHash: newHash }
        });
        console.log('✅ Password reset complete!');
      }
    } else {
      console.log('\n❌ User has no password hash!');
    }

  } catch (error) {
    logger.error({ msg: 'Test login failed', error });
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
