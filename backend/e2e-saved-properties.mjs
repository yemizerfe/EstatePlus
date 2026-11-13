// End-to-end verification of the "save properties" flow for a logged-in user.
// Exercises: register -> login -> save (x2) -> list -> upsert dedupe -> delete -> list
// and then repeats the read through the Vite dev proxy (browser path).
const API = process.env.API_URL ?? 'http://127.0.0.1:3000/api/v1';
const PROXY = process.env.PROXY_URL ?? 'http://localhost:5173/api/v1';

const stamp = Date.now();
const email = `e2e.saved.${stamp}@example.com`;
const password = 'Password1a!'; // backend requires upper+lower+digit+special
let failures = 0;

function check(label, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

async function api(base, method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

// 1. Register a fresh user (409 tolerated if rerun in the same ms — unlikely)
const reg = await api(API, 'POST', '/auth/register', {
  body: { email, password, firstName: 'E2E', lastName: 'Saved' },
});
check('register user', reg.status === 201 || reg.status === 409, `status=${reg.status}`);

// 2. Login -> access token
const login = await api(API, 'POST', '/auth/login', { body: { email, password } });
const token = login.json?.data?.accessToken;
check('login returns accessToken', login.status === 200 && Boolean(token), `status=${login.status}`);

// 3. Unauthenticated access must be rejected
const anon = await api(API, 'GET', '/users/saved-properties');
check('saved-properties requires auth', anon.status === 401, `status=${anon.status}`);

// 4. Save two properties
const propA = {
  propertyId: 'e2e-prop-a', title: 'E2E Apartment Bole',
  neighborhood: 'Bole', image: 'https://example.com/a.jpg',
  price: 4_500_000, size: 120, beds: 3, baths: 2,
};
const propB = {
  propertyId: 'e2e-prop-b', title: 'E2E Villa Old Airport',
  neighborhood: 'Old Airport', image: 'https://example.com/b.jpg',
  price: 12_750_000, size: 350, beds: 5, baths: 4,
};
const saveA = await api(API, 'POST', '/users/saved-properties', { token, body: propA });
const saveB = await api(API, 'POST', '/users/saved-properties', { token, body: propB });
check('save property A', saveA.status === 201, `status=${saveA.status}`);
check('save property B', saveB.status === 201, `status=${saveB.status}`);

// 5. Save A again -> upsert, must NOT duplicate
const saveA2 = await api(API, 'POST', '/users/saved-properties', { token, body: propA });
check('re-save A does not duplicate', saveA2.status === 201);

// 6. List -> exactly 2 rows, correct payload
const list1 = await api(API, 'GET', '/users/saved-properties', { token });
const rows = list1.json?.data ?? [];
check('list returns 2 saved rows', list1.status === 200 && rows.length === 2, `got ${rows.length}`);
const rowA = rows.find((r) => r.propertyId === 'e2e-prop-a');
check(
  'row payload snapshot correct',
  Boolean(rowA) && rowA.title === propA.title && Number(rowA.price) === propA.price &&
    rowA.beds === 3 && Number(rowA.size) === 120,
);

// 7. Isolation: another user must not see them
const reg2 = await api(API, 'POST', '/auth/register', {
  body: { email: `e2e.saved2.${stamp}@example.com`, password, firstName: 'E2E', lastName: 'Other' },
});
const login2 = await api(API, 'POST', '/auth/login', {
  body: { email: `e2e.saved2.${stamp}@example.com`, password },
});
const list2 = await api(API, 'GET', '/users/saved-properties', {
  token: login2.json?.data?.accessToken,
});
check('other user sees empty list', list2.status === 200 && (list2.json?.data ?? []).length === 0);

// 8. Delete A -> list shrinks to 1
const del = await api(API, 'DELETE', `/users/saved-properties/${propA.propertyId}`, { token });
check('delete property A', del.status === 200);
const list3 = await api(API, 'GET', '/users/saved-properties', { token });
check('list shrinks to 1 after delete', list3.status === 200 && (list3.json?.data ?? []).length === 1);

// 9. Same flow through the Vite proxy (what the browser actually uses)
const proxyList = await api(PROXY, 'GET', '/users/saved-properties', { token });
check(
  'read via Vite proxy works',
  proxyList.status === 200 && (proxyList.json?.data ?? []).length === 1,
  `status=${proxyList.status}`,
);

// 10. Cleanup: remove B so no saved rows linger for the test users
await api(API, 'DELETE', `/users/saved-properties/${propB.propertyId}`, { token });
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
