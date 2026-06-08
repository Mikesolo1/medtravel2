/* ===== TAURUS MEDICAL — SITE ENGINE =====
 * Handles:
 * 1. Dynamic content loading from API (meta tags, H1, hero text)
 * 2. UTM parameter capture and storage
 * 3. Form submissions to Telegram + API
 * 4. Modal form functionality
 */

(function() {
    'use strict';

    const API_BASE = (function() {
        // Use absolute path from site root for API
        const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
        // Find the root by checking script src
        const scripts = document.querySelectorAll('script[src*="engine.js"]');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].getAttribute('src');
            if (src.includes('../js/engine.js')) {
                return '../tables';
            }
        }
        return 'tables';
    })();
    
    // ===== UTM TRACKING =====
    const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    
    function captureUTM() {
        const params = new URLSearchParams(window.location.search);
        const utm = {};
        UTM_PARAMS.forEach(key => {
            const val = params.get(key);
            if (val) utm[key] = val;
        });
        // Store in sessionStorage (persists across page navigations within session)
        if (Object.keys(utm).length > 0) {
            sessionStorage.setItem('taurus_utm', JSON.stringify(utm));
        }
        return getStoredUTM();
    }

    function getStoredUTM() {
        try {
            return JSON.parse(sessionStorage.getItem('taurus_utm')) || {};
        } catch(e) {
            return {};
        }
    }

    // ===== DYNAMIC CONTENT LOADING =====
    function getPageSlug() {
        // Determine slug from current page filename
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        
        // Map filenames to slugs
        const slugMap = {
            'index.html': 'index',
            'o-nas.html': 'o-nas',
            'kliniki-izrailya.html': 'kliniki-izrailya',
            'ikhilov-sourasky.html': 'kliniki-ikhilov',
            'assuta.html': 'kliniki-assuta',
            'sheba-tel-hashomer.html': 'kliniki-sheba',
            'rabin-beilinson.html': 'kliniki-rabin',
            'wolfson.html': 'kliniki-wolfson',
            'herzliya-medical-center.html': 'kliniki-herzliya',
            'medica-raphael.html': 'kliniki-medica',
            'otdeleniya.html': 'otdeleniya',
            'onkologiya.html': 'onkologiya',
            'vrachi.html': 'vrachi',
            'patsientam.html': 'patsientam',
            'prieezd-v-izrail.html': 'patsientam-prieezd',
            'programma-obsledovaniya.html': 'patsientam-obsledovaniya',
            'soputstvuyushchie-uslugi.html': 'patsientam-uslugi',
            'otzyvy.html': 'otzyvy',
            'kontakty.html': 'kontakty',
            'allergologiya.html': 'napravleniya-allergologiya',
            'gastroenterologiya.html': 'napravleniya-gastroenterologiya',
            'gematologiya.html': 'napravleniya-gematologiya',
            'genetika.html': 'napravleniya-genetika',
            'ginekologiya.html': 'napravleniya-ginekologiya',
            'geriatriya.html': 'napravleniya-geriatriya',
            'kardiologiya.html': 'napravleniya-kardiologiya',
            'nevrologiya.html': 'napravleniya-nevrologiya',
            'ortopediya.html': 'napravleniya-ortopediya',
            'urologiya.html': 'napravleniya-urologiya'
        };

        return slugMap[filename] || 'index';
    }

    async function loadPageContent() {
        const slug = getPageSlug();
        try {
            const res = await fetch(`${API_BASE}/page_content?search=${slug}&limit=50`);
            const data = await res.json();
            const page = (data.data || []).find(p => p.page_slug === slug);
            if (page) applyContent(page);
        } catch(e) {
            // Silently fail — static content remains
            console.log('Content API unavailable, using static content');
        }
    }

    function applyContent(page) {
        // Update meta title
        if (page.meta_title) {
            document.title = page.meta_title;
        }
        // Update meta description
        if (page.meta_description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', page.meta_description);
        }
        // Update H1
        if (page.h1) {
            const h1 = document.querySelector('h1');
            if (h1) h1.textContent = page.h1;
        }
        // Update hero text
        if (page.hero_text) {
            const heroText = document.querySelector('.hero__text') || document.querySelector('.page-hero__text');
            if (heroText) heroText.textContent = page.hero_text;
        }
        // Update editable content blocks
        applyContentBlocks(page);
    }

    // ===== EDITABLE CONTENT BLOCKS =====
    function parseBlocks(raw) {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
            catch (e) { return []; }
        }
        return [];
    }

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function renderBlock(b) {
        const alt = b.alt ? ' content-section--alt' : '';
        const label = b.label ? `<div class="section__label">${esc(b.label)}</div>` : '';
        const title = b.title ? `<h2 class="section__title">${esc(b.title)}</h2>` : '';
        let body = '';
        if (b.type === 'features' && Array.isArray(b.items)) {
            body = `<div class="feature-list">` + b.items.map(it =>
                `<div class="feature-list__item"><i class="fas fa-check-circle"></i><span>${esc(it)}</span></div>`
            ).join('') + `</div>`;
        } else {
            const paras = String(b.text || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
            body = paras.map(p => `<p class="section__text">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
        }
        return `<section class="content-section${alt}"><div class="container">${label}${title}${body}</div></section>`;
    }

    function applyContentBlocks(page) {
        const container = document.querySelector('[data-content-blocks]');
        if (!container) return;
        const blocks = parseBlocks(page.content_blocks);
        if (!blocks.length) return;
        container.innerHTML = blocks.map(renderBlock).join('');
    }

    // ===== TELEGRAM INTEGRATION =====
    async function getSettings() {
        try {
            const res = await fetch(`${API_BASE}/site_settings?limit=100`);
            const data = await res.json();
            const map = {};
            (data.data || []).forEach(s => { map[s.key] = s.value; });
            return map;
        } catch(e) {
            return {};
        }
    }

    async function sendToTelegram(formData) {
        const settings = await getSettings();
        const botToken = settings['telegram_bot_token'];
        const chatId = settings['telegram_chat_id'];

        if (!botToken || !chatId) {
            console.log('Telegram not configured');
            return false;
        }

        const utm = getStoredUTM();
        const typeLabels = {
            consultation: '📋 Консультация',
            second_opinion: '🎥 Второе мнение онлайн',
            callback: '📞 Обратный звонок'
        };

        let message = `${typeLabels[formData.form_type] || '📩 Заявка с сайта'}\n\n`;
        message += `👤 Имя: ${formData.name || '—'}\n`;
        message += `📱 Телефон: ${formData.phone || '—'}\n`;
        if (formData.email) message += `📧 Email: ${formData.email}\n`;
        if (formData.message) message += `💬 Сообщение: ${formData.message}\n`;
        message += `\n📄 Страница: ${formData.page_url || window.location.href}\n`;
        
        // UTM marks
        if (Object.keys(utm).length > 0) {
            message += `\n🏷 UTM-метки:\n`;
            if (utm.utm_source) message += `  source: ${utm.utm_source}\n`;
            if (utm.utm_medium) message += `  medium: ${utm.utm_medium}\n`;
            if (utm.utm_campaign) message += `  campaign: ${utm.utm_campaign}\n`;
            if (utm.utm_term) message += `  term: ${utm.utm_term}\n`;
            if (utm.utm_content) message += `  content: ${utm.utm_content}\n`;
        }

        message += `\n⏰ ${new Date().toLocaleString('ru-RU')}`;

        try {
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });
            return tgRes.ok;
        } catch(e) {
            console.error('Telegram send error:', e);
            return false;
        }
    }

    // ===== FORM SUBMISSION =====
    async function submitForm(formData) {
        const utm = getStoredUTM();
        
        const payload = {
            form_type: formData.form_type || 'consultation',
            name: formData.name || '',
            phone: formData.phone || '',
            email: formData.email || '',
            message: formData.message || '',
            utm_source: utm.utm_source || '',
            utm_medium: utm.utm_medium || '',
            utm_campaign: utm.utm_campaign || '',
            utm_term: utm.utm_term || '',
            utm_content: utm.utm_content || '',
            page_url: window.location.pathname,
            status: 'new'
        };

        // Save to API
        try {
            await fetch(`${API_BASE}/form_submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch(e) {
            console.error('API save error:', e);
        }

        // Send to Telegram
        await sendToTelegram(payload);

        return true;
    }

    // ===== MODAL FORM =====
    function createModal() {
        if (document.getElementById('taurusModal')) return;

        const modalHTML = `
        <div class="taurus-modal" id="taurusModal">
            <div class="taurus-modal__overlay" onclick="window.TaurusForms.closeModal()"></div>
            <div class="taurus-modal__box">
                <button class="taurus-modal__close" onclick="window.TaurusForms.closeModal()" aria-label="Закрыть">
                    <i class="fas fa-times"></i>
                </button>
                <div class="taurus-modal__header">
                    <h3 class="taurus-modal__title" id="modalTitle">Получить консультацию</h3>
                    <p class="taurus-modal__subtitle">Заполните форму — мы свяжемся с вами в ближайшее время</p>
                </div>
                <form class="taurus-modal__form" id="modalForm" onsubmit="return window.TaurusForms.handleSubmit(event)">
                    <input type="hidden" id="modalFormType" value="consultation">
                    <div class="taurus-modal__field">
                        <input type="text" id="modalName" placeholder="Ваше имя *" required>
                    </div>
                    <div class="taurus-modal__field">
                        <input type="tel" id="modalPhone" placeholder="Телефон *" required>
                    </div>
                    <div class="taurus-modal__field">
                        <input type="email" id="modalEmail" placeholder="Email (необязательно)">
                    </div>
                    <div class="taurus-modal__field">
                        <textarea id="modalMessage" placeholder="Кратко опишите ситуацию или вопрос" rows="3"></textarea>
                    </div>
                    <button type="submit" class="taurus-modal__submit" id="modalSubmitBtn">
                        <i class="fas fa-paper-plane"></i>
                        Отправить заявку
                    </button>
                    <p class="taurus-modal__privacy">Нажимая кнопку, вы соглашаетесь на обработку персональных данных</p>
                </form>
                <div class="taurus-modal__success" id="modalSuccess" style="display:none;">
                    <div class="taurus-modal__success-icon"><i class="fas fa-check-circle"></i></div>
                    <h3>Заявка отправлена!</h3>
                    <p>Мы свяжемся с вами в ближайшее время</p>
                    <button class="taurus-modal__submit" onclick="window.TaurusForms.closeModal()" style="margin-top:20px;">Закрыть</button>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function openModal(type, title) {
        createModal();
        const modal = document.getElementById('taurusModal');
        const form = document.getElementById('modalForm');
        const success = document.getElementById('modalSuccess');
        const titleEl = document.getElementById('modalTitle');
        const formTypeEl = document.getElementById('modalFormType');

        form.style.display = 'block';
        success.style.display = 'none';
        form.reset();

        formTypeEl.value = type || 'consultation';
        titleEl.textContent = title || 'Получить консультацию';

        modal.classList.add('taurus-modal--active');
        document.body.dataset.scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${window.scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById('taurusModal');
        if (modal) {
            modal.classList.remove('taurus-modal--active');
            const scrollY = document.body.dataset.scrollY || '0';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            window.scrollTo(0, parseInt(scrollY));
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        
        const btn = document.getElementById('modalSubmitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';

        const formData = {
            form_type: document.getElementById('modalFormType').value,
            name: document.getElementById('modalName').value,
            phone: document.getElementById('modalPhone').value,
            email: document.getElementById('modalEmail').value,
            message: document.getElementById('modalMessage').value
        };

        await submitForm(formData);

        // Show success
        document.getElementById('modalForm').style.display = 'none';
        document.getElementById('modalSuccess').style.display = 'block';

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку';

        return false;
    }

    // ===== WIRE CTA BUTTONS =====
    function wireCTAButtons() {
        // Find all CTA buttons and wire them to open modal
        document.querySelectorAll('a[href="#final-cta"], a[href*="mailto:info@msch1.ru"]').forEach(btn => {
            const text = btn.textContent.toLowerCase();
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (text.includes('второе мнение') || text.includes('second')) {
                    openModal('second_opinion', 'Получить второе мнение онлайн');
                } else {
                    openModal('consultation', 'Получить консультацию');
                }
            });
        });

        // Wire kontakty.html CTA buttons in header
        document.querySelectorAll('a.header__cta, .mobile-nav__cta a.btn--primary').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                openModal('consultation', 'Получить консультацию');
            });
        });
    }

    // ===== INIT =====
    function init() {
        captureUTM();
        loadPageContent();
        
        // Wait for DOM ready then wire buttons
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', wireCTAButtons);
        } else {
            wireCTAButtons();
        }
    }

    // Expose global API
    window.TaurusForms = {
        openModal: openModal,
        closeModal: closeModal,
        handleSubmit: handleSubmit,
        submitForm: submitForm,
        getUTM: getStoredUTM
    };

    // Run
    init();

})();
