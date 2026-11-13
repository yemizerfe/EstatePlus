import { PrismaClient } from '@prisma/client';
import { etbEligiblePropertyWhere } from './src/shared/utils/eligibility';
const p=new PrismaClient();
const med=(v:number[])=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]!:(s[m-1]!+s[m]!)/2;};
async function main(){
 const rows=await p.listing.findMany({where:{status:'ACTIVE',property:{status:'APPROVED',...etbEligiblePropertyWhere()}},select:{listedAt:true,currentPrice:true,rentalPrice:true,listingType:true}});
 const now=new Date();
 for(const w of [3,6,12,24]){
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-w+1,1));
  const prevStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-2*w+1,1));
  const cur=rows.filter(r=>r.listedAt>=start), prev=rows.filter(r=>r.listedAt>=prevStart&&r.listedAt<start);
  const sale=(a:typeof rows)=>a.filter(r=>r.listingType!=='RENT').map(r=>Number(r.currentPrice)).filter(n=>n>0);
  const rent=(a:typeof rows)=>a.filter(r=>r.rentalPrice!=null).map(r=>Number(r.rentalPrice)).filter(n=>n>0);
  console.log(w,'cur',cur.length,'saleN',sale(cur).length,'med',med(sale(cur)),'prev',prev.length,'saleN',sale(prev).length,'med',med(sale(prev)),'rent cur/prev',rent(cur).length,rent(prev).length);
 }
}
main().finally(()=>p.$disconnect());
