import * as publicService from './src/modules/public/public.service';

(async () => {
  for (const [name, fn] of Object.entries({
    listings: () => publicService.listPublicListings({ limit: 5 }),
    binaStats: () => publicService.getBinaStats(),
    binaListings: () => publicService.listBinaListings(),
  })) {
    try {
      const result: any = await fn();
      console.log('OK', name, JSON.stringify(result).slice(0, 300));
    } catch (error: any) {
      console.log('FAIL', name, error?.message);
      console.log((error?.stack ?? '').split('\n').slice(0, 8).join('\n'));
    }
  }
  process.exit(0);
})();
