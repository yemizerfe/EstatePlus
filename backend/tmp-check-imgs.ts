import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main(){
 const rows = await p.property.findMany({ select:{ id:true, propertyType:true, bedrooms:true, images:{select:{imageUrl:true,isPrimary:true},orderBy:{sortOrder:'asc'}} } });
 const noimg = rows.filter(r=>!r.images.length).length;
 const noprimary = rows.filter(r=>r.images.length && r.images.filter(i=>i.isPrimary).length!==1).length;
 const screenshot = rows.filter(r=>r.images.some(i=>/screenshot|chatgpt/i.test(i.imageUrl))).length;
 console.log('props',rows.length,'noimg',noimg,'missing-primary',noprimary,'screenshots',screenshot);
 console.log('sample', rows.slice(0,3).map(r=>`${r.propertyType}/${r.bedrooms}: ${r.images.map(i=>i.imageUrl.split('/').pop()).join(', ')}`).join('\n'));
}
main().finally(()=>p.$disconnect());
