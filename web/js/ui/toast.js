// Small non-blocking notifications (used instead of alert dialogs).

let host;
let timer;

export function toast(message, { error = false, duration = 2600 } = {}) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  host.textContent = message;
  host.classList.toggle('toast--error', error);
  host.classList.add('toast--visible');
  clearTimeout(timer);
  timer = setTimeout(() => host.classList.remove('toast--visible'), duration);
}
