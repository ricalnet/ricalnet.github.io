(function() {
  'use strict';

  const menuToggle = document.getElementById('mobile-menu-toggle');
  const menuClose = document.getElementById('mobile-menu-close');
  const mobileMenu = document.getElementById('mobile-menu');
  const body = document.body;

  function openMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('open');
    body.classList.add('menu-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'true');
    document.documentElement.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    body.classList.remove('menu-open');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';

    document.querySelectorAll('.mobile-sub-menu.open').forEach(el => {
      el.classList.remove('open');
      const toggle = el.previousElementSibling;
      if (toggle && toggle.classList) {
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      if (mobileMenu.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (menuClose) {
    menuClose.addEventListener('click', closeMobileMenu);
  }

  if (mobileMenu) {
    mobileMenu.addEventListener('click', function(e) {
      if (e.target === this) {
        closeMobileMenu();
      }
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu && mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });

  document.querySelectorAll('.mobile-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const targetId = this.getAttribute('data-target');
      const sub = document.getElementById(targetId);
      if (!sub) return;

      const isOpen = sub.classList.contains('open');

      document.querySelectorAll('.mobile-sub-menu').forEach(el => {
        if (el !== sub) {
          el.classList.remove('open');
          const prev = el.previousElementSibling;
          if (prev && prev.classList) {
            prev.classList.remove('open');
            prev.setAttribute('aria-expanded', 'false');
          }
        }
      });

      if (isOpen) {
        sub.classList.remove('open');
        this.classList.remove('open');
        this.setAttribute('aria-expanded', 'false');
      } else {
        sub.classList.add('open');
        this.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.querySelectorAll('[data-close-mobile]').forEach(link => {
    link.addEventListener('click', function() {
      setTimeout(closeMobileMenu, 100);
    });
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth >= 1024 && mobileMenu && mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });

})();