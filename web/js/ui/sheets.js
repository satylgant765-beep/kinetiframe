// Opens and closes bottom sheets and dialogs, with a shared backdrop.
// On wide screens the properties and layers panels are docked and never act as sheets.

// Keep in sync with the docked-layout media query in styles.css.
const DOCKED_QUERY = '(min-width: 900px) and (min-height: 501px)';
const backdrop = document.getElementById('backdrop');
const open = new Set();
const listeners = new Set();

export function isDocked(el) {
  return el.classList.contains('panel') && window.matchMedia(DOCKED_QUERY).matches;
}

export function openSheet(el) {
  if (isDocked(el)) return;
  closeAll();
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  open.add(el);
  backdrop.classList.add('is-open');
  notify();
}

export function closeSheet(el) {
  el.classList.remove('is-open');
  if (!isDocked(el)) el.setAttribute('aria-hidden', 'true');
  open.delete(el);
  if (!open.size) backdrop.classList.remove('is-open');
  notify();
}

export function toggleSheet(el) {
  if (open.has(el)) closeSheet(el); else openSheet(el);
}

export function closeAll() {
  for (const el of [...open]) closeSheet(el);
}

export function isOpen(el) {
  return open.has(el);
}

export function onSheetsChange(fn) {
  listeners.add(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

backdrop.addEventListener('click', () => {
  // Dialogs that are busy (like video export) opt out of closing on backdrop taps.
  for (const el of [...open]) if (!el.dataset.modal) closeSheet(el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const el of [...open]) if (!el.dataset.modal) closeSheet(el);
});

function syncDocked() {
  for (const el of document.querySelectorAll('.panel')) {
    if (isDocked(el) && open.has(el)) closeSheet(el);
    el.setAttribute('aria-hidden', isDocked(el) ? 'false' : String(!open.has(el)));
  }
}
window.matchMedia(DOCKED_QUERY).addEventListener('change', syncDocked);
syncDocked();
