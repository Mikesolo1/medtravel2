/* ===== TAURUS MEDICAL — SEED =====
 * Наполняет SQLite начальными данными:
 *   - page_content: для всех страниц (slug -> meta_title/meta_description/h1/hero_text),
 *     извлечено из существующих HTML
 *   - clinics: 7 клиник (slug = имя файла)
 *   - treatments: 10 направлений (slug = имя файла)
 *   - site_settings: базовые настройки + admin_password
 *   - doctors + doctor_treatments: из ../js/doctors-seed.js (33 врача)
 *
 * Запуск:  node server/seed.js          (мягко: пропускает уже существующие записи)
 *          node server/seed.js --reset   (очищает таблицы и засевает заново)
 *
 * ENV: DB_PATH (как в tables-server.js), ADMIN_PASSWORD (по умолч. 'admin123')
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db, TABLES } = require('./tables-server.js');

const ROOT = path.join(__dirname, '..');
const RESET = process.argv.includes('--reset');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function nowIso() { return new Date().toISOString(); }
function genId() { return crypto.randomBytes(12).toString('hex'); }

function upsert(table, id, obj) {
  const existing = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(id);
  const now = nowIso();
  const data = { ...obj }; delete data.id;
  if (existing) {
    data.updated_at = now;
    db.prepare(`UPDATE ${table} SET data=?, updated_at=? WHERE id=?`)
      .run(JSON.stringify(data), now, id);
    return 'updated';
  }
  data.created_at = obj.created_at || now;
  data.updated_at = now;
  db.prepare(`INSERT INTO ${table} (id,data,created_at,updated_at) VALUES (?,?,?,?)`)
    .run(id, JSON.stringify(data), data.created_at, now);
  return 'inserted';
}

if (RESET) {
  for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
  console.log('[seed] все таблицы очищены (--reset)');
}

// ---------- page_content: извлекаем из HTML ----------
// slug -> относительный путь файла
const PAGE_FILES = {
  'index': 'index.html',
  'o-nas': 'o-nas.html',
  'kliniki-izrailya': 'kliniki-izrailya.html',
  'otdeleniya': 'otdeleniya.html',
  'onkologiya': 'onkologiya.html',
  'vrachi': 'vrachi.html',
  'patsientam': 'patsientam.html',
  'patsientam-prieezd': 'patsientam/prieezd-v-izrail.html',
  'patsientam-obsledovaniya': 'patsientam/programma-obsledovaniya.html',
  'patsientam-uslugi': 'patsientam/soputstvuyushchie-uslugi.html',
  'otzyvy': 'otzyvy.html',
  'kontakty': 'kontakty.html',
  'kliniki-ikhilov': 'kliniki/ikhilov-sourasky.html',
  'kliniki-assuta': 'kliniki/assuta.html',
  'kliniki-sheba': 'kliniki/sheba-tel-hashomer.html',
  'kliniki-rabin': 'kliniki/rabin-beilinson.html',
  'kliniki-wolfson': 'kliniki/wolfson.html',
  'kliniki-herzliya': 'kliniki/herzliya-medical-center.html',
  'kliniki-medica': 'kliniki/medica-raphael.html',
  'napravleniya-allergologiya': 'napravleniya/allergologiya.html',
  'napravleniya-gastroenterologiya': 'napravleniya/gastroenterologiya.html',
  'napravleniya-gematologiya': 'napravleniya/gematologiya.html',
  'napravleniya-genetika': 'napravleniya/genetika.html',
  'napravleniya-ginekologiya': 'napravleniya/ginekologiya.html',
  'napravleniya-geriatriya': 'napravleniya/geriatriya.html',
  'napravleniya-kardiologiya': 'napravleniya/kardiologiya.html',
  'napravleniya-nevrologiya': 'napravleniya/nevrologiya.html',
  'napravleniya-ortopediya': 'napravleniya/ortopediya.html',
  'napravleniya-urologiya': 'napravleniya/urologiya.html',
  'napravleniya-dermatologiya': 'napravleniya/dermatologiya.html',
  'napravleniya-lor': 'napravleniya/lor.html',
  'napravleniya-proktologiya': 'napravleniya/proktologiya.html',
  'napravleniya-stomatologiya': 'napravleniya/stomatologiya.html',
  'napravleniya-terapiya': 'napravleniya/terapiya.html',
  'napravleniya-endokrinologiya': 'napravleniya/endokrinologiya.html'
};

function extract(re, html) { const m = html.match(re); return m ? m[1].trim() : ''; }

let pc = 0;
for (const [slug, rel] of Object.entries(PAGE_FILES)) {
  const file = path.join(ROOT, rel);
  let html = '';
  try { html = fs.readFileSync(file, 'utf8'); } catch (_) { continue; }
  const title = extract(/<title>([^<]*)<\/title>/i, html);
  const desc = extract(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i, html);
  const h1 = extract(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html).replace(/<[^>]+>/g, '').trim();
  upsert('page_content', slug, {
    page_slug: slug,
    meta_title: title,
    meta_description: desc,
    h1: h1,
    hero_text: '',
    content_blocks: '[]'
  });
  pc++;
}
console.log(`[seed] page_content: ${pc} страниц`);

// ---------- clinics ----------
const CLINICS = [
  ['ikhilov-sourasky', 'Ихилов (Сураски)', 'Tel Aviv Sourasky Medical Center', 'Тель-Авив', 'Государственная'],
  ['assuta', 'Ассута', 'Assuta Medical Centers', 'Тель-Авив', 'Частная'],
  ['sheba-tel-hashomer', 'Шиба (Тель ха-Шомер)', 'Sheba Medical Center', 'Рамат-Ган', 'Государственная'],
  ['rabin-beilinson', 'Рабин (Бейлинсон)', 'Rabin Medical Center', 'Петах-Тиква', 'Государственная'],
  ['wolfson', 'Вольфсон', 'Wolfson Medical Center', 'Холон', 'Государственная'],
  ['herzliya-medical-center', 'Герцлия Медикал Центр', 'Herzliya Medical Center', 'Герцлия', 'Частная'],
  ['medica-raphael', 'Медика (Рафаэль)', 'Medica Raphael', 'Тель-Авив', 'Частная']
];
let cc = 0;
CLINICS.forEach((c, i) => {
  upsert('clinics', c[0], {
    slug: c[0], name_ru: c[1], name_en: c[2], city: c[3], type: c[4],
    icon: 'fa-hospital', short_desc: '', description: '',
    specialties: '', beds: '', departments: '', image_url: '',
    order_num: i + 1, is_active: true
  });
  cc++;
});
console.log(`[seed] clinics: ${cc}`);

// ---------- treatments (направления) ----------
const TREATMENTS = [
  ['allergologiya', 'Аллергология и иммунология', 'fa-lungs'],
  ['gastroenterologiya', 'Гастроэнтерология', 'fa-stomach'],
  ['gematologiya', 'Гематология', 'fa-droplet'],
  ['genetika', 'Генетика', 'fa-dna'],
  ['geriatriya', 'Гериатрия', 'fa-person-cane'],
  ['ginekologiya', 'Гинекология', 'fa-venus'],
  ['kardiologiya', 'Кардиология', 'fa-heart-pulse'],
  ['nevrologiya', 'Неврология', 'fa-brain'],
  ['ortopediya', 'Ортопедия', 'fa-bone'],
  ['urologiya', 'Урология', 'fa-kidneys'],
  ['dermatologiya', 'Дерматология', 'fa-hand-dots'],
  ['lor', 'Отоларингология (ЛОР)', 'fa-ear-listen'],
  ['proktologiya', 'Проктология', 'fa-stethoscope'],
  ['stomatologiya', 'Стоматология', 'fa-tooth'],
  ['terapiya', 'Терапия', 'fa-user-doctor'],
  ['endokrinologiya', 'Эндокринология', 'fa-vials'],
  ['onkologiya', 'Онкология', 'fa-ribbon']
];
let tc = 0;
TREATMENTS.forEach((t, i) => {
  upsert('treatments', t[0], {
    slug: t[0], name_ru: t[1], name_en: '', icon: t[2],
    short_desc: '', description: '', order_num: i + 1, is_active: true
  });
  tc++;
});
console.log(`[seed] treatments: ${tc}`);

// ---------- site_settings ----------
function scryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
const SETTINGS = [
  ['site_base_url', 'https://kliniki-izrailya.solomatin-marketing.ru'],
  ['admin_password_hash', scryptHash(ADMIN_PASSWORD)],
  ['telegram_bot_token', ''],
  ['telegram_chat_id', ''],
  ['contact_phone', ''],
  ['contact_email', ''],
  ['contact_whatsapp', '']
];
let sc = 0;
SETTINGS.forEach(([key, value]) => {
  // settings ищутся по key — id = key для стабильности
  upsert('site_settings', key, { key, value });
  sc++;
});
console.log(`[seed] site_settings: ${sc} (admin_password = "${ADMIN_PASSWORD}")`);

// ---------- doctors + doctor_treatments ----------
const seedPath = path.join(ROOT, 'js', 'doctors-seed.js');
let doctors = [];
try {
  const txt = fs.readFileSync(seedPath, 'utf8');
  doctors = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
} catch (e) {
  console.warn('[seed] не удалось прочитать doctors-seed.js:', e.message);
}
let dc = 0, dt = 0;
for (const d of doctors) {
  const id = d.id;
  upsert('doctors', id, d);
  dc++;
  const slugs = String(d.treatment_slugs || '').split(',').map(s => s.trim()).filter(Boolean);
  for (const slug of slugs) {
    const pivotId = `${id}__${slug}`;
    upsert('doctor_treatments', pivotId, { doctor_id: id, treatment_slug: slug });
    dt++;
  }
}
console.log(`[seed] doctors: ${dc}, doctor_treatments: ${dt}`);

console.log('[seed] готово.');
