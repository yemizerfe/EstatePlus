/* Local verification helper: mint an access token for an existing account. */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

(async () => {
  const email = process.argv[2] || 'yy@gmail.com';
  const user = await p.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user ${email}`);
  // Login normalises the Prisma enum (ANALYST) to the app role (analyst).
  const role = String(user.role).toLowerCase();
  const token = jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
  console.log(token);
  await p.$disconnect();
})();
