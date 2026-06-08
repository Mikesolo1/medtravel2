/* ===== TAURUS MEDICAL — DOCTORS LOADER =====
 * Loads doctor cards dynamically from API for specialty (napravleniya) pages.
 * Usage: Add <script src="../js/doctors-loader.js" data-specialty="Онкология,Иммунотерапия"></script>
 * Requires: #doctorsGrid container on the page, ../css/doctors-grid.css for styles.
 */
document.addEventListener('DOMContentLoaded', async function() {
    const script = document.querySelector('script[data-specialty]');
    if (!script) return;
    
    const specialties = (script.dataset.specialty || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const treatmentKeywords = (script.dataset.treatment || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    try {
        const resp = await fetch('../tables/doctors?limit=100');
        const data = await resp.json();
        const doctors = (data.data || []).filter(d => {
            if (!d.is_active) return false;
            const docSpecs = (d.specialty || '').toLowerCase();
            const docTags = (d.tags || '').toLowerCase();
            const docTreatments = `${d.treatment_slugs || ''},${d.treatment_names || ''},${docTags}`.toLowerCase();

            const specialtyMatched = specialties.length === 0 || specialties.some(s => docSpecs.includes(s) || docTags.includes(s));
            const treatmentMatched = treatmentKeywords.length === 0 || treatmentKeywords.some(t => docTreatments.includes(t));

            return specialtyMatched && treatmentMatched;
        });

        doctors.sort((a, b) => (a.order_num || 99) - (b.order_num || 99));

        if (doctors.length === 0) {
            grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Информация о специалистах обновляется. Свяжитесь с нами для подбора врача.</p>';
            return;
        }

        grid.innerHTML = doctors.map(d => renderDoctorCard(d)).join('');
        upgradeDoctorProfileLinks(grid, '../');
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Не удалось загрузить список врачей. Попробуйте позже.</p>';
    }
});

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safePhotoUrl(url) {
    const value = String(url || '').trim();
    return /^https?:\/\//i.test(value) ? value : '';
}

function getDoctorProfileFallbackUrl(d) {
    return `../vrachi/template.html?id=${encodeURIComponent(d.id || '')}`;
}

function renderDoctorCard(d) {
    const photoUrl = safePhotoUrl(d.photo_url);
    const avatar = photoUrl
        ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(d.name_ru)}">`
        : `<i class="fas fa-user-doctor"></i>`;

    const tags = (d.tags || '').split(',').slice(0, 4).map(t =>
        `<span class="doctor-card__tag">${escapeHtml(t.trim())}</span>`
    ).join('');

    const onlineTag = d.online_consultation
        ? `<span class="doctor-card__tag doctor-card__tag--accent">Онлайн-консультация</span>`
        : '';

    const langBadge = (d.languages || '').toLowerCase().includes('русский')
        ? `<span class="doctor-card__tag doctor-card__tag--accent">Русский язык</span>`
        : '';

    return `
    <div class="doctor-card">
        <div class="doctor-card__header">
            <div class="doctor-card__avatar">${avatar}</div>
            <div class="doctor-card__info">
                <div class="doctor-card__name"><a class="js-doctor-profile-link" data-doctor-id="${escapeHtml(d.id || '')}" data-base="../" href="${getDoctorProfileFallbackUrl(d)}">${escapeHtml(d.name_ru)}</a></div>
                <div class="doctor-card__spec">${escapeHtml(d.specialty)}</div>
                <div class="doctor-card__position">${escapeHtml(d.position)}</div>
            </div>
        </div>
        <div class="doctor-card__clinic"><i class="fas fa-hospital"></i> ${escapeHtml(d.clinic_name)}</div>
        <p class="doctor-card__desc">${escapeHtml(d.description || '')}</p>
        <div class="doctor-card__tags">
            ${tags}${onlineTag}${langBadge}
        </div>
        <a href="../kontakty.html" class="doctor-card__btn"><i class="fas fa-calendar-check"></i> Записаться на консультацию</a>
    </div>`;
}

async function upgradeDoctorProfileLinks(container, base) {
    const links = container.querySelectorAll('.js-doctor-profile-link[data-doctor-id]');
    const cache = {};

    for (const link of links) {
        const doctorId = link.dataset.doctorId;
        if (!doctorId) continue;

        if (cache[doctorId] === undefined) {
            cache[doctorId] = await staticProfileExists(`${base}vrachi/${doctorId}.html`);
        }

        if (cache[doctorId]) {
            link.href = `${base}vrachi/${doctorId}.html`;
        }
    }
}

async function staticProfileExists(url) {
    try {
        const headResp = await fetch(url, { method: 'HEAD' });
        if (headResp.ok) return true;
        if (headResp.status !== 405) return false;

        const getResp = await fetch(url, { method: 'GET' });
        return getResp.ok;
    } catch (e) {
        return false;
    }
}
