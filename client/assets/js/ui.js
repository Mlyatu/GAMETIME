/**
 * =====================================================================
 * ARENA UI HELPERS
 * =====================================================================
 * Shared failure UX: toasts, modals, loading skeletons, empty states,
 * and form error mapping. Assumes the Arena CSS tokens are loaded.
 * =====================================================================
 */

(function (root) {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info',
  };

  function ensureToastContainer() {
    let container = document.getElementById('toast-container-arena');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container-arena';
      container.className = 'toast-container-arena';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast-arena toast-arena--${type} animate-fade-in-up`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    el.style.opacity = '1';
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function showModal({
    title = 'Notice',
    message = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = true,
    onConfirm,
    onCancel,
  }) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay-arena';
      overlay.innerHTML = `
        <div class="glass-card modal-arena animate-fade-in-up">
          <h5 class="mb-3">${title}</h5>
          <p class="text-secondary-arena mb-4">${message}</p>
          <div class="d-flex gap-2 justify-content-end">
            ${showCancel ? `<button class="btn-arena btn-arena--ghost btn-arena--sm" id="modalCancel">${cancelText}</button>` : ''}
            <button class="btn-arena btn-arena--primary btn-arena--sm" id="modalConfirm">${confirmText}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#modalConfirm').onclick = () => {
        overlay.remove();
        if (onConfirm) onConfirm();
        resolve(true);
      };

      const cancelBtn = overlay.querySelector('#modalCancel');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          overlay.remove();
          if (onCancel) onCancel();
          resolve(false);
        };
      }

      overlay.onclick = (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      };
    });
  }

  function renderSkeleton(container, count = 3, className = 'skeleton-arena') {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const div = document.createElement('div');
      div.className = className;
      div.style.height = '80px';
      div.style.marginBottom = '12px';
      div.style.borderRadius = 'var(--radius-sm)';
      container.appendChild(div);
    }
  }

  function renderEmpty(container, message, ctaHtml = '') {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state-arena text-center py-5">
        <i class="fa-solid fa-box-open fa-2x mb-3" style="color:var(--text-muted);"></i>
        <p class="text-secondary-arena mb-3">${message}</p>
        ${ctaHtml}
      </div>
    `;
  }

  function setButtonLoading(button, isLoading, loadingText = '') {
    if (!button) return;
    button.disabled = isLoading;
    const textSpan = button.querySelector('span:not(.spinner-arena)');
    const spinner = button.querySelector('.spinner-arena');

    if (isLoading) {
      if (!button.dataset.originalText) button.dataset.originalText = textSpan ? textSpan.textContent : button.textContent;
      if (textSpan) textSpan.textContent = loadingText || 'Loading...';
      if (spinner) spinner.classList.remove('d-none');
    } else {
      const original = button.dataset.originalText || '';
      if (textSpan) textSpan.textContent = original;
      if (spinner) spinner.classList.add('d-none');
    }
  }

  function handleApiFormError(err, formEl, fallbackMessage = 'Something went wrong. Please try again.') {
    if (!formEl) return;
    const formError = formEl.querySelector('#formError');
    if (formError) {
      formError.classList.remove('d-none');
      formError.textContent = err.message || fallbackMessage;
      formError.style.color = 'var(--color-danger)';
      formError.style.background = 'rgba(var(--color-danger-rgb),.12)';
    }

    if (err.errors && Array.isArray(err.errors)) {
      err.errors.forEach((e) => {
        if (window.showFieldError && e.field) window.showFieldError(e.field, e.message);
      });
    }

    if (err.status >= 500 && typeof root.showToast === 'function') {
      root.showToast(err.message || fallbackMessage, 'error');
    }
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  root.ui = {
    showToast,
    showModal,
    renderSkeleton,
    renderEmpty,
    setButtonLoading,
    handleApiFormError,
    escapeHtml,
  };
})(window);
