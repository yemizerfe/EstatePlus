import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main(){
 const rows:any[] = await p.$queryRawUnsafe(`select indexname, indexdef from pg_indexes where tablename='property_images'`);
 for(const r of rows) console.log(r.indexname, '::', r.indexdef);
 const cons:any[] = await p.$queryRawUnsafe(`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='property_images'::regclass`);
 for(const c of cons) console.log('CONSTRAINT', c.conname, c.def);
}
main().finally(()=>p.$disconnect());
