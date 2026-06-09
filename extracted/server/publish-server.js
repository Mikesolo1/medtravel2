#!/usr/bin/env node

/**
 * Lightweight publish server for Taurus Medical static SEO pages.
 *
 * Endpoints:
 * - GET  /health
 * - POST /admin/publish/doctor/:id[?dry_run=1]
 * - POST /admin/publish/doctors/bulk
 * - POST /admin/publish/sitemap
 *
 * Optional env:
 * - PORT=8787
 * - TABLES_API_BASE=http://localhost:3000/tables
 * - ADMIN_PUBLISH_TOKEN=secret (Bearer token required for POST endpoints)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const TABLES_API_BASE = (process.env.TABLES_API_BASE || 'http://localhost:8788/tables').replace(/\/$/, '');
const ADMIN_PUBLISH_TOKEN = process.env.ADMIN_PUBLISH_TOKEN || '';
const DEFAULT_SITE_BASE_URL = (process.env.SITE_BASE_URL || 'https://taurus-medical.com').replace(/\/$/, '');
const ADMIN_AUTH_SECRET = process.env.ADMIN_AUTH_SECRET || 'taurus-admin-auth-secret';
const ADMIN_AUTH_TTL_SEC = Number(process.env.ADMIN_AUTH_TTL_SEC || 8 * 60 * 60);
const INTERNAL_ACCESS_TOKEN = process.env.INTERNAL_ACCESS_TOKEN || 'taurus-internal';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCTORS_DIR = path.join(PROJECT_ROOT, 'vrachi');
const SITEMAP_PATH = path.join(PROJECT_ROOT, 'sitemap.xml');

const SPECIALTY_MAP = {
  'Онкология': { url: '../onkologiya.html', icon: 'fa-ribbon' },
  'Кардиология': { url: '../napravleniya/kardiologiya.html', icon: 'fa-heart-pulse' },
  'Кардиохирургия': { url: '../napravleniya/kardiologiya.html', icon: 'fa-heart-pulse' },
  'Нейрохирургия': { url: '../napravleniya/nevrologiya.html', icon: 'fa-brain' },
  'Детская нейрохирургия': { url: '../napravleniya/nevrologiya.html', icon: 'fa-brain' },
  'Ортопедия': { url: '../napravleniya/ortopediya.html', icon: 'fa-bone' },
  'Урология': { url: '../napravleniya/urologiya.html', icon: 'fa-mars' },
  'Гастроэнтерология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Гепатология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Гинекология': { url: '../napravleniya/ginekologiya.html', icon: 'fa-venus' },
  'Гинекология-онкология': { url: '../napravleniya/ginekologiya.html', icon: 'fa-venus' },
  'Онко-гинекология': { url: '../napravleniya/ginekologiya.html', icon: 'fa-venus' },
  'Репродуктология': { url: '../napravleniya/ginekologiya.html', icon: 'fa-venus' },
  'Аллергология': { url: '../napravleniya/allergologiya.html', icon: 'fa-lungs' },
  'Иммунология': { url: '../napravleniya/allergologiya.html', icon: 'fa-shield-virus' },
  'Гематология': { url: '../napravleniya/gematologiya.html', icon: 'fa-droplet' },
  'Онкогематология': { url: '../napravleniya/gematologiya.html', icon: 'fa-droplet' },
  'Генетика': { url: '../napravleniya/genetika.html', icon: 'fa-dna' },
  'Онкогенетика': { url: '../napravleniya/genetika.html', icon: 'fa-dna' },
  'Гериатрия': { url: '../napravleniya/geriatriya.html', icon: 'fa-person-cane' },
  'Дерматология': { url: '../napravleniya/dermatologiya.html', icon: 'fa-hand-dots' },
  'ЛОР': { url: '../napravleniya/lor.html', icon: 'fa-ear-listen' },
  'Отоларингология': { url: '../napravleniya/lor.html', icon: 'fa-ear-listen' },
  'Проктология': { url: '../napravleniya/proktologiya.html', icon: 'fa-stethoscope' },
  'Стоматология': { url: '../napravleniya/stomatologiya.html', icon: 'fa-tooth' },
  'Терапия': { url: '../napravleniya/terapiya.html', icon: 'fa-stethoscope' },
  'Эндокринология': { url: '../napravleniya/endokrinologiya.html', icon: 'fa-droplet' },
  'Хирургическая гастроэнтерология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская гастроэнтерология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская гематология': { url: '../napravleniya/gematologiya.html', icon: 'fa-droplet' },
  'Внутренние болезни': { url: '../napravleniya/terapiya.html', icon: 'fa-stethoscope' },
  'Эндоскопия': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская аллергология': { url: '../napravleniya/allergologiya.html', icon: 'fa-lungs' },
  'Психогериатрия': { url: '../napravleniya/geriatriya.html', icon: 'fa-person-cane' }
};

// Надёжный маппинг направление-slug -> страница (как в frontend-загрузчиках).
// Приоритетный источник связи врач↔направление (treatment_slugs из БД/pivot).
const TREATMENT_SLUG_MAP = {
  'allergologiya':      { url: '../napravleniya/allergologiya.html',      icon: 'fa-lungs',       name: 'Аллергология и иммунология' },
  'gastroenterologiya': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach',     name: 'Гастроэнтерология' },
  'gematologiya':       { url: '../napravleniya/gematologiya.html',       icon: 'fa-droplet',     name: 'Гематология' },
  'genetika':           { url: '../napravleniya/genetika.html',           icon: 'fa-dna',         name: 'Генетика' },
  'geriatriya':         { url: '../napravleniya/geriatriya.html',         icon: 'fa-person-cane', name: 'Гериатрия' },
  'ginekologiya':       { url: '../napravleniya/ginekologiya.html',       icon: 'fa-venus',       name: 'Гинекология' },
  'kardiologiya':       { url: '../napravleniya/kardiologiya.html',       icon: 'fa-heart-pulse', name: 'Кардиология' },
  'nevrologiya':        { url: '../napravleniya/nevrologiya.html',        icon: 'fa-brain',       name: 'Неврология' },
  'ortopediya':         { url: '../napravleniya/ortopediya.html',         icon: 'fa-bone',        name: 'Ортопедия' },
  'urologiya':          { url: '../napravleniya/urologiya.html',          icon: 'fa-mars',        name: 'Урология' },
  'onkologiya':         { url: '../onkologiya.html',                      icon: 'fa-ribbon',      name: 'Онкология' },
  'dermatologiya':      { url: '../napravleniya/dermatologiya.html',      icon: 'fa-hand-dots',   name: 'Дерматология' },
  'lor':                { url: '../napravleniya/lor.html',                icon: 'fa-ear-listen',  name: 'ЛОР' },
  'proktologiya':       { url: '../napravleniya/proktologiya.html',       icon: 'fa-stethoscope', name: 'Проктология' },
  'stomatologiya':      { url: '../napravleniya/stomatologiya.html',      icon: 'fa-tooth',       name: 'Стоматология' },
  'terapiya':           { url: '../napravleniya/terapiya.html',           icon: 'fa-stethoscope', name: 'Терапия' },
  'endokrinologiya':    { url: '../napravleniya/endokrinologiya.html',    icon: 'fa-droplet',     name: 'Эндокринология' }
};

function normalizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidSlug(value) {
  return /^[a-z0-9\-]+$/.test(value || '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseCsv(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function safePhotoUrl(url) {
  const val = String(url || '').trim();
  return /^https?:\/\//i.test(val) ? val : '';
}

function sanitizeDoctor(raw) {
  const id = normalizeSlug(raw?.id);
  return {
    id,
    name_ru: String(raw?.name_ru || '').trim(),
    specialty: String(raw?.specialty || '').trim(),
    position: String(raw?.position || '').trim(),
    clinic_name: String(raw?.clinic_name || '').trim(),
    description: String(raw?.description || '').trim(),
    photo_url: safePhotoUrl(raw?.photo_url),
    tags: parseCsv(raw?.tags),
    languages: parseCsv(raw?.languages),
    online_consultation: !!raw?.online_consultation,
    treatment_slugs: parseCsv(raw?.treatment_slugs).map(s => s.toLowerCase()),
    seo_title: String(raw?.seo_title || '').trim(),
    seo_description: String(raw?.seo_description || '').trim(),
    seo_og_title: String(raw?.seo_og_title || '').trim(),
    seo_og_description: String(raw?.seo_og_description || '').trim(),
    seo_og_image: safePhotoUrl(raw?.seo_og_image || raw?.photo_url),
    seo_canonical_url: String(raw?.seo_canonical_url || '').trim(),
    seo_robots: String(raw?.seo_robots || '').trim()
  };
}

function buildDoctorDirectionsHtml(specialty, treatmentSlugs = []) {
  const used = new Set();
  const items = [];

  // 1) ПРИОРИТЕТ: связь через treatment_slugs (надёжный источник из БД/pivot).
  (treatmentSlugs || []).forEach(slug => {
    const key = String(slug || '').trim().toLowerCase();
    const mapped = TREATMENT_SLUG_MAP[key];
    if (mapped && !used.has(mapped.url)) {
      used.add(mapped.url);
      items.push(`<a href="${mapped.url}" class="doctor-directions__item"><i class="fas ${mapped.icon}"></i> ${escapeHtml(mapped.name)}</a>`);
    }
  });

  // 2) Fallback/дополнение по названию специальности (старая логика).
  parseCsv(specialty).forEach(spec => {
    const mapped = SPECIALTY_MAP[spec];
    if (mapped) {
      if (used.has(mapped.url)) return;
      used.add(mapped.url);
      items.push(`<a href="${mapped.url}" class="doctor-directions__item"><i class="fas ${mapped.icon}"></i> ${escapeHtml(spec)}</a>`);
    } else {
      const key = `txt:${spec}`;
      if (used.has(key)) return;
      used.add(key);
      items.push(`<span class="doctor-directions__item"><i class="fas fa-stethoscope"></i> ${escapeHtml(spec)}</span>`);
    }
  });

  return items.join('') || '<span class="doctor-directions__item"><i class="fas fa-stethoscope"></i> Общая консультация</span>';
}

function buildDoctorDescriptionHtml(description) {
  if (!description) return '<p>Информация о враче будет обновлена в ближайшее время.</p>';
  const paragraphs = String(description).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p>Информация о враче будет обновлена в ближайшее время.</p>';
  return paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

function buildDoctorSeoKeywords(doctor) {
  return [doctor.name_ru, doctor.specialty, doctor.clinic_name, ...doctor.tags].filter(Boolean).join(', ');
}

function buildDoctorSeoMetaDescription(doctor) {
  const shortDesc = doctor.description || `${doctor.name_ru} — ${doctor.specialty}.`;
  return `${doctor.name_ru} — ${doctor.specialty}. ${doctor.position}. ${doctor.clinic_name}. ${shortDesc}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function buildDoctorStaticPageHtml(rawDoctor) {
  const doctor = sanitizeDoctor(rawDoctor);
  if (!doctor.id) throw new Error('Doctor id is empty');
  if (!isValidSlug(doctor.id)) throw new Error('Doctor id must match [a-z0-9-]');
  if (!doctor.name_ru) throw new Error('Doctor name_ru is required');

  const title = doctor.seo_title || `${doctor.name_ru} — ${doctor.specialty || 'Врач'} | Taurus Medical Experts`;
  const metaDescription = doctor.seo_description || buildDoctorSeoMetaDescription(doctor);
  const keywords = buildDoctorSeoKeywords(doctor);
  const robotsContent = doctor.seo_robots || 'index, follow';
  const canonicalUrl = doctor.seo_canonical_url || `vrachi/${encodeURIComponent(doctor.id)}.html`;
  const ogTitle = doctor.seo_og_title || title;
  const ogDescription = doctor.seo_og_description || metaDescription;
  const ogImage = doctor.seo_og_image || doctor.photo_url;
  const descriptionHtml = buildDoctorDescriptionHtml(doctor.description);
  const directionHtml = buildDoctorDirectionsHtml(doctor.specialty, doctor.treatment_slugs);

  const tagsHtml = doctor.tags.length
    ? doctor.tags.map(tag => `<span class="doctor-profile__tag">${escapeHtml(tag)}</span>`).join('')
    : '<span class="doctor-profile__tag">Персональная консультация</span>';

  const badges = [];
  if (doctor.online_consultation) {
    badges.push('<span class="doctor-profile__badge doctor-profile__badge--online"><i class="fas fa-video"></i> Онлайн-консультация</span>');
  }
  doctor.languages.forEach(lang => badges.push(`<span class="doctor-profile__badge doctor-profile__badge--lang"><i class="fas fa-globe"></i> ${escapeHtml(lang)}</span>`));

  const photoBlock = doctor.photo_url
    ? `<img src="${escapeHtml(doctor.photo_url)}" alt="${escapeHtml(doctor.name_ru)}">`
    : '<i class="fas fa-user-doctor"></i>';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <meta name="keywords" content="${escapeHtml(keywords)}">
    <meta name="robots" content="${escapeHtml(robotsContent)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${escapeHtml(ogTitle)}">
    <meta property="og:description" content="${escapeHtml(ogDescription)}">
    ${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ''}
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/modal.css">
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Physician',
      name: doctor.name_ru,
      description: doctor.description || `${doctor.name_ru} — ${doctor.specialty}`,
      medicalSpecialty: parseCsv(doctor.specialty),
      hospitalAffiliation: doctor.clinic_name ? { '@type': 'Hospital', name: doctor.clinic_name } : undefined,
      knowsLanguage: doctor.languages,
      image: doctor.photo_url || undefined,
      availableService: doctor.online_consultation ? [{ '@type': 'MedicalTherapy', name: 'Онлайн-консультация' }] : undefined
    })}</script>
</head>
<body>
    <section class="page-hero"><div class="container"><div class="page-hero__inner">
        <div class="page-hero__breadcrumb"><a href="../index.html">Главная</a><span>/</span><a href="../vrachi.html">Врачи</a><span>/</span><span>${escapeHtml(doctor.name_ru)}</span></div>
        <h1 class="page-hero__title">${escapeHtml(doctor.name_ru)}</h1>
    </div></div></section>

    <section class="doctor-profile"><div class="container"><div class="doctor-profile__inner">
        <div class="doctor-profile__photo">${photoBlock}</div>
        <div class="doctor-profile__content">
            <h2 class="doctor-profile__name">${escapeHtml(doctor.name_ru)}</h2>
            <div class="doctor-profile__spec">${escapeHtml(doctor.specialty || 'Врач-специалист')}</div>
            <div class="doctor-profile__position">${escapeHtml(doctor.position || '')}</div>
            <div class="doctor-profile__clinic"><i class="fas fa-hospital"></i> <span>${escapeHtml(doctor.clinic_name || 'Клиника уточняется')}</span></div>
            <div class="doctor-profile__badges">${badges.join('')}</div>
            <div class="doctor-profile__desc">${descriptionHtml}</div>
            <div class="doctor-profile__tags">${tagsHtml}</div>
            <div class="doctor-profile__actions">
                <a href="../kontakty.html" class="btn btn--primary"><i class="fas fa-calendar-check"></i> Записаться на консультацию</a>
                <a href="../kontakty.html" class="btn btn--secondary"><i class="fas fa-video"></i> Второе мнение онлайн</a>
            </div>
        </div>
    </div></div></section>

    <section class="doctor-directions"><div class="container">
        <h3 class="doctor-directions__title">Направления специалиста</h3>
        <div class="doctor-directions__list">${directionHtml}</div>
    </div></section>
</body>
</html>`;
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 3 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
  });
  res.end(body);
}

function getBearerToken(req) {
  const auth = String(req?.headers?.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signAuthPayload(payload) {
  return base64UrlEncode(
    crypto.createHmac('sha256', ADMIN_AUTH_SECRET).update(payload).digest()
  );
}

function createAdminSessionToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  const body = {
    sub: 'admin',
    iat: nowSec,
    exp: nowSec + ADMIN_AUTH_TTL_SEC
  };
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const signature = signAuthPayload(encodedBody);
  return `${encodedBody}.${signature}`;
}

function verifyAdminSessionToken(token) {
  try {
    const raw = String(token || '');
    const [encodedBody, signature] = raw.split('.');
    if (!encodedBody || !signature) return false;

    const expected = signAuthPayload(encodedBody);
    if (signature !== expected) return false;

    const body = JSON.parse(base64UrlDecode(encodedBody));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!body || body.sub !== 'admin' || !body.exp || nowSec >= body.exp) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function createPasswordHash(password, saltHex = '') {
  const rawPassword = String(password || '');
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const hash = crypto.scryptSync(rawPassword, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPasswordHash(password, storedHash) {
  const rawStored = String(storedHash || '').trim();
  if (!rawStored.startsWith('scrypt$')) return false;
  const parts = rawStored.split('$');
  if (parts.length !== 3) return false;

  const [, saltHex, expectedHex] = parts;
  if (!saltHex || !expectedHex) return false;

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = crypto.scryptSync(String(password || ''), salt, expected.length);
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

async function resolveAdminPasswordHash() {
  try {
    const settings = await fetchTableRows('site_settings', 500);
    const hashRecord = settings.find(item => String(item?.key || '').trim() === 'admin_password_hash');
    const existingHash = String(hashRecord?.value || '').trim();
    if (existingHash.startsWith('scrypt$')) {
      return existingHash;
    }

    const plainRecord = settings.find(item => String(item?.key || '').trim() === 'admin_password');
    const plainPassword = String(plainRecord?.value || '').trim();
    if (!plainPassword) return '';

    const migratedHash = createPasswordHash(plainPassword);
    try {
      if (hashRecord?.id) {
        await patchTableRecord('site_settings', hashRecord.id, { value: migratedHash });
      } else {
        await createTableRecord('site_settings', {
          key: 'admin_password_hash',
          value: migratedHash,
          description: 'Hashed admin password (scrypt)'
        });
      }
      if (plainRecord?.id) {
        await patchTableRecord('site_settings', plainRecord.id, { value: '' });
      }
    } catch (_) {
      // best-effort migration; do not block login
    }

    return migratedHash;
  } catch (e) {
    return '';
  }
}

function assertAuthorized(req) {
  const token = getBearerToken(req);
  if (ADMIN_PUBLISH_TOKEN && token === ADMIN_PUBLISH_TOKEN) return true;
  return verifyAdminSessionToken(token);
}

async function fetchDoctorById(id) {
  const url = `${TABLES_API_BASE}/doctors/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Doctor fetch failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchTableRows(table, limit = 1000) {
  const url = `${TABLES_API_BASE}/${encodeURIComponent(table)}?limit=${limit}`;
  const response = await fetch(url, { headers: { 'x-internal-access': INTERNAL_ACCESS_TOKEN } });
  if (!response.ok) {
    throw new Error(`${table} fetch failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function fetchTableRecord(table, id) {
  const url = `${TABLES_API_BASE}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${table}/${id} fetch failed: HTTP ${response.status}`);
  }
  return response.json();
}

async function deleteTableRecord(table, id) {
  const url = `${TABLES_API_BASE}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
  const response = await fetch(url, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`${table}/${id} delete failed: HTTP ${response.status}`);
  }
}

async function patchTableRecord(table, id, payload) {
  const url = `${TABLES_API_BASE}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!response.ok) {
    throw new Error(`${table}/${id} patch failed: HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

async function createTableRecord(table, payload) {
  const url = `${TABLES_API_BASE}/${encodeURIComponent(table)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!response.ok) {
    throw new Error(`${table} create failed: HTTP ${response.status}`);
  }
  try {
    return await response.json();
  } catch (_) {
    return {};
  }
}

async function fetchSiteBaseUrl() {
  try {
    const settings = await fetchTableRows('site_settings', 500);
    const record = settings.find(item => String(item?.key || '').trim() === 'site_base_url');
    const raw = String(record?.value || '').trim().replace(/\/$/, '');
    if (/^https?:\/\//i.test(raw)) return raw;
  } catch (e) {
    // ignore and use fallback
  }
  return DEFAULT_SITE_BASE_URL;
}

function normalizeSlugList(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeSlug).filter(Boolean);
  }
  return parseCsv(value).map(normalizeSlug).filter(Boolean);
}

async function ensureDoctorRelationsExist({ clinic_slug = '', treatment_slugs = [] }) {
  const clinicSlug = normalizeSlug(clinic_slug);
  const treatmentSlugs = normalizeSlugList(treatment_slugs);

  if (!clinicSlug && treatmentSlugs.length === 0) {
    return { ok: true, clinic_slug: '', treatment_slugs: [] };
  }

  const [clinics, treatments] = await Promise.all([
    fetchTableRows('clinics', 1000),
    fetchTableRows('treatments', 1000)
  ]);

  if (clinicSlug) {
    const clinicExists = clinics.some(c => normalizeSlug(c?.slug) === clinicSlug);
    if (!clinicExists) {
      throw new Error(`clinic_slug not found: ${clinicSlug}`);
    }
  }

  const treatmentSet = new Set(treatments.map(t => normalizeSlug(t?.slug || t?.id)).filter(Boolean));
  const unknownTreatments = treatmentSlugs.filter(slug => !treatmentSet.has(slug));
  if (unknownTreatments.length) {
    throw new Error(`treatment_slugs not found: ${unknownTreatments.join(', ')}`);
  }

  return {
    ok: true,
    clinic_slug: clinicSlug,
    treatment_slugs: treatmentSlugs
  };
}

function getLinkedDoctorsByClinic(doctors, clinicSlug) {
  return doctors.filter(d => normalizeSlug(d?.clinic_slug) === clinicSlug);
}

function getLinkedDoctorsByTreatment(doctors, treatmentSlug, pivotLinks = []) {
  if (Array.isArray(pivotLinks) && pivotLinks.length > 0) {
    const doctorIds = new Set(
      pivotLinks
        .filter(link => normalizeSlug(link?.treatment_slug) === treatmentSlug)
        .map(link => normalizeSlug(link?.doctor_id))
        .filter(Boolean)
    );
    return doctors.filter(d => doctorIds.has(normalizeSlug(d?.id)));
  }

  return doctors.filter(d => normalizeSlugList(d?.treatment_slugs).includes(treatmentSlug));
}

function checkStaticDoctorFileExists(doctorId) {
  const slug = normalizeSlug(doctorId);
  if (!slug || !isValidSlug(slug)) return false;
  const filePath = path.join(DOCTORS_DIR, `${slug}.html`);
  return fs.existsSync(filePath);
}

function buildStaticStatusMap(doctorIds = []) {
  const statuses = {};
  const normalized = Array.isArray(doctorIds) ? doctorIds.map(normalizeSlug).filter(Boolean) : [];
  normalized.forEach(id => {
    statuses[id] = checkStaticDoctorFileExists(id);
  });
  return statuses;
}

async function fetchDoctorTreatmentPivotRowsSafe() {
  try {
    return await fetchTableRows('doctor_treatments', 5000);
  } catch (e) {
    return [];
  }
}

async function updateDoctorSeoStateSafe(doctorId, seoStatus, publishError = '') {
  const normalizedDoctorId = normalizeSlug(doctorId);
  if (!normalizedDoctorId) return;

  try {
    await patchTableRecord('doctors', normalizedDoctorId, {
      seo_status: String(seoStatus || '').trim(),
      seo_last_error: String(publishError || '').trim(),
      seo_last_checked_at: new Date().toISOString()
    });
  } catch (e) {
    // Do not block publish flow if metadata update fails
  }
}

async function appendSeoPublishLogSafe({ doctor_id = '', status = '', message = '', source = 'publish-server' }) {
  try {
    await createTableRecord('seo_publish_logs', {
      doctor_id: normalizeSlug(doctor_id),
      status: String(status || '').trim(),
      message: String(message || '').slice(0, 2000),
      source: String(source || 'publish-server').trim(),
      created_at: new Date().toISOString()
    });
  } catch (e) {
    // Logging must be non-blocking
  }
}

async function upsertDoctorIntoSitemap(slug, siteBaseUrl) {
  if (!fs.existsSync(SITEMAP_PATH)) return { updated: false, reason: 'sitemap.xml not found' };

  const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const loc = `${siteBaseUrl}/vrachi/${slug}.html`;

  if (sitemap.includes(loc)) {
    return { updated: false, reason: 'already exists' };
  }

  const urlNode = `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;

  const closeTag = '</urlset>';
  const idx = sitemap.lastIndexOf(closeTag);
  if (idx === -1) throw new Error('Invalid sitemap.xml format: missing </urlset>');

  const updated = `${sitemap.slice(0, idx)}${urlNode}\n${closeTag}${sitemap.slice(idx + closeTag.length)}`;
  fs.writeFileSync(SITEMAP_PATH, updated, 'utf8');
  return { updated: true };
}

function publishDoctorFile(doctor, dryRun = false) {
  const slug = normalizeSlug(doctor.id);
  const html = buildDoctorStaticPageHtml(doctor);
  const fileName = `${slug}.html`;
  const outputPath = path.join(DOCTORS_DIR, fileName);

  if (!dryRun) {
    fs.writeFileSync(outputPath, html, 'utf8');
  }

  return {
    slug,
    file_name: fileName,
    output_path: outputPath,
    html_bytes: Buffer.byteLength(html)
  };
}

async function handlePublishOne(req, res, doctorId, dryRun) {
  try {
    const body = await readJsonBody(req);
    const doctor = body.doctor || await fetchDoctorById(doctorId);
    if (!doctor || !doctor.id) throw new Error('Doctor payload is empty');

    const result = publishDoctorFile(doctor, dryRun);
    const siteBaseUrl = await fetchSiteBaseUrl();
    const sitemap = dryRun ? { updated: false, reason: 'dry_run' } : await upsertDoctorIntoSitemap(result.slug, siteBaseUrl);

    if (!dryRun) {
      await updateDoctorSeoStateSafe(result.slug, 'published', '');
      await appendSeoPublishLogSafe({
        doctor_id: result.slug,
        status: 'published',
        message: `Published ${result.file_name}`
      });
    }

    sendJson(res, 200, {
      ok: true,
      dry_run: dryRun,
      doctor_id: result.slug,
      file_name: result.file_name,
      output_path: result.output_path,
      html_bytes: result.html_bytes,
      sitemap
    });
  } catch (e) {
    const message = e.message || 'Publish failed';
    const normalizedDoctorId = normalizeSlug(doctorId);
    if (normalizedDoctorId) {
      await updateDoctorSeoStateSafe(normalizedDoctorId, 'failed', message);
      await appendSeoPublishLogSafe({
        doctor_id: normalizedDoctorId,
        status: 'failed',
        message
      });
    }
    sendJson(res, 400, { ok: false, error: message });
  }
}

async function handlePublishBulk(req, res) {
  try {
    const body = await readJsonBody(req);
    const doctors = Array.isArray(body?.doctors) ? body.doctors : [];
    if (!doctors.length) throw new Error('doctors[] is required');

    const published = [];
    const failed = [];
    const siteBaseUrl = await fetchSiteBaseUrl();

    for (const doctor of doctors) {
      try {
        const out = publishDoctorFile(doctor, false);
        published.push({ id: out.slug, file_name: out.file_name });
        await upsertDoctorIntoSitemap(out.slug, siteBaseUrl);
        await updateDoctorSeoStateSafe(out.slug, 'published', '');
        await appendSeoPublishLogSafe({
          doctor_id: out.slug,
          status: 'published',
          message: `Published ${out.file_name} via bulk`
        });
      } catch (e) {
        const failedId = normalizeSlug(doctor?.id || '');
        const errorMessage = e.message || 'Unknown error';
        failed.push({ id: doctor?.id || '', error: errorMessage });
        if (failedId) {
          await updateDoctorSeoStateSafe(failedId, 'failed', errorMessage);
          await appendSeoPublishLogSafe({
            doctor_id: failedId,
            status: 'failed',
            message: errorMessage
          });
        }
      }
    }

    sendJson(res, 200, {
      ok: true,
      published_count: published.length,
      failed_count: failed.length,
      published,
      failed
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Bulk publish failed' });
  }
}

async function handleSitemapPublish(req, res) {
  try {
    const body = await readJsonBody(req);
    const slugs = Array.isArray(body?.doctor_slugs) ? body.doctor_slugs.map(normalizeSlug).filter(Boolean) : [];
    if (!slugs.length) throw new Error('doctor_slugs[] is required');

    const siteBaseUrl = await fetchSiteBaseUrl();
    const updates = [];
    for (const slug of slugs) {
      updates.push({ slug, ...(await upsertDoctorIntoSitemap(slug, siteBaseUrl)) });
    }
    sendJson(res, 200, { ok: true, updates });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Sitemap publish failed' });
  }
}

async function handleAdminAuthLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const password = String(body?.password || '').trim();
    if (!password) {
      sendJson(res, 400, { ok: false, error: 'password is required' });
      return;
    }

    const passwordHash = await resolveAdminPasswordHash();
    if (!passwordHash || !verifyPasswordHash(password, passwordHash)) {
      sendJson(res, 401, { ok: false, error: 'Invalid admin credentials' });
      return;
    }

    const token = createAdminSessionToken();
    sendJson(res, 200, {
      ok: true,
      token,
      token_type: 'Bearer',
      expires_in_sec: ADMIN_AUTH_TTL_SEC
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Admin auth failed' });
  }
}

function handleAdminAuthVerify(req, res) {
  const token = getBearerToken(req);
  const valid = verifyAdminSessionToken(token) || (ADMIN_PUBLISH_TOKEN && token === ADMIN_PUBLISH_TOKEN);
  if (!valid) {
    sendJson(res, 401, { ok: false, error: 'Invalid or expired token' });
    return;
  }
  sendJson(res, 200, { ok: true, authenticated: true });
}

function handleAdminAuthLogout(req, res) {
  sendJson(res, 200, { ok: true, logged_out: true });
}

async function handleValidateDoctorRelations(req, res) {
  try {
    const body = await readJsonBody(req);
    const validation = await ensureDoctorRelationsExist({
      clinic_slug: body?.clinic_slug,
      treatment_slugs: body?.treatment_slugs
    });
    sendJson(res, 200, {
      ok: true,
      clinic_slug: validation.clinic_slug,
      treatment_slugs: validation.treatment_slugs
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Relation validation failed' });
  }
}

async function handleStaticStatusBatch(req, res) {
  try {
    const body = await readJsonBody(req);
    const ids = Array.isArray(body?.doctor_ids) ? body.doctor_ids : [];
    const normalizedIds = ids.map(normalizeSlug).filter(Boolean);
    if (!normalizedIds.length) {
      sendJson(res, 200, { ok: true, statuses: {}, checked_count: 0 });
      return;
    }

    const statuses = buildStaticStatusMap(normalizedIds);
    sendJson(res, 200, {
      ok: true,
      statuses,
      checked_count: normalizedIds.length
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Static status batch failed' });
  }
}

async function handleClinicDelete(req, res, clinicId) {
  try {
    const [clinic, doctors] = await Promise.all([
      fetchTableRecord('clinics', clinicId),
      fetchTableRows('doctors', 2000)
    ]);

    const clinicSlug = normalizeSlug(clinic?.slug || clinic?.id || clinicId);
    if (!clinicSlug) throw new Error('Clinic slug is empty');

    const linkedDoctors = getLinkedDoctorsByClinic(doctors, clinicSlug);
    if (linkedDoctors.length > 0) {
      sendJson(res, 409, {
        ok: false,
        error: `Delete forbidden: clinic is linked to ${linkedDoctors.length} doctor(s)`,
        code: 'CLINIC_LINKED_DOCTORS',
        clinic_id: clinicId,
        clinic_slug: clinicSlug,
        linked_doctors: linkedDoctors.slice(0, 25).map(d => ({ id: d?.id || '', name_ru: d?.name_ru || '' }))
      });
      return;
    }

    await deleteTableRecord('clinics', clinicId);
    sendJson(res, 200, { ok: true, deleted: 'clinic', clinic_id: clinicId, clinic_slug: clinicSlug });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Clinic delete failed' });
  }
}

async function handleTreatmentDelete(req, res, treatmentId) {
  try {
    const [treatment, doctors, pivotLinks] = await Promise.all([
      fetchTableRecord('treatments', treatmentId),
      fetchTableRows('doctors', 2000),
      fetchDoctorTreatmentPivotRowsSafe()
    ]);

    const treatmentSlug = normalizeSlug(treatment?.slug || treatment?.id || treatmentId);
    if (!treatmentSlug) throw new Error('Treatment slug is empty');

    const linkedDoctors = getLinkedDoctorsByTreatment(doctors, treatmentSlug, pivotLinks);
    if (linkedDoctors.length > 0) {
      sendJson(res, 409, {
        ok: false,
        error: `Delete forbidden: treatment is linked to ${linkedDoctors.length} doctor(s)`,
        code: 'TREATMENT_LINKED_DOCTORS',
        treatment_id: treatmentId,
        treatment_slug: treatmentSlug,
        linked_doctors: linkedDoctors.slice(0, 25).map(d => ({ id: d?.id || '', name_ru: d?.name_ru || '' }))
      });
      return;
    }

    await deleteTableRecord('treatments', treatmentId);
    sendJson(res, 200, { ok: true, deleted: 'treatment', treatment_id: treatmentId, treatment_slug: treatmentSlug });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Treatment delete failed' });
  }
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function getTelegramSettings() {
  try {
    const settings = await fetchTableRows('site_settings', 500);
    const map = {};
    for (const item of settings) {
      const key = String(item?.key || '').trim();
      if (key) map[key] = String(item?.value == null ? '' : item.value).trim();
    }
    return {
      botToken: map['telegram_bot_token'] || '',
      chatId: map['telegram_chat_id'] || ''
    };
  } catch (e) {
    return { botToken: '', chatId: '' };
  }
}

const FORM_TYPE_LABELS = {
  consultation: 'Консультация',
  second_opinion: 'Второе мнение',
  callback: 'Обратный звонок',
  appointment: 'Запись на приём',
  diagnostics: 'Диагностика',
  treatment: 'Лечение'
};

async function sendTelegramNotification(submission) {
  const { botToken, chatId } = await getTelegramSettings();
  if (!botToken || !chatId) {
    return { sent: false, reason: 'telegram_not_configured' };
  }

  const typeLabel = FORM_TYPE_LABELS[submission.form_type] || submission.form_type || 'Заявка';
  const lines = [
    '🔔 <b>Новая заявка с сайта</b>',
    '',
    `<b>Тип:</b> ${escapeHtml(typeLabel)}`,
    `<b>Имя:</b> ${escapeHtml(submission.name || '—')}`,
    `<b>Телефон:</b> ${escapeHtml(submission.phone || '—')}`
  ];
  if (submission.email) lines.push(`<b>Email:</b> ${escapeHtml(submission.email)}`);
  if (submission.message) {
    lines.push('', '<b>Сообщение:</b>', escapeHtml(submission.message));
  }
  if (submission.page_url) lines.push('', `<b>Страница:</b> ${escapeHtml(submission.page_url)}`);
  const utmParts = [];
  if (submission.utm_source) utmParts.push(`source=${submission.utm_source}`);
  if (submission.utm_medium) utmParts.push(`medium=${submission.utm_medium}`);
  if (submission.utm_campaign) utmParts.push(`campaign=${submission.utm_campaign}`);
  if (utmParts.length) lines.push('', `<b>UTM:</b> ${escapeHtml(utmParts.join(' | '))}`);

  const text = lines.join('\n');

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    });
    const tgPayload = await tgRes.json().catch(() => ({}));
    if (!tgRes.ok || tgPayload?.ok === false) {
      return { sent: false, reason: tgPayload?.description || `HTTP ${tgRes.status}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e.message || 'telegram_request_failed' };
  }
}

// Authenticated settings read/write for the admin panel.
// Reads secrets via the internal-access header so the public /tables API can stay redacted.
async function handleAdminSettingsGet(req, res) {
  try {
    const settings = await fetchTableRows('site_settings', 500);
    const map = {};
    for (const item of settings) {
      const key = String(item?.key || '').trim();
      if (!key) continue;
      map[key] = { key, value: String(item?.value == null ? '' : item.value), id: item?.id || '' };
    }
    sendJson(res, 200, { ok: true, settings: map });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message || 'Settings read failed' });
  }
}

async function handleAdminSettingsSave(req, res) {
  try {
    const body = await readJsonBody(req);
    const updates = Array.isArray(body?.updates) ? body.updates : [];
    if (!updates.length) {
      sendJson(res, 400, { ok: false, error: 'No updates provided' });
      return;
    }

    const existing = await fetchTableRows('site_settings', 500);
    const byKey = {};
    for (const item of existing) {
      const key = String(item?.key || '').trim();
      if (key) byKey[key] = item;
    }

    for (const u of updates) {
      const key = String(u?.key || '').trim();
      if (!key) continue;
      let value = u?.value == null ? '' : String(u.value);

      // Map plaintext password to a hash; never store the raw password.
      if (key === 'admin_password') {
        if (!value) continue; // empty → don't change password
        const hash = createPasswordHash(value);
        const hashRec = byKey['admin_password_hash'];
        if (hashRec?.id) {
          await patchTableRecord('site_settings', hashRec.id, { value: hash });
        } else {
          await createTableRecord('site_settings', { key: 'admin_password_hash', value: hash, description: 'Hashed admin password (scrypt)' });
        }
        continue;
      }

      const rec = byKey[key];
      if (rec?.id) {
        await patchTableRecord('site_settings', rec.id, { value });
      } else {
        await createTableRecord('site_settings', { key, value });
      }
    }

    sendJson(res, 200, { ok: true });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: e.message || 'Settings save failed' });
  }
}

async function handlePublicFormSubmit(req, res) {
  try {
    const body = await readJsonBody(req);
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();

    if (!name || !phone) {
      sendJson(res, 400, { ok: false, error: 'Имя и телефон обязательны' });
      return;
    }

    const submission = {
      form_type: String(body?.form_type || 'consultation').trim().slice(0, 64) || 'consultation',
      name: name.slice(0, 200),
      phone: phone.slice(0, 64),
      email: String(body?.email || '').trim().slice(0, 200),
      message: String(body?.message || '').trim().slice(0, 4000),
      page_url: String(body?.page_url || '').trim().slice(0, 500),
      utm_source: String(body?.utm_source || '').trim().slice(0, 200),
      utm_medium: String(body?.utm_medium || '').trim().slice(0, 200),
      utm_campaign: String(body?.utm_campaign || '').trim().slice(0, 200),
      utm_content: String(body?.utm_content || '').trim().slice(0, 200),
      utm_term: String(body?.utm_term || '').trim().slice(0, 200),
      status: 'new'
    };

    let saved = null;
    try {
      saved = await createTableRecord('form_submissions', submission);
    } catch (e) {
      sendJson(res, 502, { ok: false, error: 'Не удалось сохранить заявку' });
      return;
    }

    // Telegram is best-effort; submission is already saved in admin
    const telegram = await sendTelegramNotification(submission);

    sendJson(res, 200, {
      ok: true,
      id: saved?.id || '',
      telegram_sent: !!telegram.sent,
      telegram_reason: telegram.sent ? undefined : telegram.reason
    });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Bad request' });
  }
}

function createPublishServer() {
  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'publish-server', port: PORT });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/auth/verify') {
      handleAdminAuthVerify(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/settings') {
      if (!assertAuthorized(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
      }
      await handleAdminSettingsGet(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/auth/login') {
      await handleAdminAuthLogin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/auth/logout') {
      handleAdminAuthLogout(req, res);
      return;
    }

    // Public lead submission endpoint (no auth) — saves to admin + sends Telegram server-side
    if (req.method === 'POST' && (url.pathname === '/public/submit-form' || url.pathname === '/admin/public/submit-form')) {
      await handlePublicFormSubmit(req, res);
      return;
    }

    if (req.method === 'POST') {
      if (!assertAuthorized(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized publish request' });
        return;
      }

      const doctorRoute = url.pathname.match(/^\/admin\/publish\/doctor\/([a-z0-9\-]+)$/i);
      if (doctorRoute) {
        const dryRun = url.searchParams.get('dry_run') === '1' || url.searchParams.get('mode') === 'dry-run';
        await handlePublishOne(req, res, doctorRoute[1], dryRun);
        return;
      }

      if (url.pathname === '/admin/publish/doctors/bulk') {
        await handlePublishBulk(req, res);
        return;
      }

      if (url.pathname === '/admin/publish/sitemap') {
        await handleSitemapPublish(req, res);
        return;
      }

      if (url.pathname === '/admin/relations/validate-doctor') {
        await handleValidateDoctorRelations(req, res);
        return;
      }

      if (url.pathname === '/admin/seo/static-statuses') {
        await handleStaticStatusBatch(req, res);
        return;
      }

      if (url.pathname === '/admin/settings') {
        await handleAdminSettingsSave(req, res);
        return;
      }
    }

    if (req.method === 'DELETE') {
      if (!assertAuthorized(req)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized publish request' });
        return;
      }

      const clinicRoute = url.pathname.match(/^\/admin\/clinics\/([^/]+)$/i);
      if (clinicRoute) {
        await handleClinicDelete(req, res, clinicRoute[1]);
        return;
      }

      const treatmentRoute = url.pathname.match(/^\/admin\/treatments\/([^/]+)$/i);
      if (treatmentRoute) {
        await handleTreatmentDelete(req, res, treatmentRoute[1]);
        return;
      }
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  });
}

if (require.main === module) {
  const server = createPublishServer();
  server.listen(PORT, () => {
    console.log(`Publish server started on http://0.0.0.0:${PORT}`);
    console.log(`TABLES_API_BASE=${TABLES_API_BASE}`);
    console.log(`PROJECT_ROOT=${PROJECT_ROOT}`);
  });
}

module.exports = {
  createPublishServer,
  checkStaticDoctorFileExists,
  buildStaticStatusMap,
  verifyAdminSessionToken
};
