/* ===== TAURUS MEDICAL — DOCTORS LOADER (INLINE/ROOT) =====
 * Loads doctor cards dynamically from API for pages at root level (e.g., onkologiya.html)
 * and for clinic pages (kliniki/*.html).
 * Usage: <script src="js/doctors-loader-inline.js" data-specialty="Онкология,Рак" data-base=""></script>
 *    or: <script src="../js/doctors-loader-inline.js" data-clinic="ikhilov" data-base="../"></script>
 * Requires: #doctorsGrid container on the page, css/doctors-grid.css for styles.
 */
(function() {
    'use strict';

    function findScript() {
        // Find our script tag by matching src attribute
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
            var src = all[i].getAttribute('src') || '';
            if (src.indexOf('doctors-loader-inline') !== -1) {
                return all[i];
            }
        }
        return null;
    }

    async function loadDoctors() {
        var script = findScript();
        if (!script) return;

        var grid = document.getElementById('doctorsGrid');
        if (!grid) return;

        // Read attributes
        var base = script.getAttribute('data-base') || '';
        var clinicSlug = (script.getAttribute('data-clinic') || '').trim();
        var specialtiesRaw = (script.getAttribute('data-specialty') || '').trim();
        var specialties = specialtiesRaw ? specialtiesRaw.split(',').map(function(s) { return s.trim().toLowerCase(); }) : [];
        var treatmentRaw = (script.getAttribute('data-treatment') || '').trim();
        var treatmentKeywords = treatmentRaw ? treatmentRaw.split(',').map(function(s) { return s.trim().toLowerCase(); }) : [];

        try {
            var resp = await fetch(base + 'tables/doctors?limit=100');
            var data = await resp.json();
            var doctors = (data.data || []).filter(function(d) { return d.is_active; });

            // Filter by clinic_slug (partial match: "ikhilov" matches "ikhilov-sourasky")
            if (clinicSlug) {
                var filter = clinicSlug.toLowerCase();
                doctors = doctors.filter(function(d) {
                    var slug = (d.clinic_slug || '').toLowerCase();
                    return slug === filter || slug.indexOf(filter) !== -1;
                });
            }

            // Filter by specialty keywords
            if (specialties.length > 0) {
                doctors = doctors.filter(function(d) {
                    var docSpecs = (d.specialty || '').toLowerCase();
                    var docTags = (d.tags || '').toLowerCase();
                    return specialties.some(function(s) {
                        return docSpecs.indexOf(s) !== -1 || docTags.indexOf(s) !== -1;
                    });
                });
            }

            // Filter by treatment profile keywords/slugs
            if (treatmentKeywords.length > 0) {
                doctors = doctors.filter(function(d) {
                    var blob = ((d.treatment_slugs || '') + ',' + (d.treatment_names || '') + ',' + (d.tags || '')).toLowerCase();
                    return treatmentKeywords.some(function(t) {
                        return blob.indexOf(t) !== -1;
                    });
                });
            }

            doctors.sort(function(a, b) { return (a.order_num || 99) - (b.order_num || 99); });

            if (doctors.length === 0) {
                grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Информация о специалистах обновляется. Свяжитесь с нами для подбора врача.</p>';
                return;
            }

            grid.innerHTML = doctors.map(function(d) { return renderCard(d, base); }).join('');
            upgradeDoctorProfileLinks(grid, base);
        } catch (e) {
            grid.innerHTML = '<p style="color:var(--color-text-light);font-size:0.9rem;">Не удалось загрузить список врачей. Попробуйте позже.</p>';
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safePhotoUrl(url) {
        var value = String(url || '').trim();
        return /^https?:\/\//i.test(value) ? value : '';
    }

    function getDoctorProfileFallbackUrl(d, base) {
        return base + 'vrachi/template.html?id=' + encodeURIComponent(d.id || '');
    }

    // Маппинг slug направления -> ключ фильтра на vrachi.html (data-filter)
    var SPECIALTY_FILTER_MAP = {
        'allergologiya': 'allergy',
        'gastroenterologiya': 'gastro',
        'gematologiya': 'hematology',
        'genetika': 'genetics',
        'geriatriya': 'geriatrics',
        'ginekologiya': 'gynecology',
        'kardiologiya': 'cardiology',
        'nevrologiya': 'neurology',
        'ortopediya': 'orthopedics',
        'urologiya': 'urology',
        'onkologiya': 'oncology'
    };

    function getFilterKey(d) {
        var slugs = (d.treatment_slugs || '').split(',');
        for (var i = 0; i < slugs.length; i++) {
            var key = SPECIALTY_FILTER_MAP[slugs[i].trim().toLowerCase()];
            if (key) return key;
        }
        return '';
    }

    function renderCard(d, base) {
        var photoUrl = safePhotoUrl(d.photo_url);
        var avatar = photoUrl
            ? '<img src="' + escapeHtml(photoUrl) + '" alt="' + escapeHtml(d.name_ru || '') + '">'
            : '<i class="fas fa-user-doctor"></i>';

        var tagsArr = (d.tags || '').split(',').slice(0, 4);
        var tags = tagsArr.map(function(t) {
            return '<span class="doctor-card__tag">' + escapeHtml(t.trim()) + '</span>';
        }).join('');

        var onlineTag = d.online_consultation
            ? '<span class="doctor-card__tag doctor-card__tag--accent">Онлайн-консультация</span>'
            : '';

        var langBadge = (d.languages || '').toLowerCase().indexOf('русский') !== -1
            ? '<span class="doctor-card__tag doctor-card__tag--accent">Русский язык</span>'
            : '';

        return '<div class="doctor-card" data-specialty="' + escapeHtml(getFilterKey(d)) + '">' +
            '<div class="doctor-card__header">' +
                '<div class="doctor-card__avatar">' + avatar + '</div>' +
                '<div class="doctor-card__info">' +
                    '<div class="doctor-card__name"><a class="js-doctor-profile-link" data-doctor-id="' + escapeHtml(d.id || '') + '" data-base="' + escapeHtml(base) + '" href="' + getDoctorProfileFallbackUrl(d, base) + '">' + escapeHtml(d.name_ru || '') + '</a></div>' +
                    '<div class="doctor-card__spec">' + escapeHtml(d.specialty || '') + '</div>' +
                    '<div class="doctor-card__position">' + escapeHtml(d.position || '') + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="doctor-card__clinic"><i class="fas fa-hospital"></i> ' + escapeHtml(d.clinic_name || '') + '</div>' +
            '<p class="doctor-card__desc">' + escapeHtml(d.description || '') + '</p>' +
            '<div class="doctor-card__tags">' + tags + onlineTag + langBadge + '</div>' +
            '<a href="' + base + 'kontakty.html" class="doctor-card__btn"><i class="fas fa-calendar-check"></i> Записаться на консультацию</a>' +
        '</div>';
    }

    async function upgradeDoctorProfileLinks(container, base) {
        var links = container.querySelectorAll('.js-doctor-profile-link[data-doctor-id]');
        var cache = {};

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var doctorId = link.getAttribute('data-doctor-id');
            if (!doctorId) continue;

            if (typeof cache[doctorId] === 'undefined') {
                cache[doctorId] = await staticProfileExists(base + 'vrachi/' + doctorId + '.html');
            }

            if (cache[doctorId]) {
                link.href = base + 'vrachi/' + doctorId + '.html';
            }
        }
    }

    async function staticProfileExists(url) {
        try {
            var headResp = await fetch(url, { method: 'HEAD' });
            if (headResp.ok) return true;
            if (headResp.status !== 405) return false;

            var getResp = await fetch(url, { method: 'GET' });
            return getResp.ok;
        } catch (e) {
            return false;
        }
    }

    // Execute: if DOM is ready, run immediately; otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDoctors);
    } else {
        loadDoctors();
    }
})();
