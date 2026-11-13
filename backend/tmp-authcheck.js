require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check(label, email, paths) {
  const user = await p.user.findUnique({ where: { email }, select: { id: true, role: true, email: true } });
  if (!user) { console.log(label, 'MISSING USER', email); return; }
  const tok = jwt.sign({ userId: user.id, email: user.email, role: user.role.toLowerCase() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  for (const path of paths) {
    const r = await fetch('http://localhost:5000/api/v1' + path, { headers: { Authorization: 'Bearer ' + tok } });
    let out = '';
    try {
      const j = await r.json();
      const d = j.data;
      out = Array.isArray(d) ? `array[${d.length}]` : d && typeof d === 'object' ? JSON.stringify(d).slice(0, 160) : String(d);
      if (j.success === false) out = 'FAIL ' + (j.error?.message || j.message);
    } catch { out = 'parse-fail'; }
    console.log(`${label} ${path} -> ${r.status} ${out}`);
  }
}

(async () => {
  await check('USER', 'yemisrachzerfe021@gmail.com', ['/users/saved-properties', '/notifications', '/notifications/unread-count']);
  await check('ANALYST', 'analyst@realestate.et', ['/analyst/dashboard', '/market/statistics', '/properties']);
  await check('ADMIN', 'admin@realestate.et', ['/users?limit=3', '/admin/dashboard', '/audit-logs?limit=3']);
  await p.$disconnect();
})();
