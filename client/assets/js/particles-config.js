/**
 * =====================================================================
 * PARTICLES BACKGROUND
 * =====================================================================
 * Subtle floating-particle atmosphere for hero sections (landing page,
 * auth screens) — not used on data-dense pages (dashboard, admin
 * panel) where it would compete with content and cost unnecessary GPU
 * cycles. Requires particles.js (loaded via CDN) and a target element
 * with id="particles-bg".
 *
 * Usage: include this script after particles.js, and add
 *   <div id="particles-bg"></div>
 * positioned absolutely behind your hero content.
 */
(function () {
  function initParticles() {
    if (typeof particlesJS === 'undefined') return;
    const target = document.getElementById('particles-bg');
    if (!target) return;

    particlesJS('particles-bg', {
      particles: {
        number: { value: 45, density: { enable: true, value_area: 900 } },
        color: { value: ['#3476F6', '#00F2FE'] },
        shape: { type: 'circle' },
        opacity: { value: 0.35, random: true },
        size: { value: 3, random: true },
        line_linked: {
          enable: true,
          distance: 140,
          color: '#3476F6',
          opacity: 0.15,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.6,
          direction: 'none',
          random: true,
          straight: false,
          out_mode: 'out',
        },
      },
      interactivity: {
        detect_on: 'canvas',
        events: {
          onhover: { enable: true, mode: 'grab' },
          onclick: { enable: false },
          resize: true,
        },
        modes: {
          grab: { distance: 160, line_linked: { opacity: 0.3 } },
        },
      },
      retina_detect: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParticles);
  } else {
    initParticles();
  }
})();
