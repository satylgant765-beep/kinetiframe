// Sheet that creates smooth in-between frames from the current frame to the next one.

import { icon } from './icons.js';
import { addInbetweens, matchedCount } from '../core/tween.js';
import { openSheet, closeSheet } from './sheets.js';
import { toast } from './toast.js';

const EASING_LABELS = {
  easeInOut: 'Плавно',
  linear: 'Равномерно',
  easeIn: 'Разгон',
  easeOut: 'Торможение',
  bounce: 'Отскок',
};

export class TweenSheet {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    this.easing = 'easeInOut';
    el.innerHTML = `
      <header class="panel__header">
        <h2>Плавное движение</h2>
        <button class="icon-btn" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body">
        <p class="hint" data-summary></p>
        <label class="field"><span>Промежуточных кадров <output data-count-value>4</output></span>
          <input type="range" min="1" max="24" value="4" data-count></label>
        <div class="field"><span>Характер движения</span>
          <div class="chips">${Object.entries(EASING_LABELS).map(([k, label]) => `<button class="chip" data-easing="${k}">${label}</button>`).join('')}</div>
        </div>
        <p class="hint">Как пользоваться: дублируйте кадр, сдвиньте, поверните или увеличьте объекты на копии, вернитесь на исходный кадр и нажмите «Создать».</p>
        <div class="dialog__actions">
          <button class="btn btn--primary" data-act="create">${icon('tween')}<span>Создать</span></button>
        </div>
      </div>`;
    this.count = el.querySelector('[data-count]');
    this.count.addEventListener('input', () => { el.querySelector('[data-count-value]').textContent = this.count.value; });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="close"]')) closeSheet(el);
      if (e.target.closest('[data-act="create"]')) this.create();
      const easing = e.target.closest('[data-easing]');
      if (easing) { this.easing = easing.dataset.easing; this.render(); }
    });
  }

  open() {
    this.store.setUI({ playing: false });
    this.render();
    openSheet(this.el);
  }

  render() {
    const { project, ui } = this.store;
    const from = project.frames[ui.frameIndex];
    const to = project.frames[ui.frameIndex + 1];
    const button = this.el.querySelector('[data-act="create"]');
    const summary = this.el.querySelector('[data-summary]');
    if (!to) {
      summary.textContent = 'Это последний кадр. Переход строится от текущего кадра к следующему, поэтому сначала создайте следующий кадр (например, кнопкой «Дублировать кадр»).';
      button.disabled = true;
    } else {
      const n = matchedCount(from, to);
      summary.textContent = `Переход от кадра ${ui.frameIndex + 1} к кадру ${ui.frameIndex + 2}. Плавно сдвинутся объектов: ${n}.`
        + (n ? '' : ' Общих объектов нет, поэтому кадры просто сменятся посередине.');
      button.disabled = false;
    }
    for (const chip of this.el.querySelectorAll('[data-easing]')) {
      chip.setAttribute('aria-pressed', String(chip.dataset.easing === this.easing));
    }
  }

  create() {
    const { store } = this;
    const index = store.ui.frameIndex;
    const count = Number(this.count.value);
    const added = store.mutate((p) => addInbetweens(p, index, count, this.easing));
    if (!added) return;
    closeSheet(this.el);
    store.setUI({ frameIndex: index, selectedId: null });
    toast(`Добавлено промежуточных кадров: ${added}. Нажмите ▶, чтобы посмотреть.`);
  }
}
