const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function startServer(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

async function bootPublishServer(t, adminPassword = 'secret123') {
  const tablesServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/tables/site_settings') {
      sendJson(res, 200, {
        data: [
          { id: '1', key: 'admin_password', value: adminPassword },
          { id: '2', key: 'site_base_url', value: 'https://taurus-medical.com' }
        ]
      });
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  });

  const tablesBase = await startServer(tablesServer);
  t.after(() => tablesServer.close());

  process.env.TABLES_API_BASE = `${tablesBase}/tables`;
  process.env.ADMIN_AUTH_SECRET = 'test-admin-auth-secret';
  process.env.ADMIN_AUTH_TTL_SEC = '3600';

  const modulePath = path.resolve(__dirname, 'publish-server.js');
  delete require.cache[modulePath];
  const { createPublishServer } = require(modulePath);

  const publishServer = createPublishServer();
  const publishBase = await startServer(publishServer);
  t.after(() => publishServer.close());

  return { publishBase };
}

test('admin auth login + verify + protected static statuses endpoint', async (t) => {
  const { publishBase } = await bootPublishServer(t);

  const unauthorizedRes = await fetch(`${publishBase}/admin/seo/static-statuses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doctor_ids: ['stefanski'] })
  });
  assert.equal(unauthorizedRes.status, 401);

  const badLoginRes = await fetch(`${publishBase}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  assert.equal(badLoginRes.status, 401);

  const loginRes = await fetch(`${publishBase}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'secret123' })
  });
  assert.equal(loginRes.status, 200);
  const loginPayload = await loginRes.json();
  assert.equal(loginPayload.ok, true);
  assert.ok(loginPayload.token);

  const verifyRes = await fetch(`${publishBase}/admin/auth/verify`, {
    headers: { Authorization: `Bearer ${loginPayload.token}` }
  });
  assert.equal(verifyRes.status, 200);
  const verifyPayload = await verifyRes.json();
  assert.equal(verifyPayload.authenticated, true);

  const staticStatusesRes = await fetch(`${publishBase}/admin/seo/static-statuses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginPayload.token}`
    },
    body: JSON.stringify({ doctor_ids: ['stefanski', 'missing-doctor'] })
  });

  assert.equal(staticStatusesRes.status, 200);
  const staticStatusesPayload = await staticStatusesRes.json();
  assert.equal(staticStatusesPayload.ok, true);
  assert.equal(staticStatusesPayload.checked_count, 2);
  assert.equal(staticStatusesPayload.statuses['missing-doctor'], false);
  assert.equal(typeof staticStatusesPayload.statuses['stefanski'], 'boolean');
});
