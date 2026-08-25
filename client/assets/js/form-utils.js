/**
 * Shared helpers for showing/clearing inline field errors on forms
 * that use the `data-error-for="<fieldName>"` convention (see
 * register.html, login.html, etc). Kept framework-free since this
 * project has no build step.
 */

function showFieldError(fieldName, message) {
  const input = document.getElementById(fieldName);
  const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (input) input.classList.add('is-invalid');
  if (errorEl) {
    if (message) errorEl.textContent = message;
    errorEl.classList.remove('d-none');
  }
}

function clearFormErrors(formEl) {
  formEl.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
  formEl.querySelectorAll('[data-error-for]').forEach((el) => el.classList.add('d-none'));
  const formError = formEl.querySelector('#formError');
  if (formError) formError.classList.add('d-none');
}

// Password show/hide toggle — wires up any button with
// data-toggle-password="<inputId>" on the page.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.getAttribute('data-toggle-password'));
      if (!input) return;
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) icon.className = 'fa-solid fa-eye-slash';
      } else {
        input.type = 'password';
        if (icon) icon.className = 'fa-solid fa-eye';
      }
    });
  });
});
