/* ===== TAURUS MEDICAL — DOCTOR PROFILE ENHANCER =====
 * Hybrid approach: static HTML pages provide SEO content,
 * this script overlays fresh data from the API (photo, description, tags, etc.)
 * Usage: Add <script src="../js/doctor-profile.js" data-doctor-id="stefanski"></script>
 * on any static doctor profile page.
 */
(function() {
    'use strict';

    const script = document.querySelector('script[data-doctor-id]');
    if (!script) return;

    const doctorId = script.dataset.doctorId;
    if (!doctorId) return;

    const API_BASE = '../tables';

    document.addEventListener('DOMContentLoaded', async function() {
        try {
            const resp = await fetch(`${API_BASE}/doctors/${doctorId}`);
            if (!resp.ok) return; // Silently fail — static content remains
            const d = await resp.json();
            applyDoctorData(d);
        } catch (e) {
            // API unavailable — static content stays intact
            console.log('Doctor profile API unavailable, using static content');
        }
    });

    function applyDoctorData(d) {
        // === Photo ===
        const photoEl = document.querySelector('.doctor-profile__photo');
        if (photoEl && d.photo_url) {
            photoEl.innerHTML = `<img src="${d.photo_url}" alt="${d.name_ru}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user-doctor\\'></i>'">`;
        }

        // === Name ===
        const nameEl = document.querySelector('.doctor-profile__name');
        if (nameEl && d.name_ru) {
            nameEl.textContent = d.name_ru;
        }

        // === Specialty ===
        const specEl = document.querySelector('.doctor-profile__spec');
        if (specEl && d.specialty) {
            specEl.textContent = d.specialty;
        }

        // === Position ===
        const posEl = document.querySelector('.doctor-profile__position');
        if (posEl && d.position) {
            posEl.textContent = d.position;
        }

        // === Clinic ===
        const clinicNameEl = document.querySelector('.doctor-profile__clinic span');
        if (clinicNameEl && d.clinic_name) {
            clinicNameEl.textContent = d.clinic_name;
        }

        // === Description ===
        const descEl = document.querySelector('.doctor-profile__desc');
        if (descEl && d.description) {
            // Support line breaks in description
            const paragraphs = d.description.split('\n').filter(p => p.trim());
            if (paragraphs.length > 0) {
                descEl.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');
            }
        }

        // === Languages / Badges ===
        const badgesEl = document.querySelector('.doctor-profile__badges');
        if (badgesEl && d.languages) {
            let badgesHTML = '';
            if (d.online_consultation) {
                badgesHTML += `<span class="doctor-profile__badge doctor-profile__badge--online"><i class="fas fa-video"></i> Онлайн-консультация</span>`;
            }
            d.languages.split(',').forEach(lang => {
                const l = lang.trim();
                if (l) {
                    badgesHTML += `<span class="doctor-profile__badge doctor-profile__badge--lang"><i class="fas fa-globe"></i> ${l}</span>`;
                }
            });
            if (badgesHTML) badgesEl.innerHTML = badgesHTML;
        }

        // === Tags ===
        const tagsEl = document.querySelector('.doctor-profile__tags');
        if (tagsEl && d.tags) {
            const tags = d.tags.split(',').map(t => t.trim()).filter(t => t);
            if (tags.length > 0) {
                tagsEl.innerHTML = tags.map(tag => 
                    `<span class="doctor-profile__tag">${tag}</span>`
                ).join('');
            }
        }

        // === Page title ===
        if (d.name_ru && d.specialty) {
            document.title = `${d.name_ru} — ${d.specialty} | Taurus Medical Experts`;
        }

        // === Meta description ===
        if (d.name_ru) {
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc && d.description) {
                const shortDesc = d.description.replace(/\n/g, ' ').substring(0, 160);
                metaDesc.setAttribute('content', `${d.name_ru} — ${d.specialty}. ${shortDesc}`);
            }
        }

        // === Breadcrumb ===
        const breadcrumbName = document.querySelector('.page-hero__breadcrumb');
        if (breadcrumbName && d.name_ru) {
            const spans = breadcrumbName.querySelectorAll('span:last-child');
            if (spans.length > 0) {
                spans[spans.length - 1].textContent = d.name_ru;
            }
        }

        // === H1 ===
        const h1 = document.querySelector('.page-hero__title');
        if (h1 && d.name_ru) {
            h1.textContent = d.name_ru;
        }

        // === CTA section title ===
        const ctaTitle = document.querySelector('.cta-section__title');
        if (ctaTitle && d.name_ru) {
            ctaTitle.textContent = `Записаться к ${d.name_ru}`;
        }
    }
})();
