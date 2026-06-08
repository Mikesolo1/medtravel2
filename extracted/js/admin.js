// ===== ADMIN PANEL LOGIC =====
    const API_BASE = 'tables';
    const PUBLISH_API_BASE = (window.__PUBLISH_API_BASE__ || '').replace(/\/$/, '');
    const PUBLISH_API_TOKEN = window.__PUBLISH_API_TOKEN__ || '';
    let currentPassword = '';
    let settings = {};
    let pages = [];
    let selectedPageId = null;
    let doctorsList = [];
    let clinicsList = [];
    let treatmentsList = [];
    let doctorProfileStatusCache = {};

    function normalizeSlug(value) {
        return (value || '').trim().toLowerCase();
    }

    function isValidSlug(value) {
        return /^[a-z0-9\-]+$/.test(value);
    }

    async function getErrorText(response) {
        try {
            const text = await response.text();
            return text || `HTTP ${response.status}`;
        } catch (e) {
            return `HTTP ${response.status}`;
        }
    }

    const DOCTOR_SPECIALTY_MAP = {
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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function parseList(value) {
        return parseCsv(value).map(v => v.trim()).filter(Boolean);
    }

    function sanitizeDoctorForSeo(doctor) {
        const id = normalizeSlug(doctor?.id);
        return {
            id,
            name_ru: (doctor?.name_ru || '').trim(),
            specialty: (doctor?.specialty || '').trim(),
            position: (doctor?.position || '').trim(),
            clinic_name: (doctor?.clinic_name || '').trim(),
            description: (doctor?.description || '').trim(),
            photo_url: (doctor?.photo_url || '').trim(),
            tags: parseList(doctor?.tags),
            languages: parseList(doctor?.languages),
            online_consultation: !!doctor?.online_consultation
        };
    }

    function buildDoctorDirectionsHtml(specialty) {
        const specs = parseList(specialty);
        const used = new Set();
        const items = [];
        specs.forEach(spec => {
            const mapped = DOCTOR_SPECIALTY_MAP[spec];
            if (mapped) {
                if (used.has(mapped.url)) return;
                used.add(mapped.url);
                items.push(`<a href="${mapped.url}" class="doctor-directions__item"><i class="fas ${mapped.icon}"></i> ${escapeHtml(spec)}</a>`);
            } else {
                if (used.has(`txt:${spec}`)) return;
                used.add(`txt:${spec}`);
                items.push(`<span class="doctor-directions__item"><i class="fas fa-stethoscope"></i> ${escapeHtml(spec)}</span>`);
            }
        });
        return items.join('') || '<span class="doctor-directions__item"><i class="fas fa-stethoscope"></i> Общая консультация</span>';
    }

    function buildDoctorDescriptionHtml(description) {
        if (!description) return '<p>Информация о враче будет обновлена в ближайшее время.</p>';
        const paragraphs = String(description).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length === 0) return '<p>Информация о враче будет обновлена в ближайшее время.</p>';
        return paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
    }

    function buildDoctorSeoKeywords(doctor) {
        const parts = [doctor.name_ru, doctor.specialty, doctor.clinic_name, ...doctor.tags].filter(Boolean);
        return parts.join(', ');
    }

    function buildDoctorSeoMetaDescription(doctor) {
        const shortDesc = doctor.description || `${doctor.name_ru} — ${doctor.specialty}.`;
        return `${doctor.name_ru} — ${doctor.specialty}. ${doctor.position}. ${doctor.clinic_name}. ${shortDesc}`.replace(/\s+/g, ' ').trim().slice(0, 300);
    }

    function buildDoctorSeoJsonLd(doctor) {
        return {
            '@context': 'https://schema.org',
            '@type': 'Physician',
            name: doctor.name_ru,
            description: doctor.description || `${doctor.name_ru} — ${doctor.specialty}`,
            medicalSpecialty: parseList(doctor.specialty),
            worksFor: {
                '@type': 'Hospital',
                name: doctor.clinic_name || 'Клиника Израиля'
            }
        };
    }

    function buildDoctorStaticPageHtml(rawDoctor) {
        const doctor = sanitizeDoctorForSeo(rawDoctor);
        if (!doctor.id || !isValidSlug(doctor.id)) {
            throw new Error('Невалидный ID врача для SEO-публикации');
        }
        if (!doctor.name_ru) {
            throw new Error('Для SEO-публикации требуется ФИО врача');
        }

        const title = `${doctor.name_ru} — ${doctor.specialty || 'Врач'} | Taurus Medical Experts`;
        const metaDescription = buildDoctorSeoMetaDescription(doctor);
        const keywords = buildDoctorSeoKeywords(doctor);
        const jsonLd = JSON.stringify(buildDoctorSeoJsonLd(doctor));
        const badgesHtml = [
            doctor.online_consultation ? '<span class="doctor-profile__badge doctor-profile__badge--online"><i class="fas fa-video"></i> Онлайн-консультация</span>' : '',
            ...doctor.languages.map(lang => `<span class="doctor-profile__badge doctor-profile__badge--lang"><i class="fas fa-globe"></i> ${escapeHtml(lang)}</span>`)
        ].filter(Boolean).join('');
        const tagsHtml = doctor.tags.map(tag => `<span class="doctor-profile__tag">${escapeHtml(tag)}</span>`).join('');
        const directionsHtml = buildDoctorDirectionsHtml(doctor.specialty);
        const photoHtml = doctor.photo_url
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
    <link rel="canonical" href="vrachi/${encodeURIComponent(doctor.id)}.html">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/modal.css">
    <style>
        .doctor-profile { padding: 60px 0; } .doctor-profile__inner { display: grid; grid-template-columns: 280px 1fr; gap: 48px; align-items: start; } .doctor-profile__photo { width: 280px; height: 320px; border-radius: 20px; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 5rem; position: sticky; top: 100px; } .doctor-profile__photo img { width: 100%; height: 100%; object-fit: cover; border-radius: 20px; } .doctor-profile__content { min-width: 0; } .doctor-profile__name { font-size: 2rem; font-weight: 800; color: var(--color-primary); margin-bottom: 8px; } .doctor-profile__spec { font-size: 1.125rem; color: var(--color-secondary); font-weight: 600; margin-bottom: 8px; } .doctor-profile__position { font-size: 0.9375rem; color: #5A6B7F; margin-bottom: 20px; } .doctor-profile__clinic { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; background: rgba(43,179,163,0.08); border-radius: 100px; font-size: 0.875rem; color: var(--color-text); margin-bottom: 24px; } .doctor-profile__clinic i { color: var(--color-secondary); } .doctor-profile__badges { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; } .doctor-profile__badge { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: #F7F9FB; border: 1px solid #E2E8F0; border-radius: 100px; font-size: 0.8125rem; font-weight: 500; } .doctor-profile__badge--online { background: rgba(245,166,35,0.08); border-color: rgba(245,166,35,0.2); color: #c07800; } .doctor-profile__badge--lang { background: rgba(43,179,163,0.06); border-color: rgba(43,179,163,0.15); color: var(--color-secondary); } .doctor-profile__desc { font-size: 1rem; line-height: 1.8; color: var(--color-text); margin-bottom: 32px; } .doctor-profile__desc p { margin-bottom: 16px; } .doctor-profile__tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 32px; } .doctor-profile__tag { padding: 6px 14px; background: #F7F9FB; border: 1px solid #E2E8F0; border-radius: 100px; font-size: 0.8125rem; font-weight: 500; color: var(--color-text); } .doctor-profile__actions { display: flex; gap: 16px; flex-wrap: wrap; } .doctor-profile__actions .btn { padding: 14px 28px; font-size: 0.9375rem; } .doctor-directions { padding: 40px 0 60px; background: #F7F9FB; } .doctor-directions__title { font-size: 1.25rem; font-weight: 700; color: var(--color-primary); margin-bottom: 20px; } .doctor-directions__list { display: flex; flex-wrap: wrap; gap: 12px; } .doctor-directions__item { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; font-size: 0.875rem; font-weight: 500; color: var(--color-primary); text-decoration: none; transition: all 0.2s; } .doctor-directions__item:hover { border-color: var(--color-secondary); color: var(--color-secondary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); } .doctor-directions__item i { color: var(--color-secondary); }
        @media (max-width: 768px) { .doctor-profile__inner { grid-template-columns: 1fr; } .doctor-profile__photo { width: 180px; height: 220px; margin: 0 auto; position: static; font-size: 3.5rem; } .doctor-profile__name { font-size: 1.5rem; text-align: center; } .doctor-profile__spec, .doctor-profile__position { text-align: center; } .doctor-profile__clinic { display: flex; justify-content: center; } .doctor-profile__badges { justify-content: center; } .doctor-profile__actions { justify-content: center; } }
    </style>
    <script type="application/ld+json">
    ${jsonLd}
    ${'</scr' + 'ipt>'}
</head>
<body>
    <header class="header" id="header"><div class="container"><div class="header__inner">
        <a href="../index.html" class="header__logo"><div class="header__logo-icon"><i class="fas fa-plus"></i></div><div><span class="header__logo-text">Taurus Medical</span><span class="header__logo-sub">Лечение в Израиле</span></div></a>
        <nav class="header__nav"><a href="../o-nas.html" class="header__nav-link">О нас</a><a href="../kliniki-izrailya.html" class="header__nav-link">Клиники</a><a href="../otdeleniya.html" class="header__nav-link">Отделения</a><a href="../vrachi.html" class="header__nav-link header__nav-link--active">Врачи</a><a href="../patsientam.html" class="header__nav-link">Пациентам</a><a href="../kontakty.html" class="header__nav-link">Контакты</a></nav>
        <a href="tel:+78463744437" class="header__phone"><i class="fas fa-phone"></i> +7 (846) 37-444-37</a>
        <a href="../kontakty.html" class="btn btn--primary header__cta">Консультация</a>
        <button class="header__burger" id="burger" aria-label="Меню"><span class="header__burger-line"></span><span class="header__burger-line"></span><span class="header__burger-line"></span></button>
    </div></div></header>
    <div class="mobile-nav" id="mobileNav"><a href="../index.html" class="mobile-nav__link" data-close>Главная</a><a href="../o-nas.html" class="mobile-nav__link" data-close>О нас</a><a href="../kliniki-izrailya.html" class="mobile-nav__link" data-close>Клиники</a><a href="../otdeleniya.html" class="mobile-nav__link" data-close>Отделения</a><a href="../vrachi.html" class="mobile-nav__link" data-close>Врачи</a><a href="../patsientam.html" class="mobile-nav__link" data-close>Пациентам</a><a href="../kontakty.html" class="mobile-nav__link" data-close>Контакты</a><div class="mobile-nav__cta"><a href="../kontakty.html" class="btn btn--primary" data-close>Получить консультацию</a></div></div>

    <section class="page-hero"><div class="container"><div class="page-hero__inner">
        <div class="page-hero__breadcrumb"><a href="../index.html">Главная</a><span>/</span><a href="../vrachi.html">Врачи</a><span>/</span><span>${escapeHtml(doctor.name_ru)}</span></div>
        <h1 class="page-hero__title">${escapeHtml(doctor.name_ru)}</h1>
    </div></div></section>

    <section class="doctor-profile"><div class="container"><div class="doctor-profile__inner">
        <div class="doctor-profile__photo">${photoHtml}</div>
        <div class="doctor-profile__content">
            <h2 class="doctor-profile__name">${escapeHtml(doctor.name_ru)}</h2>
            <div class="doctor-profile__spec">${escapeHtml(doctor.specialty || 'Врач-специалист')}</div>
            <div class="doctor-profile__position">${escapeHtml(doctor.position || 'Врач высшей категории')}</div>
            <div class="doctor-profile__clinic"><i class="fas fa-hospital"></i> <span>${escapeHtml(doctor.clinic_name || 'Клиника Израиля')}</span></div>
            <div class="doctor-profile__badges">${badgesHtml}</div>
            <div class="doctor-profile__desc">${buildDoctorDescriptionHtml(doctor.description)}</div>
            <div class="doctor-profile__tags">${tagsHtml}</div>
            <div class="doctor-profile__actions">
                <a href="../kontakty.html" class="btn btn--primary"><i class="fas fa-calendar-check"></i> Записаться на консультацию</a>
                <a href="../kontakty.html" class="btn btn--secondary"><i class="fas fa-video"></i> Второе мнение онлайн</a>
            </div>
        </div>
    </div></div></section>

    <section class="doctor-directions"><div class="container">
        <h3 class="doctor-directions__title">Направления специалиста</h3>
        <div class="doctor-directions__list">${directionsHtml}</div>
    </div></section>

    <section class="cta-section"><div class="container"><div class="cta-section__inner">
        <h2 class="cta-section__title">Записаться к ${escapeHtml(doctor.name_ru)}</h2>
        <p class="cta-section__text">Отправьте документы — мы организуем консультацию с этим специалистом.</p>
        <div class="btn-group">
            <a href="../kontakty.html" class="btn btn--primary"><i class="fas fa-file-medical"></i> Отправить документы</a>
            <a href="../kontakty.html" class="btn btn--secondary"><i class="fas fa-video"></i> Получить второе мнение онлайн</a>
        </div>
    </div></div></section>

    <footer class="footer"><div class="container"><div class="footer__inner">
        <div class="footer__logo"><div class="footer__logo-icon"><i class="fas fa-plus"></i></div><span class="footer__logo-text">Taurus Medical Experts</span></div>
        <div class="footer__links"><a href="../index.html" class="footer__link">Главная</a><a href="../o-nas.html" class="footer__link">О нас</a><a href="../kliniki-izrailya.html" class="footer__link">Клиники</a><a href="../otdeleniya.html" class="footer__link">Отделения</a><a href="../vrachi.html" class="footer__link">Врачи</a><a href="../patsientam.html" class="footer__link">Пациентам</a><a href="../otzyvy.html" class="footer__link">Отзывы</a><a href="../kontakty.html" class="footer__link">Контакты</a></div>
        <p class="footer__disclaimer">Мы соблюдаем конфиденциальность и работаем по согласованным этапам и договору.</p>
        <p class="footer__copy">© 2024–2026 Taurus Medical Experts. Все права защищены.</p>
    </div></div></footer>
    ${'<script src="../js/main.js"></' + 'script>'}
    ${'<script src="../js/doctor-profile.js" data-doctor-id="' + escapeHtml(doctor.id) + '"></' + 'script>'}
</body>
</html>`;
    }

    function downloadDoctorStaticPage(doctor) {
        const html = buildDoctorStaticPageHtml(doctor);
        const fileName = `${normalizeSlug(doctor.id)}.html`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return fileName;
    }

    function downloadTextFile(fileName, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function downloadJsonFile(fileName, payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function csvEscape(value) {
        const raw = String(value ?? '');
        return `"${raw.replace(/"/g, '""')}"`;
    }

    function getPublishEndpoint(path) {
        if (PUBLISH_API_BASE) return `${PUBLISH_API_BASE}${path}`;
        return path;
    }

    function getPublishHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (PUBLISH_API_TOKEN) headers.Authorization = `Bearer ${PUBLISH_API_TOKEN}`;
        return headers;
    }

    async function callPublishJson(path, options = {}) {
        const endpoint = getPublishEndpoint(path);
        const response = await fetch(endpoint, {
            method: options.method || 'GET',
            headers: {
                ...getPublishHeaders(),
                ...(options.headers || {})
            },
            body: options.body,
            signal: options.signal
        });

        let payload = {};
        try {
            payload = await response.json();
        } catch (_) {
            payload = {};
        }

        if (!response.ok || payload?.ok === false) {
            const message = payload?.error || `HTTP ${response.status}`;
            throw new Error(message);
        }

        return payload;
    }

    async function tryServerValidateDoctorRelations({ clinic_slug = '', treatment_slugs = [] }) {
        return callPublishJson('/admin/relations/validate-doctor', {
            method: 'POST',
            body: JSON.stringify({ clinic_slug, treatment_slugs })
        });
    }

    async function tryServerDeleteClinic(clinicId) {
        return callPublishJson(`/admin/clinics/${encodeURIComponent(clinicId)}`, {
            method: 'DELETE'
        });
    }

    async function tryServerDeleteTreatment(treatmentId) {
        return callPublishJson(`/admin/treatments/${encodeURIComponent(treatmentId)}`, {
            method: 'DELETE'
        });
    }

    async function tryServerPublishDoctor(doctor, dryRun = false) {
        const normalizedId = normalizeSlug(doctor?.id);
        if (!normalizedId || !isValidSlug(normalizedId)) throw new Error('Невалидный ID для server publish');

        const query = dryRun ? '?mode=dry-run' : '';
        const endpoint = getPublishEndpoint(`/admin/publish/doctor/${encodeURIComponent(normalizedId)}${query}`);
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: getPublishHeaders(),
            body: JSON.stringify({ doctor })
        });

        if (!response.ok) {
            let text = `HTTP ${response.status}`;
            try { text = await response.text(); } catch (_) {}
            throw new Error(`server publish failed: ${text}`);
        }

        let payload = {};
        try { payload = await response.json(); } catch (_) {}
        if (!payload?.ok) throw new Error(payload?.error || 'server publish returned non-ok payload');
        return payload;
    }

    async function tryServerBulkPublish(doctors) {
        const endpoint = getPublishEndpoint('/admin/publish/doctors/bulk');
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: getPublishHeaders(),
            body: JSON.stringify({ doctors })
        });

        if (!response.ok) {
            let text = `HTTP ${response.status}`;
            try { text = await response.text(); } catch (_) {}
            throw new Error(`server bulk publish failed: ${text}`);
        }

        const payload = await response.json();
        if (!payload?.ok) throw new Error(payload?.error || 'server bulk publish returned non-ok payload');
        return payload;
    }

    async function publishDoctorStaticPageById(id) {
        const doctor = doctorsList.find(d => d.id === id);
        if (!doctor) {
            showToast('Врач не найден в списке', 'error');
            return;
        }
        try {
            try {
                await tryServerPublishDoctor(doctor, false);
                doctorProfileStatusCache[id] = true;
                renderDoctorsTable();
                showToast(`SEO-страница ${normalizeSlug(id)}.html опубликована на сервере`, 'success');
                return;
            } catch (serverError) {
                console.warn('Server publish unavailable, fallback to download:', serverError);
            }

            const fileName = downloadDoctorStaticPage(doctor);
            doctorProfileStatusCache[id] = true;
            renderDoctorsTable();
            showToast(`SEO-страница ${fileName} сформирована локально. Загрузите файл в /vrachi/.`, 'success');
        } catch (e) {
            showToast('Ошибка SEO-публикации: ' + e.message, 'error');
        }
    }

    async function bulkPublishFallbackDoctorPages() {
        try {
            if (!doctorsList.length) await loadDoctors();
            await refreshDoctorProfileStatuses(false);

            const fallbackDoctors = doctorsList.filter(d => d.id && !doctorProfileStatusCache[d.id]);
            if (!fallbackDoctors.length) {
                showToast('Все врачи уже имеют статические SEO-страницы', 'success');
                return;
            }

            const generated = [];
            const failed = [];

            try {
                const bulkResult = await tryServerBulkPublish(fallbackDoctors);
                (bulkResult.published || []).forEach(item => {
                    generated.push(item.file_name || `${item.id}.html`);
                    if (item.id) doctorProfileStatusCache[item.id] = true;
                });
                (bulkResult.failed || []).forEach(item => {
                    failed.push(`${item.id}: ${item.error}`);
                });
            } catch (serverBulkError) {
                console.warn('Server bulk publish unavailable, fallback to local download:', serverBulkError);
                fallbackDoctors.forEach((doctor) => {
                    try {
                        const fileName = downloadDoctorStaticPage(doctor);
                        generated.push(fileName);
                        doctorProfileStatusCache[doctor.id] = true;
                    } catch (e) {
                        failed.push(`${doctor.id}: ${e.message}`);
                    }
                });
            }

            renderDoctorsTable();

            const reportLines = [
                'Bulk SEO publish report',
                `Generated: ${generated.length}`,
                `Failed: ${failed.length}`,
                '',
                'Generated files:',
                ...generated.map(f => `- ${f}`),
                '',
                'Failed items:',
                ...(failed.length ? failed.map(f => `- ${f}`) : ['- none'])
            ];
            downloadTextFile('seo_publish_report.txt', reportLines.join('\n'));

            if (failed.length > 0) {
                showToast(`Bulk SEO: сформировано ${generated.length}, ошибок ${failed.length}`, 'error');
            } else {
                showToast(`Bulk SEO: сформировано ${generated.length} страниц`, 'success');
            }
        } catch (e) {
            showToast('Ошибка bulk SEO-публикации: ' + e.message, 'error');
        }
    }

    async function exportFallbackSeoPackage() {
        try {
            if (!doctorsList.length) await loadDoctors();
            await refreshDoctorProfileStatuses(false);

            const fallbackDoctors = doctorsList.filter(d => d.id && !doctorProfileStatusCache[d.id]);
            if (!fallbackDoctors.length) {
                showToast('Fallback-врачей не найдено: пакет не требуется', 'success');
                return;
            }

            const packageItems = [];
            const failed = [];

            fallbackDoctors.forEach((doctor) => {
                try {
                    const html = buildDoctorStaticPageHtml(doctor);
                    packageItems.push({
                        doctor_id: normalizeSlug(doctor.id),
                        file_name: `${normalizeSlug(doctor.id)}.html`,
                        name_ru: doctor.name_ru || '',
                        specialty: doctor.specialty || '',
                        clinic_name: doctor.clinic_name || '',
                        html
                    });
                } catch (e) {
                    failed.push(`${doctor.id}: ${e.message}`);
                }
            });

            const now = new Date();
            const datePart = now.toISOString().slice(0, 10);
            const payload = {
                exported_at: now.toISOString(),
                export_type: 'fallback_doctors_seo_package',
                items_count: packageItems.length,
                failed_count: failed.length,
                items: packageItems
            };
            downloadJsonFile(`seo_fallback_package_${datePart}.json`, payload);

            const reportLines = [
                'SEO fallback package export report',
                `Exported: ${packageItems.length}`,
                `Failed: ${failed.length}`,
                '',
                'Files in package:',
                ...packageItems.map(i => `- ${i.file_name}`),
                '',
                'Failed items:',
                ...(failed.length ? failed.map(f => `- ${f}`) : ['- none'])
            ];
            downloadTextFile('seo_fallback_package_report.txt', reportLines.join('\n'));

            if (failed.length > 0) {
                showToast(`SEO-пакет: экспортировано ${packageItems.length}, ошибок ${failed.length}`, 'error');
            } else {
                showToast(`SEO-пакет сформирован: ${packageItems.length} страниц`, 'success');
            }
        } catch (e) {
            showToast('Ошибка экспорта SEO-пакета: ' + e.message, 'error');
        }
    }

    async function exportSeoPublishManifest() {
        try {
            if (!doctorsList.length) await loadDoctors();
            if (!clinicsList.length) await loadClinics();
            if (!treatmentsList.length) await loadTreatments();
            await refreshDoctorProfileStatuses(false);

            const clinicMap = new Map(clinicsList.map(c => [normalizeSlug(c.slug), c.name_ru || c.slug || '']));
            const treatmentMap = new Map(treatmentsList.map(t => [normalizeSlug(t.slug || t.id), t.name_ru || t.slug || t.id || '']));

            const now = new Date();
            const datePart = now.toISOString().slice(0, 10);
            const header = [
                'doctor_id',
                'doctor_name_ru',
                'clinic_slug',
                'clinic_name',
                'specialty',
                'treatment_slugs',
                'treatment_names',
                'seo_status',
                'source_url',
                'target_path'
            ];

            const rows = doctorsList
                .filter(d => d.id)
                .map(d => {
                    const doctorId = normalizeSlug(d.id);
                    const clinicSlug = normalizeSlug(d.clinic_slug);
                    const treatmentSlugs = parseCsv(d.treatment_slugs).map(normalizeSlug).filter(Boolean);
                    const treatmentNames = treatmentSlugs.map(slug => treatmentMap.get(slug) || slug);
                    const seoStatus = doctorProfileStatusCache[d.id] ? 'static' : 'fallback';
                    return [
                        doctorId,
                        d.name_ru || '',
                        clinicSlug,
                        clinicMap.get(clinicSlug) || d.clinic_name || '',
                        d.specialty || '',
                        treatmentSlugs.join(','),
                        treatmentNames.join(','),
                        seoStatus,
                        `vrachi/template.html?id=${encodeURIComponent(doctorId)}`,
                        `vrachi/${doctorId}.html`
                    ];
                });

            const csvContent = [header, ...rows]
                .map(cols => cols.map(csvEscape).join(','))
                .join('\n');
            downloadTextFile(`seo_publish_manifest_${datePart}.csv`, csvContent);

            const staticCount = rows.filter(r => r[7] === 'static').length;
            const fallbackCount = rows.length - staticCount;
            const checklist = [
                'SEO publish checklist',
                `Generated at: ${now.toISOString()}`,
                `Total doctors: ${rows.length}`,
                `Static pages already present: ${staticCount}`,
                `Fallback pages to publish: ${fallbackCount}`,
                '',
                'Recommended flow:',
                '1) Open manifest CSV and filter seo_status = fallback.',
                '2) Preferred: call server endpoint POST /admin/publish/doctors/bulk.',
                '3) Fallback: generate files via admin bulk publish/export package.',
                '4) Place resulting *.html files into /vrachi/ and deploy.',
                '',
                'Fallback doctor IDs:',
                ...rows.filter(r => r[7] === 'fallback').map(r => `- ${r[0]}`)
            ];
            downloadTextFile('seo_publish_checklist.txt', checklist.join('\n'));

            showToast(`SEO manifest экспортирован: fallback ${fallbackCount}, static ${staticCount}`, fallbackCount > 0 ? 'error' : 'success');
        } catch (e) {
            showToast('Ошибка экспорта SEO manifest: ' + e.message, 'error');
        }
    }

    async function collectSeoDryRunData() {
        if (!doctorsList.length) await loadDoctors();
        await refreshDoctorProfileStatuses(false);

        const fallbackDoctors = doctorsList.filter(d => d.id && !doctorProfileStatusCache[d.id]);
        const canGenerate = [];
        const blocked = [];

        fallbackDoctors.forEach((doctor) => {
            const normalizedId = normalizeSlug(doctor.id);
            if (!normalizedId || !isValidSlug(normalizedId)) {
                blocked.push({
                    doctor_id: doctor.id || '',
                    doctor_name: doctor.name_ru || doctor.id || '(без имени)',
                    reason: 'невалидный id',
                    target_path: ''
                });
                return;
            }
            if (!(doctor.name_ru || '').trim()) {
                blocked.push({
                    doctor_id: normalizedId,
                    doctor_name: doctor.name_ru || normalizedId,
                    reason: 'не заполнено ФИО',
                    target_path: `vrachi/${normalizedId}.html`
                });
                return;
            }

            canGenerate.push({
                id: normalizedId,
                name: doctor.name_ru || normalizedId,
                specialty: doctor.specialty || '—',
                target: `vrachi/${normalizedId}.html`
            });
        });

        return { fallbackDoctors, canGenerate, blocked };
    }

    async function runSeoDryRunPreview() {
        try {
            const { fallbackDoctors, canGenerate, blocked } = await collectSeoDryRunData();

            const summary = `<strong>SEO dry-run preview</strong><br>
                Fallback-врачей: <strong>${fallbackDoctors.length}</strong><br>
                Готово к генерации: <strong>${canGenerate.length}</strong><br>
                Блокеры: <strong>${blocked.length}</strong>`;

            const previewItems = canGenerate.slice(0, 12).map(i => `<li><strong>${escapeHtml(i.id)}</strong> — ${escapeHtml(i.name)} (${escapeHtml(i.specialty)}) → ${escapeHtml(i.target)}</li>`);
            const blockedItems = blocked.slice(0, 12).map(i => `<li><strong>${escapeHtml(i.doctor_id || '—')}</strong> — ${escapeHtml(i.reason)}</li>`);

            const details = [
                canGenerate.length ? `<div style="margin-top:8px;"><strong>Примеры генерации:</strong><ul style="margin:6px 0 0 18px;">${previewItems.join('')}</ul>${canGenerate.length > 12 ? `<div style="margin-top:4px;color:var(--text-light);">и ещё ${canGenerate.length - 12}</div>` : ''}</div>` : '',
                blocked.length ? `<div style="margin-top:8px;"><strong>Блокеры:</strong><ul style="margin:6px 0 0 18px;">${blockedItems.join('')}</ul>${blocked.length > 12 ? `<div style="margin-top:4px;color:var(--text-light);">и ещё ${blocked.length - 12}</div>` : ''}</div>` : ''
            ].join('');

            renderIntegrationCheckResult(summary + details, blocked.length > 0);
            showToast(`Dry-run: готово ${canGenerate.length}, блокеров ${blocked.length}`, blocked.length > 0 ? 'error' : 'success');
        } catch (e) {
            renderIntegrationCheckResult(`<strong>Ошибка SEO dry-run:</strong> ${escapeHtml(e.message || 'unknown')}`, true);
            showToast('Ошибка SEO dry-run: ' + e.message, 'error');
        }
    }

    async function exportSeoDryRunReport() {
        try {
            const { fallbackDoctors, canGenerate, blocked } = await collectSeoDryRunData();
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10);

            const header = ['doctor_id', 'doctor_name', 'status', 'specialty', 'target_path', 'reason'];
            const rows = [
                ...canGenerate.map(item => [item.id, item.name, 'ready', item.specialty, item.target, '']),
                ...blocked.map(item => [item.doctor_id, item.doctor_name, 'blocked', '', item.target_path || '', item.reason])
            ];
            const csvContent = [header, ...rows].map(cols => cols.map(csvEscape).join(',')).join('\n');
            downloadTextFile(`seo_dry_run_report_${datePart}.csv`, csvContent);

            const txt = [
                'SEO dry-run export report',
                `Generated at: ${now.toISOString()}`,
                `Fallback doctors: ${fallbackDoctors.length}`,
                `Ready: ${canGenerate.length}`,
                `Blocked: ${blocked.length}`,
                '',
                'Blocked details:',
                ...(blocked.length ? blocked.map(b => `- ${b.doctor_id || '—'}: ${b.reason}`) : ['- none'])
            ].join('\n');
            downloadTextFile('seo_dry_run_report.txt', txt);

            showToast(`Dry-run отчет экспортирован: ready ${canGenerate.length}, blocked ${blocked.length}`, blocked.length > 0 ? 'error' : 'success');
        } catch (e) {
            showToast('Ошибка экспорта dry-run отчета: ' + e.message, 'error');
        }
    }

    // --- AUTH ---
    async function handleLogin() {
        const pwd = document.getElementById('loginPassword').value;
        if (!pwd) return;
        try {
            const res = await fetch(`${API_BASE}/site_settings?search=admin_password`);
            const data = await res.json();
            const record = data.data.find(r => r.key === 'admin_password');
            if (record && record.value === pwd) {
                currentPassword = pwd;
                document.getElementById('loginOverlay').classList.add('hidden');
                document.getElementById('adminLayout').style.display = 'grid';
                loadPages().then(() => ensureNapravleniyaPages()); loadSettings(); loadSubmissions(); loadDoctors(); loadClinics(); loadTreatments();
            } else {
                document.getElementById('loginError').style.display = 'block';
            }
        } catch (e) { showToast('Ошибка подключения к серверу', 'error'); }
    }
    // Enter key handling now done via form submit

    function handleLogout() {
        currentPassword = '';
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('adminLayout').style.display = 'none';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginError').style.display = 'none';
    }

    // --- TABS ---
    function switchTab(tabName) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.admin-sidebar__link').forEach(l => l.classList.remove('active'));
        document.getElementById('tab-' + tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    // --- PAGES ---
    const PAGE_NAMES = {
        'index': 'Главная', 'o-nas': 'О нас', 'kliniki-izrailya': 'Клиники Израиля',
        'kliniki-ikhilov': 'Ихилов', 'kliniki-assuta': 'Ассута', 'kliniki-sheba': 'Шиба',
        'kliniki-rabin': 'Рабина', 'kliniki-wolfson': 'Вольфсон', 'kliniki-herzliya': 'Герцлия',
        'kliniki-medica': 'Медика', 'otdeleniya': 'Отделения', 'onkologiya': 'Онкология',
        'vrachi': 'Врачи', 'patsientam': 'Пациентам', 'patsientam-prieezd': 'Приезд в Израиль',
        'patsientam-obsledovaniya': 'Программы обследования', 'patsientam-uslugi': 'Сопутствующие услуги',
        'otzyvy': 'Отзывы', 'kontakty': 'Контакты',
        'napravleniya-allergologiya': 'Аллергология', 'napravleniya-gastroenterologiya': 'Гастроэнтерология',
        'napravleniya-gematologiya': 'Гематология', 'napravleniya-genetika': 'Генетика',
        'napravleniya-ginekologiya': 'Гинекология', 'napravleniya-geriatriya': 'Гериатрия',
        'napravleniya-kardiologiya': 'Кардиология', 'napravleniya-nevrologiya': 'Неврология',
        'napravleniya-ortopediya': 'Ортопедия', 'napravleniya-urologiya': 'Урология'
    };

    async function loadPages() {
        try {
            const res = await fetch(`${API_BASE}/page_content?limit=100`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            pages = data.data || [];
            renderPageSelector();
        } catch (e) { showToast('Ошибка загрузки страниц: ' + e.message, 'error'); }
    }

    function renderPageSelector() {
        const container = document.getElementById('pageSelector');
        container.innerHTML = pages.map(page => `
            <div class="page-selector__item ${selectedPageId === page.id ? 'active' : ''}" onclick="selectPage('${page.id}')">
                ${PAGE_NAMES[page.page_slug] || page.page_slug}
                <span>/${page.page_slug === 'index' ? '' : page.page_slug}</span>
            </div>
        `).join('');
    }

    function selectPage(pageId) {
        selectedPageId = pageId;
        const page = pages.find(p => p.id === pageId);
        if (!page) return;
        document.getElementById('editMetaTitle').value = page.meta_title || '';
        document.getElementById('editMetaDesc').value = page.meta_description || '';
        document.getElementById('editH1').value = page.h1 || '';
        document.getElementById('editHeroText').value = page.hero_text || '';
        document.getElementById('pageEditor').style.display = 'block';
        renderPageSelector();
    }

    async function savePageContent() {
        if (!selectedPageId) return;
        const payload = {
            meta_title: document.getElementById('editMetaTitle').value,
            meta_description: document.getElementById('editMetaDesc').value,
            h1: document.getElementById('editH1').value,
            hero_text: document.getElementById('editHeroText').value
        };
        try {
            const res = await fetch(`${API_BASE}/page_content/${selectedPageId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await getErrorText(res));
            showToast('Контент страницы сохранён!', 'success');
            const idx = pages.findIndex(p => p.id === selectedPageId);
            if (idx >= 0) Object.assign(pages[idx], payload);
        } catch (e) { showToast('Ошибка сохранения: ' + e.message, 'error'); }
    }

    function resetPageEditor() { if (selectedPageId) selectPage(selectedPageId); }

    function parseCsv(value) {
        return (value || '').split(',').map(v => v.trim()).filter(Boolean);
    }

    async function staticDoctorPageExists(doctorId) {
        const staticUrl = `vrachi/${encodeURIComponent(doctorId)}.html`;
        try {
            const headRes = await fetch(staticUrl, { method: 'HEAD' });
            if (headRes.ok) return true;
            if (headRes.status !== 405) return false;
            const getRes = await fetch(staticUrl, { method: 'GET' });
            return getRes.ok;
        } catch (e) {
            return false;
        }
    }

    async function refreshDoctorProfileStatuses(showResultToast = false) {
        if (!doctorsList.length) return;

        const checks = doctorsList.map(async (d) => {
            const id = d.id;
            if (!id) return;
            doctorProfileStatusCache[id] = await staticDoctorPageExists(id);
        });

        await Promise.all(checks);
        renderDoctorsTable();

        if (showResultToast) {
            const staticCount = doctorsList.filter(d => doctorProfileStatusCache[d.id]).length;
            const fallbackCount = doctorsList.length - staticCount;
            showToast(`Проверка SEO-страниц: статических ${staticCount}, fallback ${fallbackCount}`, 'success');
        }
    }

    function findDuplicates(values) {
        const normalized = values.map(v => normalizeSlug(v)).filter(Boolean);
        const seen = new Set();
        const dupes = new Set();
        normalized.forEach(v => {
            if (seen.has(v)) dupes.add(v);
            seen.add(v);
        });
        return Array.from(dupes);
    }

    function renderIntegrationCheckResult(html, hasIssues = false) {
        const box = document.getElementById('integrationCheckResult');
        if (!box) return;
        box.style.display = 'block';
        box.style.borderColor = hasIssues ? 'rgba(229,62,62,0.35)' : 'rgba(56,161,105,0.35)';
        box.style.background = hasIssues ? 'rgba(229,62,62,0.05)' : 'rgba(56,161,105,0.06)';
        box.innerHTML = html;
    }

    async function runIntegrationChecks() {
        try {
            await Promise.all([loadDoctors(), loadClinics(), loadTreatments()]);
            await refreshDoctorProfileStatuses(false);

            const clinicSlugs = new Set(clinicsList.map(c => normalizeSlug(c.slug)).filter(Boolean));
            const treatmentSlugs = new Set(treatmentsList.map(t => normalizeSlug(t.slug || t.id)).filter(Boolean));

            const doctorInvalidIds = doctorsList.filter(d => !isValidSlug(normalizeSlug(d.id))).map(d => d.id || '(empty)');
            const doctorDuplicateIds = findDuplicates(doctorsList.map(d => d.id));
            const clinicDuplicateSlugs = findDuplicates(clinicsList.map(c => c.slug));
            const treatmentDuplicateSlugs = findDuplicates(treatmentsList.map(t => t.slug || t.id));

            const doctorsWithUnknownClinic = doctorsList
                .filter(d => normalizeSlug(d.clinic_slug) && !clinicSlugs.has(normalizeSlug(d.clinic_slug)))
                .map(d => `${d.name_ru || d.id} → ${d.clinic_slug}`);

            const doctorsWithUnknownTreatments = doctorsList
                .map(d => {
                    const unknown = parseCsv(d.treatment_slugs)
                        .map(normalizeSlug)
                        .filter(Boolean)
                        .filter(slug => !treatmentSlugs.has(slug));
                    return unknown.length ? `${d.name_ru || d.id} → ${unknown.join(', ')}` : '';
                })
                .filter(Boolean);

            const doctorsWithoutStaticSeo = doctorsList
                .filter(d => d.id && !doctorProfileStatusCache[d.id])
                .map(d => d.name_ru || d.id);

            const totalIssues = doctorInvalidIds.length + doctorDuplicateIds.length + clinicDuplicateSlugs.length + treatmentDuplicateSlugs.length + doctorsWithUnknownClinic.length + doctorsWithUnknownTreatments.length;

            const summary = `<strong>Интеграционный тест завершён</strong><br>
                Врачи: ${doctorsList.length} • Клиники: ${clinicsList.length} • Профили лечения: ${treatmentsList.length}<br>
                Ошибки связности: <strong>${totalIssues}</strong> • Врачей на fallback SEO: <strong>${doctorsWithoutStaticSeo.length}</strong>`;

            const details = [
                doctorInvalidIds.length ? `<li><strong>Невалидные doctor.id:</strong> ${doctorInvalidIds.join('; ')}</li>` : '',
                doctorDuplicateIds.length ? `<li><strong>Дубли doctor.id:</strong> ${doctorDuplicateIds.join(', ')}</li>` : '',
                clinicDuplicateSlugs.length ? `<li><strong>Дубли clinic.slug:</strong> ${clinicDuplicateSlugs.join(', ')}</li>` : '',
                treatmentDuplicateSlugs.length ? `<li><strong>Дубли treatment.slug:</strong> ${treatmentDuplicateSlugs.join(', ')}</li>` : '',
                doctorsWithUnknownClinic.length ? `<li><strong>Врач → несуществующая клиника:</strong> ${doctorsWithUnknownClinic.join('; ')}</li>` : '',
                doctorsWithUnknownTreatments.length ? `<li><strong>Врач → несуществующий профиль лечения:</strong> ${doctorsWithUnknownTreatments.join('; ')}</li>` : '',
                doctorsWithoutStaticSeo.length ? `<li><strong>Fallback SEO (без статической страницы):</strong> ${doctorsWithoutStaticSeo.slice(0, 8).join(', ')}${doctorsWithoutStaticSeo.length > 8 ? ` и ещё ${doctorsWithoutStaticSeo.length - 8}` : ''}</li>` : ''
            ].filter(Boolean);

            renderIntegrationCheckResult(`${summary}${details.length ? `<ul style="margin:8px 0 0 18px;">${details.join('')}</ul>` : '<div style="margin-top:8px;color:var(--success);">Критичных проблем связности не найдено.</div>'}`, totalIssues > 0);

            if (totalIssues > 0) {
                showToast(`Интеграционный тест: найдено проблем ${totalIssues}`, 'error');
            } else {
                showToast('Интеграционный тест: критичных проблем не найдено', 'success');
            }
        } catch (e) {
            renderIntegrationCheckResult(`<strong>Ошибка интеграционного теста:</strong> ${escapeHtml(e.message || 'unknown')}`, true);
            showToast('Ошибка интеграционного теста: ' + e.message, 'error');
        }
    }

    function getDoctorSelectedTreatmentSlugs() {
        return Array.from(document.querySelectorAll('#docTreatmentsSelect input[type="checkbox"]:checked')).map(el => normalizeSlug(el.value));
    }

    function renderDoctorTreatmentsSelector(selectedSlugsCsv = '') {
        const box = document.getElementById('docTreatmentsSelect');
        if (!box) return;

        const selected = new Set(parseCsv(selectedSlugsCsv).map(normalizeSlug));
        const activeTreatments = treatmentsList.filter(t => t.is_active !== false);

        if (activeTreatments.length === 0) {
            box.innerHTML = '<span style="color:var(--text-light);font-size:0.8125rem;">Профили лечения не найдены. Сначала добавьте их во вкладке «Профили лечения».</span>';
            return;
        }

        box.innerHTML = activeTreatments
            .sort((a, b) => (a.order_num || 999) - (b.order_num || 999))
            .map(t => {
                const slug = normalizeSlug(t.slug || t.id);
                const title = t.name_ru || slug;
                const checked = selected.has(slug) ? 'checked' : '';
                return `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:0.875rem;cursor:pointer;"><input type="checkbox" value="${slug}" ${checked}> ${title} <span style="color:var(--text-light);font-size:0.75rem;">(${slug})</span></label>`;
            }).join('');
    }

    function syncDoctorClinicName() {
        const clinicSelect = document.getElementById('docClinicSlug');
        const clinicNameInput = document.getElementById('docClinicName');
        if (!clinicSelect || !clinicNameInput) return;

        const selectedSlug = normalizeSlug(clinicSelect.value);
        const clinic = clinicsList.find(c => normalizeSlug(c.slug) === selectedSlug);
        clinicNameInput.value = clinic ? (clinic.name_ru || clinic.name_en || clinic.slug || '') : '';
    }

    function renderDoctorClinicSelector(selectedSlug = '') {
        const clinicSelect = document.getElementById('docClinicSlug');
        if (!clinicSelect) return;

        const normalizedSelected = normalizeSlug(selectedSlug);
        const sortedClinics = [...clinicsList].sort((a, b) => (a.order_num || 999) - (b.order_num || 999));
        const options = ['<option value="">— Не выбрано —</option>']
            .concat(sortedClinics.map(c => {
                const slug = normalizeSlug(c.slug);
                const title = c.name_ru || c.name_en || slug;
                const selected = slug === normalizedSelected ? 'selected' : '';
                return `<option value="${slug}" ${selected}>${escapeHtml(title)} (${escapeHtml(slug)})</option>`;
            }));

        clinicSelect.innerHTML = options.join('');
        clinicSelect.onchange = syncDoctorClinicName;
        syncDoctorClinicName();
    }

    // --- DOCTORS ---
    async function loadDoctors() {
        try {
            const res = await fetch(`${API_BASE}/doctors?limit=100`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            doctorsList = data.data || [];
            doctorProfileStatusCache = {};
            renderDoctorsTable();
            refreshDoctorProfileStatuses();
        } catch (e) { document.getElementById('doctorsBody').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;">Нет данных. Добавьте первого врача.</td></tr>'; showToast('Ошибка загрузки врачей: ' + e.message, 'error'); }
    }

    function renderDoctorsTable() {
        const tbody = document.getElementById('doctorsBody');
        if (doctorsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:40px;">Нет врачей. Нажмите «Добавить врача».</td></tr>';
            return;
        }
        tbody.innerHTML = doctorsList.map(d => {
            const treatmentSlugs = parseCsv(d.treatment_slugs).map(normalizeSlug);
            const treatmentNames = treatmentSlugs.map(slug => {
                const found = treatmentsList.find(t => normalizeSlug(t.slug || t.id) === slug);
                return found?.name_ru || slug;
            }).slice(0, 2);
            const treatmentCell = treatmentNames.length ? `${treatmentNames.join(', ')}${treatmentSlugs.length > 2 ? ' +' + (treatmentSlugs.length - 2) : ''}` : '—';

            const isStatic = !!doctorProfileStatusCache[d.id];
            const seoBadge = isStatic
                ? '<span class="status-badge status-badge--processed">Статическая</span>'
                : '<span class="status-badge status-badge--new">Fallback template</span>';
            const staticUrl = `vrachi/${encodeURIComponent(d.id || '')}.html`;
            const fallbackUrl = `vrachi/template.html?id=${encodeURIComponent(d.id || '')}`;

            return `<tr>
                <td>${d.photo_url ? `<img src="${d.photo_url}" class="img-preview">` : '<div class="img-preview img-preview--placeholder"><i class="fas fa-user"></i></div>'}</td>
                <td><strong>${d.name_ru || '—'}</strong><br><small style="color:var(--text-light)">${d.name_en || ''}</small></td>
                <td>${d.specialty || '—'}</td>
                <td>${d.clinic_name || '—'}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${treatmentCell}</td>
                <td>${seoBadge}<div style="margin-top:4px;"><a href="${isStatic ? staticUrl : fallbackUrl}" target="_blank" style="font-size:0.72rem;">Открыть</a></div></td>
                <td>${d.online_consultation ? '<i class="fas fa-check" style="color:var(--success)"></i>' : '<i class="fas fa-times" style="color:var(--text-light)"></i>'}</td>
                <td class="actions">
                    <button class="btn btn--secondary btn--sm" onclick="publishDoctorStaticPageById('${d.id}')" title="Сформировать SEO HTML"><i class="fas fa-file-arrow-down"></i></button>
                    <button class="btn btn--secondary btn--sm" onclick="editDoctor('${d.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn--danger btn--sm" onclick="deleteDoctor('${d.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    function openDoctorForm(doctor = null) {
        document.getElementById('doctorModalTitle').textContent = doctor ? 'Редактировать врача' : 'Добавить врача';
        document.getElementById('doctorEditId').value = doctor ? doctor.id : '';
        document.getElementById('docId').value = doctor?.id || '';
        document.getElementById('docId').disabled = !!doctor; // Can't change ID of existing doctor
        document.getElementById('docActive').value = doctor?.is_active !== false ? 'true' : 'false';
        document.getElementById('docNameRu').value = doctor?.name_ru || '';
        document.getElementById('docNameEn').value = doctor?.name_en || '';
        document.getElementById('docSpecialty').value = doctor?.specialty || '';
        document.getElementById('docPosition').value = doctor?.position || '';
        renderDoctorClinicSelector(doctor?.clinic_slug || '');
        document.getElementById('docDescription').value = doctor?.description || '';
        document.getElementById('docPhotoUrl').value = doctor?.photo_url || '';
        previewDoctorPhoto(doctor?.photo_url || '');
        document.getElementById('docTags').value = doctor?.tags || '';
        document.getElementById('docLanguages').value = doctor?.languages || '';
        document.getElementById('docOnline').value = doctor?.online_consultation ? 'true' : 'false';
        document.getElementById('docOrder').value = doctor?.order_num || 0;
        renderDoctorTreatmentsSelector(doctor?.treatment_slugs || '');
        if (!clinicsList.length) loadClinics();
        document.getElementById('doctorModal').classList.add('show');
    }

    function closeDoctorModal() { document.getElementById('doctorModal').classList.remove('show'); }

    function editDoctor(id) {
        const doc = doctorsList.find(d => d.id === id);
        if (doc) openDoctorForm(doc);
    }

    async function saveDoctor() {
        const editId = document.getElementById('doctorEditId').value;
        const docId = normalizeSlug(document.getElementById('docId').value);
        const nameRu = document.getElementById('docNameRu').value.trim();
        const specialty = document.getElementById('docSpecialty').value.trim();
        const clinicSlug = normalizeSlug(document.getElementById('docClinicSlug').value);
        const selectedClinic = clinicsList.find(c => normalizeSlug(c.slug) === clinicSlug);
        const clinicName = selectedClinic ? (selectedClinic.name_ru || selectedClinic.name_en || clinicSlug) : '';
        const selectedTreatmentSlugs = getDoctorSelectedTreatmentSlugs();
        const selectedTreatmentNames = selectedTreatmentSlugs.map(slug => {
            const found = treatmentsList.find(t => normalizeSlug(t.slug || t.id) === slug);
            return found?.name_ru || slug;
        });

        if (!editId && !docId) { showToast('Укажите ID (slug) для врача', 'error'); return; }
        if (!editId && !isValidSlug(docId)) { showToast('ID должен содержать только латиницу, цифры и дефисы', 'error'); return; }
        if (!nameRu) { showToast('Укажите ФИО врача', 'error'); return; }
        if (!specialty) { showToast('Укажите специальность', 'error'); return; }

        if (!editId && doctorsList.some(d => normalizeSlug(d.id) === docId)) {
            showToast('Врач с таким ID уже существует', 'error');
            return;
        }

        if (clinicSlug && clinicsList.length > 0 && !clinicsList.some(c => normalizeSlug(c.slug) === clinicSlug)) {
            showToast('Указанная клиника (slug) не найдена в справочнике клиник', 'error');
            return;
        }

        if (selectedTreatmentSlugs.length > 0 && treatmentsList.length > 0) {
            const unknownTreatment = selectedTreatmentSlugs.find(slug => !treatmentsList.some(t => normalizeSlug(t.slug || t.id) === slug));
            if (unknownTreatment) {
                showToast('Профиль лечения не найден: ' + unknownTreatment, 'error');
                return;
            }
        }

        try {
            await tryServerValidateDoctorRelations({
                clinic_slug: clinicSlug,
                treatment_slugs: selectedTreatmentSlugs
            });
        } catch (e) {
            if (String(e.message || '').includes('404')) {
                console.warn('Server relation validation unavailable, fallback to client checks only:', e.message);
            } else {
                showToast('Ошибка проверки связей врача: ' + e.message, 'error');
                return;
            }
        }

        const payload = {
            name_ru: nameRu,
            name_en: document.getElementById('docNameEn').value.trim(),
            specialty,
            position: document.getElementById('docPosition').value.trim(),
            clinic_slug: clinicSlug,
            clinic_name: clinicName,
            description: document.getElementById('docDescription').value.trim(),
            photo_url: document.getElementById('docPhotoUrl').value.trim(),
            tags: document.getElementById('docTags').value.trim(),
            languages: document.getElementById('docLanguages').value.trim(),
            treatment_slugs: selectedTreatmentSlugs.join(','),
            treatment_names: selectedTreatmentNames.join(','),
            online_consultation: document.getElementById('docOnline').value === 'true',
            order_num: parseInt(document.getElementById('docOrder').value) || 0,
            is_active: document.getElementById('docActive').value === 'true'
        };

        if (!editId) payload.id = docId;

        try {
            let res;
            if (editId) {
                res = await fetch(`${API_BASE}/doctors/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            } else {
                res = await fetch(`${API_BASE}/doctors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            }

            if (!res.ok) throw new Error(await getErrorText(res));

            const savedDoctor = { id: editId || docId, ...payload };
            try {
                const responseBody = await res.clone().json();
                if (responseBody?.data && typeof responseBody.data === 'object') {
                    Object.assign(savedDoctor, responseBody.data);
                } else if (responseBody && typeof responseBody === 'object') {
                    Object.assign(savedDoctor, responseBody);
                }
            } catch (_) {
                // Ignore non-JSON response body
            }

            let publishMessage = '';
            try {
                await tryServerPublishDoctor(savedDoctor, false);
                doctorProfileStatusCache[savedDoctor.id] = true;
                publishMessage = `SEO-страница ${normalizeSlug(savedDoctor.id)}.html опубликована сервером.`;
            } catch (serverError) {
                console.warn('Server publish unavailable after save, fallback to local download:', serverError);
                const fileName = downloadDoctorStaticPage(savedDoctor);
                doctorProfileStatusCache[savedDoctor.id] = true;
                publishMessage = `Server publish недоступен. Файл ${fileName} сформирован локально — загрузите его в /vrachi/.`;
            }

            showToast(`Врач сохранён. ${publishMessage}`, 'success');
            closeDoctorModal();
            loadDoctors();
        } catch (e) { showToast('Ошибка сохранения врача: ' + e.message, 'error'); }
    }

    async function deleteDoctor(id) {
        if (!confirm('Удалить этого врача?')) return;
        try {
            const res = await fetch(`${API_BASE}/doctors/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await getErrorText(res));
            showToast('Врач удалён', 'success');
            loadDoctors();
        } catch (e) { showToast('Ошибка удаления: ' + e.message, 'error'); }
    }

    // --- CLINICS ---
    async function loadClinics() {
        try {
            const res = await fetch(`${API_BASE}/clinics?limit=100`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            clinicsList = data.data || [];
            renderClinicsTable();
            renderDoctorClinicSelector(document.getElementById('docClinicSlug')?.value || '');
        } catch (e) { document.getElementById('clinicsBody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">Нет данных. Добавьте первую клинику.</td></tr>'; showToast('Ошибка загрузки клиник: ' + e.message, 'error'); }
    }

    function renderClinicsTable() {
        const tbody = document.getElementById('clinicsBody');
        if (clinicsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:40px;">Нет клиник. Нажмите «Добавить клинику».</td></tr>';
            return;
        }
        tbody.innerHTML = clinicsList.map(c => `<tr>
            <td><i class="${c.icon || 'fas fa-hospital'}" style="font-size:1.2rem;color:var(--secondary);"></i></td>
            <td><strong>${c.name_ru || '—'}</strong><br><small style="color:var(--text-light)">${c.name_en || ''}</small></td>
            <td>${c.city || '—'}</td>
            <td><span class="status-badge ${c.type === 'частная' ? 'status-badge--processed' : 'status-badge--new'}">${c.type || '—'}</span></td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">${c.specialties || '—'}</td>
            <td class="actions">
                <button class="btn btn--secondary btn--sm" onclick="editClinic('${c.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn--danger btn--sm" onclick="deleteClinic('${c.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`).join('');
    }

    function openClinicForm(clinic = null) {
        document.getElementById('clinicModalTitle').textContent = clinic ? 'Редактировать клинику' : 'Добавить клинику';
        document.getElementById('clinicEditId').value = clinic ? clinic.id : '';
        document.getElementById('clinicNameRu').value = clinic?.name_ru || '';
        document.getElementById('clinicNameEn').value = clinic?.name_en || '';
        document.getElementById('clinicSlug').value = clinic?.slug || '';
        document.getElementById('clinicCity').value = clinic?.city || '';
        document.getElementById('clinicType').value = clinic?.type || 'государственная';
        document.getElementById('clinicIcon').value = clinic?.icon || '';
        document.getElementById('clinicShortDesc').value = clinic?.short_description || '';
        document.getElementById('clinicDescription').value = clinic?.description || '';
        document.getElementById('clinicSpecialties').value = clinic?.specialties || '';
        document.getElementById('clinicBeds').value = clinic?.beds || '';
        document.getElementById('clinicDepartments').value = clinic?.departments || '';
        document.getElementById('clinicImageUrl').value = clinic?.image_url || '';
        document.getElementById('clinicOrder').value = clinic?.order_num || 0;
        document.getElementById('clinicModal').classList.add('show');
    }

    function closeClinicModal() { document.getElementById('clinicModal').classList.remove('show'); }

    function editClinic(id) {
        const clinic = clinicsList.find(c => c.id === id);
        if (clinic) openClinicForm(clinic);
    }

    async function saveClinic() {
        const editId = document.getElementById('clinicEditId').value;
        const slug = normalizeSlug(document.getElementById('clinicSlug').value);
        const nameRu = document.getElementById('clinicNameRu').value.trim();

        if (!nameRu) { showToast('Укажите название клиники', 'error'); return; }
        if (!slug) { showToast('Укажите URL slug клиники', 'error'); return; }
        if (!isValidSlug(slug)) { showToast('Slug клиники должен содержать только латиницу, цифры и дефисы', 'error'); return; }

        const duplicateSlug = clinicsList.some(c => normalizeSlug(c.slug) === slug && c.id !== editId);
        if (duplicateSlug) { showToast('Клиника с таким slug уже существует', 'error'); return; }

        const payload = {
            name_ru: nameRu,
            name_en: document.getElementById('clinicNameEn').value.trim(),
            slug,
            city: document.getElementById('clinicCity').value.trim(),
            type: document.getElementById('clinicType').value,
            icon: document.getElementById('clinicIcon').value.trim(),
            short_description: document.getElementById('clinicShortDesc').value.trim(),
            description: document.getElementById('clinicDescription').value.trim(),
            specialties: document.getElementById('clinicSpecialties').value.trim(),
            beds: document.getElementById('clinicBeds').value.trim(),
            departments: document.getElementById('clinicDepartments').value.trim(),
            image_url: document.getElementById('clinicImageUrl').value.trim(),
            order_num: parseInt(document.getElementById('clinicOrder').value) || 0,
            is_active: true
        };
        try {
            let res;
            if (editId) {
                res = await fetch(`${API_BASE}/clinics/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            } else {
                res = await fetch(`${API_BASE}/clinics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            }
            if (!res.ok) throw new Error(await getErrorText(res));
            showToast('Клиника сохранена!', 'success');
            closeClinicModal();
            loadClinics();
        } catch (e) { showToast('Ошибка сохранения клиники: ' + e.message, 'error'); }
    }

    async function deleteClinic(id) {
        if (!confirm('Удалить эту клинику?')) return;
        try {
            try {
                await tryServerDeleteClinic(id);
                showToast('Клиника удалена (server-guarded)', 'success');
                await Promise.all([loadClinics(), loadDoctors()]);
                return;
            } catch (serverError) {
                if (!String(serverError.message || '').includes('404')) {
                    throw serverError;
                }
                console.warn('Server guarded clinic delete unavailable, fallback to client checks:', serverError.message);
            }

            const clinic = clinicsList.find(c => c.id === id);
            const clinicSlug = normalizeSlug(clinic?.slug);
            const linkedDoctors = doctorsList.filter(d => normalizeSlug(d.clinic_slug) === clinicSlug);
            if (linkedDoctors.length > 0) {
                showToast(`Удаление запрещено: клиника связана с ${linkedDoctors.length} врач(ами)`, 'error');
                return;
            }

            const res = await fetch(`${API_BASE}/clinics/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await getErrorText(res));
            showToast('Клиника удалена', 'success');
            await Promise.all([loadClinics(), loadDoctors()]);
        } catch (e) { showToast('Ошибка удаления: ' + e.message, 'error'); }
    }

    // --- TREATMENTS ---
    async function loadTreatments() {
        try {
            const res = await fetch(`${API_BASE}/treatments?limit=200`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            treatmentsList = data.data || [];
            renderTreatmentsTable();
            renderDoctorTreatmentsSelector(document.getElementById('doctorEditId')?.value ? (doctorsList.find(d => d.id === document.getElementById('doctorEditId').value)?.treatment_slugs || '') : '');
            renderDoctorsTable();
        } catch (e) {
            treatmentsList = [];
            const tbody = document.getElementById('treatmentsBody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:40px;">Не удалось загрузить профили лечения (${e.message}). Проверьте наличие таблицы treatments.</td></tr>`;
            }
        }
    }

    function renderTreatmentsTable() {
        const tbody = document.getElementById('treatmentsBody');
        if (!tbody) return;
        if (treatmentsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:40px;">Нет профилей лечения. Нажмите «Добавить профиль лечения».</td></tr>';
            return;
        }

        tbody.innerHTML = treatmentsList
            .sort((a, b) => (a.order_num || 999) - (b.order_num || 999))
            .map(t => `<tr>
                <td>${t.slug || t.id || '—'}</td>
                <td><strong>${t.name_ru || '—'}</strong><br><small style="color:var(--text-light)">${t.name_en || ''}</small></td>
                <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;">${t.tags || '—'}</td>
                <td>${t.is_active !== false ? '<i class="fas fa-check" style="color:var(--success)"></i>' : '<i class="fas fa-times" style="color:var(--text-light)"></i>'}</td>
                <td class="actions">
                    <button class="btn btn--secondary btn--sm" onclick="editTreatment('${t.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn btn--danger btn--sm" onclick="deleteTreatment('${t.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`).join('');
    }

    function openTreatmentForm(treatment = null) {
        document.getElementById('treatmentModalTitle').textContent = treatment ? 'Редактировать профиль лечения' : 'Добавить профиль лечения';
        document.getElementById('treatmentEditId').value = treatment?.id || '';
        document.getElementById('treatmentSlug').value = treatment?.slug || treatment?.id || '';
        document.getElementById('treatmentSlug').disabled = !!treatment;
        document.getElementById('treatmentActive').value = treatment?.is_active !== false ? 'true' : 'false';
        document.getElementById('treatmentNameRu').value = treatment?.name_ru || '';
        document.getElementById('treatmentNameEn').value = treatment?.name_en || '';
        document.getElementById('treatmentShortDesc').value = treatment?.short_description || '';
        document.getElementById('treatmentDescription').value = treatment?.description || '';
        document.getElementById('treatmentTags').value = treatment?.tags || '';
        document.getElementById('treatmentOrder').value = treatment?.order_num || 0;
        document.getElementById('treatmentModal').classList.add('show');
    }

    function closeTreatmentModal() {
        document.getElementById('treatmentModal').classList.remove('show');
    }

    function editTreatment(id) {
        const treatment = treatmentsList.find(t => t.id === id);
        if (treatment) openTreatmentForm(treatment);
    }

    async function saveTreatment() {
        const editId = document.getElementById('treatmentEditId').value;
        const slug = normalizeSlug(document.getElementById('treatmentSlug').value);
        const nameRu = document.getElementById('treatmentNameRu').value.trim();

        if (!slug) { showToast('Укажите slug профиля лечения', 'error'); return; }
        if (!isValidSlug(slug)) { showToast('Slug профиля лечения должен содержать только латиницу, цифры и дефисы', 'error'); return; }
        if (!nameRu) { showToast('Укажите название профиля лечения', 'error'); return; }

        const duplicate = treatmentsList.some(t => normalizeSlug(t.slug || t.id) === slug && t.id !== editId);
        if (duplicate) { showToast('Профиль лечения с таким slug уже существует', 'error'); return; }

        const payload = {
            slug,
            name_ru: nameRu,
            name_en: document.getElementById('treatmentNameEn').value.trim(),
            short_description: document.getElementById('treatmentShortDesc').value.trim(),
            description: document.getElementById('treatmentDescription').value.trim(),
            tags: document.getElementById('treatmentTags').value.trim(),
            order_num: parseInt(document.getElementById('treatmentOrder').value) || 0,
            is_active: document.getElementById('treatmentActive').value === 'true'
        };

        if (!editId) payload.id = slug;

        try {
            let res;
            if (editId) {
                res = await fetch(`${API_BASE}/treatments/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            } else {
                res = await fetch(`${API_BASE}/treatments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            }
            if (!res.ok) throw new Error(await getErrorText(res));

            showToast('Профиль лечения сохранён!', 'success');
            closeTreatmentModal();
            loadTreatments();
        } catch (e) {
            showToast('Ошибка сохранения профиля лечения: ' + e.message, 'error');
        }
    }

    async function deleteTreatment(id) {
        if (!confirm('Удалить этот профиль лечения?')) return;
        try {
            try {
                await tryServerDeleteTreatment(id);
                showToast('Профиль лечения удалён (server-guarded)', 'success');
                await Promise.all([loadTreatments(), loadDoctors()]);
                return;
            } catch (serverError) {
                if (!String(serverError.message || '').includes('404')) {
                    throw serverError;
                }
                console.warn('Server guarded treatment delete unavailable, fallback to client checks:', serverError.message);
            }

            const treatment = treatmentsList.find(t => t.id === id);
            const treatmentSlug = normalizeSlug(treatment?.slug || treatment?.id || id);
            const linkedDoctors = doctorsList.filter(d => parseCsv(d.treatment_slugs).map(normalizeSlug).includes(treatmentSlug));
            if (linkedDoctors.length > 0) {
                showToast(`Удаление запрещено: профиль лечения связан с ${linkedDoctors.length} врач(ами)`, 'error');
                return;
            }

            const res = await fetch(`${API_BASE}/treatments/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await getErrorText(res));
            showToast('Профиль лечения удалён', 'success');
            await Promise.all([loadTreatments(), loadDoctors()]);
        } catch (e) {
            showToast('Ошибка удаления профиля лечения: ' + e.message, 'error');
        }
    }

    // --- SETTINGS ---
    async function loadSettings() {
        try {
            const res = await fetch(`${API_BASE}/site_settings?limit=100`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            settings = {};
            (data.data || []).forEach(s => { settings[s.key] = s; });
            document.getElementById('settingBotToken').value = settings['telegram_bot_token']?.value || '';
            document.getElementById('settingChatId').value = settings['telegram_chat_id']?.value || '';
            document.getElementById('settingPhone').value = settings['company_phone']?.value || '';
            document.getElementById('settingEmail').value = settings['company_email']?.value || '';
            const siteBaseInput = document.getElementById('settingSiteBaseUrl');
            if (siteBaseInput) siteBaseInput.value = settings['site_base_url']?.value || '';
        } catch (e) { showToast('Ошибка загрузки настроек: ' + e.message, 'error'); }
    }

    async function saveSettings() {
        const siteBaseInput = document.getElementById('settingSiteBaseUrl');
        const updates = [
            { key: 'telegram_bot_token', value: document.getElementById('settingBotToken').value },
            { key: 'telegram_chat_id', value: document.getElementById('settingChatId').value },
            { key: 'company_phone', value: document.getElementById('settingPhone').value },
            { key: 'company_email', value: document.getElementById('settingEmail').value },
            { key: 'site_base_url', value: siteBaseInput ? siteBaseInput.value.trim() : '' }
        ];
        const newPwd = document.getElementById('settingPassword').value;
        if (newPwd) updates.push({ key: 'admin_password', value: newPwd });
        try {
            for (const upd of updates) {
                const record = settings[upd.key];
                let res;
                if (record) {
                    res = await fetch(`${API_BASE}/site_settings/${record.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: upd.value }) });
                } else {
                    // Create new setting if it doesn't exist
                    res = await fetch(`${API_BASE}/site_settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: upd.key, value: upd.value, description: upd.key }) });
                }
                if (!res.ok) throw new Error(await getErrorText(res));
            }
            showToast('Настройки сохранены!', 'success');
            document.getElementById('settingPassword').value = '';
            if (newPwd) currentPassword = newPwd;
            loadSettings(); // Reload to update local cache
        } catch (e) { showToast('Ошибка сохранения настроек: ' + e.message, 'error'); }
    }

    // --- SUBMISSIONS ---
    async function loadSubmissions() {
        try {
            const res = await fetch(`${API_BASE}/form_submissions?limit=100&sort=-created_at`);
            if (!res.ok) throw new Error(await getErrorText(res));
            const data = await res.json();
            renderSubmissions(data.data || []);
        } catch (e) { document.getElementById('submissionsBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:40px;">Ошибка загрузки</td></tr>'; showToast('Ошибка загрузки заявок: ' + e.message, 'error'); }
    }

    function renderSubmissions(submissions) {
        const tbody = document.getElementById('submissionsBody');
        if (submissions.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:40px;">Заявок пока нет</td></tr>'; return; }
        const typeLabels = { consultation: 'Консультация', second_opinion: 'Второе мнение', callback: 'Обратный звонок' };
        tbody.innerHTML = submissions.map(s => {
            const date = s.created_at ? new Date(s.created_at).toLocaleString('ru-RU') : '—';
            const statusClass = s.status === 'new' ? 'new' : s.status === 'processed' ? 'processed' : 'closed';
            const statusText = s.status === 'new' ? 'Новая' : s.status === 'processed' ? 'Обработана' : 'Закрыта';
            return `<tr>
                <td>${date}</td>
                <td>${typeLabels[s.form_type] || s.form_type || '—'}</td>
                <td>${s.name || '—'}</td>
                <td>${s.phone || '—'}</td>
                <td>${s.email || '—'}</td>
                <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;">${s.page_url || '—'}</td>
                <td>${s.utm_source || '—'}</td>
                <td><span class="status-badge status-badge--${statusClass}">${statusText}</span></td>
            </tr>`;
        }).join('');
    }

    // --- TOAST ---
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast toast--' + type + ' show';
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }

    // --- PHOTO PREVIEW ---
    function previewDoctorPhoto(url) {
        const preview = document.getElementById('docPhotoPreview');
        if (!preview) return;
        if (url && url.startsWith('http')) {
            preview.innerHTML = `<img src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border);" onerror="this.parentElement.innerHTML='<span style=\\'color:var(--danger);font-size:0.75rem;\\'>Ошибка загрузки изображения</span>'">`;
        } else {
            preview.innerHTML = '';
        }
    }

    // --- INIT PAGE_CONTENT FOR NAPRAVLENIYA ---
    // Ensures napravleniya pages exist in page_content table for admin editing
    async function ensureNapravleniyaPages() {
        const napravleniyaSlugs = [
            'napravleniya-allergologiya', 'napravleniya-gastroenterologiya',
            'napravleniya-gematologiya', 'napravleniya-genetika',
            'napravleniya-ginekologiya', 'napravleniya-geriatriya',
            'napravleniya-kardiologiya', 'napravleniya-nevrologiya',
            'napravleniya-ortopediya', 'napravleniya-urologiya'
        ];
        const existingSlugs = pages.map(p => p.page_slug);
        for (const slug of napravleniyaSlugs) {
            if (!existingSlugs.includes(slug)) {
                const title = PAGE_NAMES[slug] || slug;
                try {
                    await fetch(`${API_BASE}/page_content`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            page_slug: slug,
                            meta_title: title + ' в Израиле | Taurus Medical Experts',
                            meta_description: '',
                            h1: title,
                            hero_text: ''
                        })
                    });
                } catch(e) { /* skip */ }
            }
        }
        // Reload pages to show newly created ones
        await loadPages();
    }
