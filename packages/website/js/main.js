/* ============================================
   EdSteward.com — Shared Components & Behavior
   ============================================ */

const APP_URL = 'https://moravian.edsteward.ai';
const API_URL = 'https://moravian.edsteward.ai/api';

const SHIELD_SVG = `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 17 6.88-2.04 12-9.27 12-17V7L16 2z" fill="#2563eb" opacity="0.15"/>
  <path d="M16 2L4 7v8c0 7.73 5.12 14.96 12 17 6.88-2.04 12-9.27 12-17V7L16 2z" stroke="#2563eb" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M11 16l3.5 3.5L21.5 12" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ---------- Navigation ----------

function injectNav(activePage) {
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.id = 'main-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  nav.innerHTML = `
    <div class="nav__inner">
      <a href="/" class="nav__brand" aria-label="EdSteward Home">
        ${SHIELD_SVG}
        EdSteward
      </a>
      <div class="nav__links">
        <a href="/features.html" class="nav__link ${activePage === 'features' ? 'nav__link--active' : ''}">Features</a>
        <a href="/pricing.html" class="nav__link ${activePage === 'pricing' ? 'nav__link--active' : ''}">Pricing</a>
        <a href="/about.html" class="nav__link ${activePage === 'about' ? 'nav__link--active' : ''}">About</a>
        <a href="/contact.html" class="nav__link ${activePage === 'contact' ? 'nav__link--active' : ''}">Contact</a>
      </div>
      <div class="nav__actions">
        <a href="${APP_URL}" class="nav__login" target="_blank" rel="noopener">Log In</a>
        <a href="/contact.html" class="btn btn--primary btn--sm">Request Demo</a>
      </div>
      <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  document.body.prepend(nav);
  initMobileMenu(nav);
  initScrollShadow(nav);
}

// ---------- Footer ----------

function injectFooter() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.setAttribute('role', 'contentinfo');

  const year = new Date().getFullYear();

  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div>
          <div class="footer__brand">EdSteward</div>
          <p class="footer__desc">
            AI-powered regulatory compliance for higher education.
            Stay ahead of federal and state requirements with automated tracking,
            task generation, and evidence management.
          </p>
        </div>
        <div>
          <div class="footer__heading">Product</div>
          <a href="/features.html" class="footer__link">Features</a>
          <a href="/pricing.html" class="footer__link">Pricing</a>
          <a href="${APP_URL}" class="footer__link" target="_blank" rel="noopener">Log In</a>
        </div>
        <div>
          <div class="footer__heading">Company</div>
          <a href="/about.html" class="footer__link">About Us</a>
          <a href="/contact.html" class="footer__link">Contact</a>
          <a href="/contact.html" class="footer__link">Request Demo</a>
        </div>
        <div>
          <div class="footer__heading">Compliance</div>
          <a href="/features.html" class="footer__link">FERPA</a>
          <a href="/features.html" class="footer__link">Title IX</a>
          <a href="/features.html" class="footer__link">Clery Act</a>
          <a href="/features.html" class="footer__link">HECVAT</a>
        </div>
      </div>
      <div class="footer__bottom">
        <span>&copy; ${year} EdSteward. All rights reserved.</span>
        <span>Built for higher education compliance.</span>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
}

// ---------- Mobile Menu ----------

function initMobileMenu(nav) {
  const toggle = nav.querySelector('.nav__toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('nav--open');
    toggle.setAttribute('aria-expanded', isOpen);
  });

  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && nav.classList.contains('nav--open')) {
      nav.classList.remove('nav--open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---------- Scroll Shadow on Nav ----------

function initScrollShadow(nav) {
  let ticking = false;
  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('nav--scrolled', window.scrollY > 10);
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---------- Intersection Observer Animations ----------

function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));

  document.querySelectorAll('.stagger').forEach((container) => {
    const childObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            Array.from(entry.target.children).forEach((child) => {
              child.classList.add('is-visible');
            });
            childObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    childObserver.observe(container);
  });
}

// ---------- Contact Form ----------

function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let valid = true;

    form.querySelectorAll('[required]').forEach((field) => {
      const group = field.closest('.form-group');
      if (!field.value.trim()) {
        group.classList.add('form-group--error');
        valid = false;
      } else {
        group.classList.remove('form-group--error');
      }

      if (field.type === 'email' && field.value.trim()) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(field.value.trim())) {
          group.classList.add('form-group--error');
          valid = false;
        }
      }
    });

    if (!valid) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;

    try {
      const payload = {
        firstName: form.querySelector('#first-name').value.trim(),
        lastName: form.querySelector('#last-name').value.trim(),
        email: form.querySelector('#email').value.trim(),
        institution: form.querySelector('#institution').value.trim(),
        role: form.querySelector('#role').value || null,
        message: form.querySelector('#message').value.trim() || null,
      };

      const res = await fetch(`${API_URL}/demo-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Request failed');
      }

      form.innerHTML = `
        <div style="text-align:center; padding: 2rem 0;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">✓</div>
          <h3 style="margin-bottom: 0.5rem;">Thank you!</h3>
          <p class="text-muted">We've received your request and will be in touch within one business day.</p>
        </div>
      `;
    } catch (err) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;

      let errorEl = form.querySelector('.form-submit-error');
      if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.className = 'form-submit-error';
        errorEl.style.cssText = 'color:#dc2626; font-size:0.85rem; text-align:center; margin-top:0.75rem;';
        submitBtn.parentNode.appendChild(errorEl);
      }
      errorEl.textContent = err.message || 'Something went wrong. Please try again or email hello@edsteward.com.';
    }
  });

  form.querySelectorAll('[required]').forEach((field) => {
    field.addEventListener('input', () => {
      field.closest('.form-group').classList.remove('form-group--error');
    });
  });
}

// ---------- Init ----------

export function init(activePage) {
  injectNav(activePage);
  injectFooter();
  initScrollAnimations();
  initContactForm();
}
