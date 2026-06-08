/* ===== TAURUS MEDICAL — DOCTORS LOADER =====
 * Loads doctor cards dynamically from API for specialty (napravleniya) pages.
 * Usage: Add <script src="../js/doctors-loader.js" data-specialty="Онкология,Иммунотерапия"></script>
 * Requires: #doctorsGrid container on the page, ../css/doctors-grid.css for styles.
 */
document.addEventListener('DOMContentLoaded', async function() {
    const script = document.querySelector('script[data-specialty]');
    if (!script) return;
    
    const specialties = script.dataset.specialty.split(',').map(s => s.trim().toLowerCase());
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    try {
        const resp = await fetch('../tables/doctors?limit=100');
        const data = await resp.json();
        const doctors = (data.data || []).filter(d => {
            if (!d.is_active) return false;
            const docSpecs = (d.specialty || '').toLowerCase();
            const docTags = (d.tags || '').toLowerCase();
            return specialties.some(s => docSpecs.includes(s) || docTags.includes(s));
        });

        doctors.sort((a, b) => (a.order_num || 99) - (b.order_num || 99));

        if (doctors.length === 0) {
            grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Информация о специалистах обновляется. Свяжитесь с нами для подбора врача.</p>';
            return;
        }

        grid.innerHTML = doctors.map(d => renderDoctorCard(d)).join('');
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Не удалось загрузить список врачей. Попробуйте позже.</p>';
    }
});

function renderDoctorCard(d) {
    const avatar = d.photo_url 
        ? `<img src="${d.photo_url}" alt="${d.name_ru}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user-doctor\\'></i>'">` 
        : `<i class="fas fa-user-doctor"></i>`;
    
    const tags = (d.tags || '').split(',').slice(0, 4).map(t => 
        `<span class="doctor-card__tag">${t.trim()}</span>`
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
                <div class="doctor-card__name"><a href="../vrachi/${d.id}.html">${d.name_ru}</a></div>
                <div class="doctor-card__spec">${d.specialty}</div>
                <div class="doctor-card__position">${d.position}</div>
            </div>
        </div>
        <div class="doctor-card__clinic"><i class="fas fa-hospital"></i> ${d.clinic_name}</div>
        <p class="doctor-card__desc">${d.description || ''}</p>
        <div class="doctor-card__tags">
            ${tags}${onlineTag}${langBadge}
        </div>
        <a href="../kontakty.html" class="doctor-card__btn"><i class="fas fa-calendar-check"></i> Записаться на консультацию</a>
    </div>`;
}
