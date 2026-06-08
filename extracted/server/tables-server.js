/* ===== TAURUS MEDICAL — TABLES API (SQLite) =====
 * Реализует RESTful Table API, который ожидает фронтенд (js/*.js, admin.js).
 *
 * Эндпоинты:
 *   GET    /tables/:table?limit=&page=&sort=&search=   -> { data:[...], total, page, limit }
 *   GET    /tables/:table/:id                          -> { ...record }
 *   POST   /tables/:table        body=json             -> { ...record } (201)
 *   PUT    /tables/:table/:id     body=json (full)      -> { ...record }
 *   PATCH  /tables/:table/:id     body=json (partial)   -> { ...record }
 *   DELETE /tables/:table/:id                           -> 204
 *   GET    /health
 *
 * Хранилище: SQLite (better-sqlite3). Каждая таблица — строки в JSON-колонке `data`,
 * плюс служебные поля id / created_at / updated_at для сортировки и поиска.
 *
 * ENV:
 *   PORT=8788            порт API
 *   DB_PATH=./data.db    путь к файлу SQLite
 *   CORS_ORIGIN=*        разрешённый Origin (для разработки)
 */
'use strict';

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT || 8788);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Разрешённые таблицы (фиксированный список — безопасность)
const TABLES = [
  'doctors',
  'clinics',
  'treatments',
  'doctor_treatments',
  'page_content',
  'site_settings',
  'form_submissions',
  'seo_publish_logs'
];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Создаём таблицы: id TEXT PK, data JSON, created_at, updated_at
for (const t of TABLES) {
  db.prepare(`CREATE TABLE IF NOT EXISTS ${t} (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

function nowIso() { return new Date().toISOString(); }
function genId() { return crypto.randomBytes(12).toString('hex'); }

function rowToRecord(row) {
  if (!row) return null;
  let obj = {};
  try { obj = JSON.parse(row.data) || {}; } catch (_) { obj = {}; }
  // Системные поля поверх (id всегда из колонки)
  obj.id = row.id;
  if (!obj.created_at) obj.created_at = row.created_at;
  if (!obj.updated_at) obj.updated_at = row.updated_at;
  return obj;
}

function listRecords(table, query) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  let records = rows.map(rowToRecord);

  // search — простой полнотекстовый поиск по сериализованному JSON
  const search = (query.search || '').trim().toLowerCase();
  if (search) {
    records = records.filter(r => JSON.stringify(r).toLowerCase().includes(search));
  }

  // sort — "field" (asc) или "-field" (desc)
  const sortRaw = (query.sort || '').trim();
  if (sortRaw) {
    const desc = sortRaw.startsWith('-');
    const field = desc ? sortRaw.slice(1) : sortRaw;
    records.sort((a, b) => {
      const va = a[field], vb = b[field];
      if (va === vb) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp = va > vb ? 1 : -1;
      return desc ? -cmp : cmp;
    });
  } else {
    // По умолчанию — по order_num, затем по created_at
    records.sort((a, b) => {
      const oa = Number.isFinite(+a.order_num) ? +a.order_num : 9999;
      const ob = Number.isFinite(+b.order_num) ? +b.order_num : 9999;
      if (oa !== ob) return oa - ob;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
  }

  const total = records.length;
  const limit = Math.max(1, Math.min(5000, Number(query.limit) || 100));
  const page = Math.max(1, Number(query.page) || 1);
  const start = (page - 1) * limit;
  const pageData = records.slice(start, start + limit);

  return { data: pageData, total, page, limit };
}

function getRecord(table, id) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return rowToRecord(row);
}

function createRecord(table, body) {
  const id = (body.id != null && String(body.id).trim()) ? String(body.id).trim() : genId();
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id);
  if (exists) {
    const err = new Error('record with this id already exists');
    err.statusCode = 409;
    throw err;
  }
  const created = nowIso();
  const data = { ...body };
  delete data.id;
  data.created_at = body.created_at || created;
  data.updated_at = created;
  db.prepare(`INSERT INTO ${table} (id, data, created_at, updated_at) VALUES (?,?,?,?)`)
    .run(id, JSON.stringify(data), data.created_at, created);
  return getRecord(table, id);
}

function replaceRecord(table, id, body) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) { const e = new Error('not found'); e.statusCode = 404; throw e; }
  const updated = nowIso();
  const data = { ...body };
  delete data.id;
  data.created_at = body.created_at || row.created_at;
  data.updated_at = updated;
  db.prepare(`UPDATE ${table} SET data = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(data), updated, id);
  return getRecord(table, id);
}

function patchRecord(table, id, body) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!row) { const e = new Error('not found'); e.statusCode = 404; throw e; }
  const current = rowToRecord(row);
  const updated = nowIso();
  const merged = { ...current, ...body };
  delete merged.id;
  merged.created_at = current.created_at || row.created_at;
  merged.updated_at = updated;
  db.prepare(`UPDATE ${table} SET data = ?, updated_at = ? WHERE id = ?`)
    .run(JSON.stringify(merged), updated, id);
  return getRecord(table, id);
}

function deleteRecord(table, id) {
  const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return info.changes > 0;
}

// ===== HTTP =====
function sendJson(res, status, obj) {
  const body = obj === undefined ? '' : JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 5e6) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(Object.assign(new Error('invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return sendJson(res, 204);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/').filter(Boolean); // e.g. ['tables','doctors','id']

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, tables: TABLES });
    }

    if (parts[0] !== 'tables') return sendJson(res, 404, { error: 'not found' });

    const table = parts[1];
    const id = parts[2] ? decodeURIComponent(parts[2]) : null;

    if (!TABLES.includes(table)) {
      return sendJson(res, 404, { error: `unknown table: ${table}` });
    }

    // Collection endpoints
    if (!id) {
      if (req.method === 'GET') {
        const query = Object.fromEntries(url.searchParams.entries());
        return sendJson(res, 200, listRecords(table, query));
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const rec = createRecord(table, body);
        return sendJson(res, 201, { data: rec, ...rec });
      }
      return sendJson(res, 405, { error: 'method not allowed' });
    }

    // Item endpoints
    if (req.method === 'GET') {
      const rec = getRecord(table, id);
      if (!rec) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 200, rec);
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const rec = replaceRecord(table, id, body);
      return sendJson(res, 200, { data: rec, ...rec });
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const rec = patchRecord(table, id, body);
      return sendJson(res, 200, { data: rec, ...rec });
    }
    if (req.method === 'DELETE') {
      const ok = deleteRecord(table, id);
      if (!ok) return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 204);
    }

    return sendJson(res, 405, { error: 'method not allowed' });
  } catch (e) {
    const status = e.statusCode || 500;
    return sendJson(res, status, { error: e.message || 'internal error' });
  }
});

// Слушаем только при прямом запуске (node tables-server.js).
// При require (seed.js / start.js) — экспортируем db и функцию запуска.
function startServer(port = PORT) {
  server.listen(port, () => {
    console.log(`[tables-api] SQLite=${DB_PATH} listening on :${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { db, TABLES, server, startServer };
