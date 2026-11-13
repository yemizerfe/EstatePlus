import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main(){
 const rows = await p.property.findMany({ where:{ OR:[{description:{contains:'BinaSmart'}},{description:{contains:'bina.et'}}]}, select:{id:true,title:true,propertyType:true,askingPrice:true,rentalPrice:true,sizeSqm:true,address:true,description:true,listings:{select:{listingType:true,currentPrice:true,rentalPrice:true,status:true}}}});
 console.log('count',rows.length);
 for(const r of rows){console.log(JSON.stringify({t:r.title?.slice(0,60),ask:r.askingPrice,rent:r.rentalPrice,size:r.sizeSqm,addr:r.address,listings:r.listings.map(l=>[l.listingType,l.currentPrice,l.rentalPrice,l.status]),desc:r.description?.slice(0,160)}));}
}
main().finally(()=>p.$disconnect());
