/**
 * =====================================================================
 * COMPONENT INCLUDE LOADER
 * =====================================================================
 * This project has no build step (plain HTML/CSS/JS per the spec), so
 * there's no templating engine to share a navbar/sidebar/footer across
 * pages. This is the low-tech substitute: any element with
 * `data-include="/path/to/partial.html"` gets that file fetched and
 * swapped in as its content.
 *
 * Usage in a page:
 *   <div data-include="/components/sidebar.html"></div>
 *
 * After all includes on the page finish loading, a
 * `arena:includes-loaded` event fires on `document` — page scripts
 * that need to attach listeners to included content (e.g. highlighting
 * the active sidebar link) should wait for this event rather than
 * running on plain DOMContentLoaded.
 */
(function () {
  function initPublicNav() {
    const toggle = document.getElementById('publicNavToggle');
    const mobile = document.getElementById('publicNavMobile');
    if (!toggle || !mobile || toggle.dataset.bound === 'true') return;

    const icon = toggle.querySelector('i');
    const setOpen = (isOpen) => {
      mobile.hidden = !isOpen;
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      if (icon) {
        icon.classList.toggle('fa-bars', !isOpen);
        icon.classList.toggle('fa-xmark', isOpen);
      }
    };

    toggle.dataset.bound = 'true';
    toggle.setAttribute('aria-controls', mobile.id);
    setOpen(false);
    toggle.addEventListener('click', () => setOpen(mobile.hidden));
    mobile.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  function initMobileSidebar() {
    const toggle = document.getElementById('mobileSidebarToggle');
    const sidebar = document.querySelector('.sidebar-arena');
    if (!toggle || !sidebar || toggle.dataset.bound === 'true') return;

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Close menu');
    document.body.appendChild(backdrop);

    const close = () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('is-visible');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('is-visible');
      toggle.setAttribute('aria-expanded', 'true');
    };

    toggle.dataset.bound = 'true';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      sidebar.classList.contains('mobile-open') ? close() : open();
    });
    backdrop.addEventListener('click', close);
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  async function loadIncludes() {
    const targets = document.querySelectorAll('[data-include]');
    await Promise.all(
      Array.from(targets).map(async (el) => {
        const url = el.getAttribute('data-include');
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          el.innerHTML = await res.text();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`Failed to load include "${url}":`, err);
          el.innerHTML = `<!-- failed to load ${url} -->`;
        }
      })
    );
    initPublicNav();
    initMobileSidebar();
    document.dispatchEvent(new CustomEvent('arena:includes-loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIncludes);
  } else {
    loadIncludes();
  }
})();
