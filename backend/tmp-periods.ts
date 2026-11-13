import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const med=(v:number[])=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?(s[m]!):(s[m-1]!+s[m]!)/2;};
async function main(){
 const rows=await p.listing.findMany({where:{status:'ACTIVE'},select:{listedAt:true,currentPrice:true,rentalPrice:true,listingType:true}});
 const now=new Date();
 for(const months of [3,6,12,24]){
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-months+1,1));
  const inWin=rows.filter(r=>r.listedAt>=start);
  const sp=inWin.filter(r=>r.listingType!=='RENT').map(r=>Number(r.currentPrice)).filter(n=>n>0);
  const rp=inWin.filter(r=>r.rentalPrice!=null).map(r=>Number(r.rentalPrice)).filter(n=>n>0);
  const mid=new Date(start.getTime()+(now.getTime()-start.getTime())/2);
  const a=inWin.filter(r=>r.listedAt<mid), b=inWin.filter(r=>r.listedAt>=mid);
  const med1=(arr:typeof inWin)=>med(arr.filter(r=>r.listingType!=='RENT').map(r=>Number(r.currentPrice)).filter(n=>n>0));
  console.log(months,'months listings',inWin.length,'saleN',sp.length,'median',med(sp),'rentN',rp.length,'rentMed',med(rp),'half1',med1(a),'half2',med1(b));
 }
}
main().finally(()=>p.$disconnect());
