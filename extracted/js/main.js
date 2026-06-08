/* ===== TAURUS MEDICAL — SHARED JAVASCRIPT ===== */

// FAQ Accordion
function toggleFaq(el) {
    var item = el.closest('.faq__item');
    var answer = item.querySelector('.faq__answer');
    var isActive = item.classList.contains('faq__item--active');

    // Close all items in the same list
    var list = item.closest('.faq-list');
    if (list) {
        list.querySelectorAll('.faq__item').forEach(function(faqItem) {
            faqItem.classList.remove('faq__item--active');
            faqItem.querySelector('.faq__answer').style.maxHeight = null;
        });
    }

    if (!isActive) {
        item.classList.add('faq__item--active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
    }
}

// Header scroll effect
(function() {
    var header = document.getElementById('header');
    if (!header) return;
    window.addEventListener('scroll', function() {
        if (window.scrollY > 20) {
            header.classList.add('header--scrolled');
        } else {
            header.classList.remove('header--scrolled');
        }
    });
})();

// Mobile menu
(function() {
    var burger = document.getElementById('burger');
    var mobileNav = document.getElementById('mobileNav');
    if (!burger || !mobileNav) return;

    var isMenuOpen = false;

    burger.addEventListener('click', function() {
        isMenuOpen = !isMenuOpen;
        mobileNav.classList.toggle('mobile-nav--active', isMenuOpen);
        document.body.style.overflow = isMenuOpen ? 'hidden' : '';

        var lines = burger.querySelectorAll('.header__burger-line');
        if (isMenuOpen) {
            lines[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            lines[1].style.opacity = '0';
            lines[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
            lines[0].style.transform = '';
            lines[1].style.opacity = '';
            lines[2].style.transform = '';
        }
    });

    document.querySelectorAll('[data-close]').forEach(function(link) {
        link.addEventListener('click', function() {
            isMenuOpen = false;
            mobileNav.classList.remove('mobile-nav--active');
            document.body.style.overflow = '';
            var lines = burger.querySelectorAll('.header__burger-line');
            lines[0].style.transform = '';
            lines[1].style.opacity = '';
            lines[2].style.transform = '';
        });
    });
})();

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        var targetId = this.getAttribute('href');
        if (targetId === '#') return;
        var target = document.querySelector(targetId);
        if (target) {
            e.preventDefault();
            var header = document.getElementById('header');
            var headerHeight = header ? header.offsetHeight : 72;
            var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
    });
});

// Intersection Observer for scroll animations
(function() {
    var observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.addEventListener('DOMContentLoaded', function() {
        var selectors = '.info-card, .feature-list__item, .step-item, .faq__item, .review-card, .doctor-card, .program-block, .highlight-box';
        var animateElements = document.querySelectorAll(selectors);
        animateElements.forEach(function(el, index) {
            el.style.opacity = '0';
            el.style.transform = 'translateY(24px)';
            el.style.transition = 'opacity 0.6s ease ' + (index % 6) * 0.08 + 's, transform 0.6s ease ' + (index % 6) * 0.08 + 's';
            observer.observe(el);
        });
    });
})();
