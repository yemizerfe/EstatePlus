/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const listings = await p.listing.findMany({
    select: { listedAt: true, listingType: true, currentPrice: true, rentalPrice: true, status: true },
  });
  const byMonth = {};
  for (const l of listings) {
    const m = new Date(l.listedAt).toISOString().slice(0, 7);
    byMonth[m] = byMonth[m] || { sale: 0, rent: 0 };
    if (l.listingType === 'SALE') byMonth[m].sale++;
    else byMonth[m].rent++;
  }
  console.log('listings', listings.length);
  console.log('byMonth', byMonth);

  const q = (sql) => p.$queryRawUnsafe(sql).then((r) => JSON.parse(JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? Number(v) : v)))).catch((e) => e.message);
  console.log('data_sources', await q('select name, count(*) c from data_sources group by 1'));
  console.log('jobs', await q('select status, count(*) c from data_import_jobs group by 1'));
  console.log('indicators', await q('select indicator_type, count(*) c from economic_indicators group by 1'));
  console.log('fx', await q('select count(*) c from exchange_rates'));
  console.log('marketstats', await q('select count(*) c from market_statistics'));
  console.log('forecasts', await q('select count(*) c from forecasts'));
  console.log('external listing tables', await q("select table_name from information_schema.tables where table_schema='public' and table_name ilike '%extern%' or table_name ilike '%bina%'"));
  await p.$disconnect();
})();
