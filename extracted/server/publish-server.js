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

const PORT = Number(process.env.PORT || 8787);
const TABLES_API_BASE = (process.env.TABLES_API_BASE || 'http://localhost:8788/tables').replace(/\/$/, '');
const ADMIN_PUBLISH_TOKEN = process.env.ADMIN_PUBLISH_TOKEN || '';

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
  'Педиатрия': { url: '../napravleniya/pediatriya.html', icon: 'fa-baby' },
  'Хирургическая гастроэнтерология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская гастроэнтерология': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская гематология': { url: '../napravleniya/gematologiya.html', icon: 'fa-droplet' },
  'Внутренние болезни': { url: '../napravleniya/terapiya.html', icon: 'fa-stethoscope' },
  'Эндоскопия': { url: '../napravleniya/gastroenterologiya.html', icon: 'fa-stomach' },
  'Детская аллергология': { url: '../napravleniya/allergologiya.html', icon: 'fa-lungs' },
  'Психогериатрия': { url: '../napravleniya/geriatriya.html', icon: 'fa-person-cane' }
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
    online_consultation: !!raw?.online_consultation
  };
}

function buildDoctorDirectionsHtml(specialty) {
  const specs = parseCsv(specialty);
  const used = new Set();
  const items = [];
  specs.forEach(spec => {
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

  const title = `${doctor.name_ru} — ${doctor.specialty || 'Врач'} | Taurus Medical Experts`;
  const metaDescription = buildDoctorSeoMetaDescription(doctor);
  const keywords = buildDoctorSeoKeywords(doctor);
  const descriptionHtml = buildDoctorDescriptionHtml(doctor.description);
  const directionHtml = buildDoctorDirectionsHtml(doctor.specialty);

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
    <meta name="robots" content="index, follow">
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}

function assertAuthorized(req) {
  if (!ADMIN_PUBLISH_TOKEN) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${ADMIN_PUBLISH_TOKEN}`;
}

async function fetchDoctorById(id) {
  const url = `${TABLES_API_BASE}/doctors/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Doctor fetch failed: HTTP ${response.status}`);
  }
  return response.json();
}

function upsertDoctorIntoSitemap(slug) {
  if (!fs.existsSync(SITEMAP_PATH)) return { updated: false, reason: 'sitemap.xml not found' };

  const sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const loc = `https://taurus-medical.com/vrachi/${slug}.html`;

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
    const sitemap = dryRun ? { updated: false, reason: 'dry_run' } : upsertDoctorIntoSitemap(result.slug);

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
    sendJson(res, 400, { ok: false, error: e.message || 'Publish failed' });
  }
}

async function handlePublishBulk(req, res) {
  try {
    const body = await readJsonBody(req);
    const doctors = Array.isArray(body?.doctors) ? body.doctors : [];
    if (!doctors.length) throw new Error('doctors[] is required');

    const published = [];
    const failed = [];

    for (const doctor of doctors) {
      try {
        const out = publishDoctorFile(doctor, false);
        published.push({ id: out.slug, file_name: out.file_name });
        upsertDoctorIntoSitemap(out.slug);
      } catch (e) {
        failed.push({ id: doctor?.id || '', error: e.message || 'Unknown error' });
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

    const updates = slugs.map(slug => ({ slug, ...upsertDoctorIntoSitemap(slug) }));
    sendJson(res, 200, { ok: true, updates });
  } catch (e) {
    sendJson(res, 400, { ok: false, error: e.message || 'Sitemap publish failed' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'publish-server', port: PORT });
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
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Publish server started on http://0.0.0.0:${PORT}`);
  console.log(`TABLES_API_BASE=${TABLES_API_BASE}`);
  console.log(`PROJECT_ROOT=${PROJECT_ROOT}`);
});
