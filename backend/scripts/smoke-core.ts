/**
 * End-to-end smoke test for the Phase 1 core workflow:
 * auth -> neighborhood -> property -> approval -> listing -> public listing read.
 *
 * Requires a running API (default http://localhost:5000) and seeded reference data
 * (`npm run db:seed`). Run with: npx tsx scripts/smoke-core.ts
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:5000/api/v1';

const OWNER = { email: 'smoke.owner@estateplus.local', password: 'Owner@123456' };
const ADMIN = { email: 'admin@realestate.et', password: 'Admin@123456' };

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`, detail ?? '');
  }
}

async function call(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function login(email: string, password: string): Promise<string> {
  const { status, json } = await call('/auth/login', { method: 'POST', body: { email, password } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status} ${JSON.stringify(json)}`);
  return json.data.accessToken as string;
}

function pickList(payload: any): any[] {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  for (const key of ['neighborhoods', 'items', 'results', 'properties', 'listings']) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

async function main(): Promise<void> {
  // 1. Register (ignore "already exists")
  const reg = await call('/auth/register', {
    method: 'POST',
    body: { ...OWNER, firstName: 'Smoke', lastName: 'Owner', accountType: 'property_owner' },
  });
  check('register owner (201 or 409)', reg.status === 201 || reg.status === 409, reg.json);

  const ownerToken = await login(OWNER.email, OWNER.password);
  check('owner login returns token', typeof ownerToken === 'string' && ownerToken.length > 20);

  // 2. Reference data
  const hoods = await call('/neighborhoods', { token: ownerToken });
  const neighborhoods = pickList(hoods.json);
  check('neighborhoods list non-empty', hoods.status === 200 && neighborhoods.length > 0, hoods.json);
  const neighborhood = neighborhoods[0];
  if (!neighborhood) throw new Error('no neighborhoods available — run npm run db:seed');

  // 3. Create property
  const propertyBody = {
    title: `Smoke test apartment ${Date.now()}`,
    description: 'Created by the Phase 1 smoke test.',
    propertyType: 'APARTMENT',
    condition: 'GOOD',
    neighborhoodId: neighborhood.id,
    address: 'Smoke test address, Addis Ababa',
    latitude: 9.0192,
    longitude: 38.7525,
    sizeSqm: 120,
    bedrooms: 3,
    bathrooms: 2,
    askingPrice: 8500000,
    rentalPrice: 45000,
    listingDate: new Date().toISOString().slice(0, 10),
  };
  const created = await call('/properties', { method: 'POST', token: ownerToken, body: propertyBody });
  check('create property → 201', created.status === 201, created.json);
  const property = created.json?.data;
  if (!property) throw new Error(`property creation failed: ${JSON.stringify(created.json)}`);
  check('property has generated id', typeof property.id === 'string');
  check('property records owner', Boolean(property.ownerId), { ownerId: property.ownerId });
  check('property starts in DRAFT', property.status === 'DRAFT', { status: property.status });

  // 4. Approval workflow: DRAFT → PENDING → APPROVED
  const toPending = await call(`/properties/${property.id}/status`, {
    method: 'PATCH',
    token: ownerToken,
    body: { fromStatus: 'DRAFT', toStatus: 'PENDING' },
  });
  check('owner submits property for review', toPending.status === 200, toPending.json);

  const adminToken = await login(ADMIN.email, ADMIN.password);
  const approve = await call(`/properties/${property.id}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { fromStatus: 'PENDING', toStatus: 'APPROVED', reason: 'smoke test approval' },
  });
  check('admin approves property', approve.status === 200 && approve.json?.data?.status === 'APPROVED', approve.json);

  // 5. Create listing
  const listing = await call('/listings', {
    method: 'POST',
    token: ownerToken,
    body: { propertyId: property.id, listingType: 'SALE', currentPrice: 8500000, rentalPrice: 45000 },
  });
  check('create listing for approved property → 201', listing.status === 201, listing.json);
  check('listing is ACTIVE with SALE type', listing.json?.data?.status === 'ACTIVE' && listing.json?.data?.listingType === 'SALE', listing.json?.data);

  // 6. Duplicate listing is rejected
  const duplicate = await call('/listings', {
    method: 'POST',
    token: ownerToken,
    body: { propertyId: property.id, listingType: 'SALE', currentPrice: 8700000 },
  });
  check('duplicate active listing rejected (400)', duplicate.status === 400, duplicate.json);

  // 7. Public read paths
  const list = await call('/listings?status=ACTIVE&limit=50', { token: ownerToken });
  const listings = pickList(list.json);
  check('listing appears in listings search', list.status === 200 && listings.some((l) => l.id === listing.json?.data?.id), { count: listings.length });

  const detail = await call(`/properties/${property.id}`, { token: ownerToken });
  check('property detail readable', detail.status === 200 && detail.json?.data?.id === property.id, detail.json);

  // 8. Validation guardrail: negative price rejected
  const invalid = await call('/properties', {
    method: 'POST',
    token: ownerToken,
    body: { ...propertyBody, title: 'Invalid negative price', askingPrice: -5 },
  });
  check('negative asking price rejected (422/400)', invalid.status === 400 || invalid.status === 422, invalid.json);

  console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} SMOKE CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error('SMOKE RUN ABORTED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
