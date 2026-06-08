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

    function safePhotoUrl(url) {
        const value = String(url || '').trim();
        return /^https?:\/\//i.test(value) ? value : '';
    }

    function createBadge(className, iconClass, text) {
        const badge = document.createElement('span');
        badge.className = className;
        const icon = document.createElement('i');
        icon.className = `fas ${iconClass}`;
        badge.appendChild(icon);
        badge.appendChild(document.createTextNode(` ${text}`));
        return badge;
    }

    function applyDoctorData(d) {
        // === Photo ===
        const photoEl = document.querySelector('.doctor-profile__photo');
        const photoUrl = safePhotoUrl(d.photo_url);
        if (photoEl && photoUrl) {
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = d.name_ru || 'doctor';
            photoEl.replaceChildren(img);
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
            const paragraphs = String(d.description).split('\n').map(p => p.trim()).filter(Boolean);
            if (paragraphs.length > 0) {
                descEl.replaceChildren(...paragraphs.map(text => {
                    const p = document.createElement('p');
                    p.textContent = text;
                    return p;
                }));
            }
        }

        // === Languages / Badges ===
        const badgesEl = document.querySelector('.doctor-profile__badges');
        if (badgesEl) {
            const badges = [];
            if (d.online_consultation) {
                badges.push(createBadge('doctor-profile__badge doctor-profile__badge--online', 'fa-video', 'Онлайн-консультация'));
            }
            if (d.languages) {
                d.languages.split(',').map(l => l.trim()).filter(Boolean).forEach(lang => {
                    badges.push(createBadge('doctor-profile__badge doctor-profile__badge--lang', 'fa-globe', lang));
                });
            }
            if (badges.length > 0) {
                badgesEl.replaceChildren(...badges);
            }
        }

        // === Tags ===
        const tagsEl = document.querySelector('.doctor-profile__tags');
        if (tagsEl && d.tags) {
            const tagNodes = d.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => {
                const span = document.createElement('span');
                span.className = 'doctor-profile__tag';
                span.textContent = tag;
                return span;
            });
            if (tagNodes.length > 0) {
                tagsEl.replaceChildren(...tagNodes);
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
