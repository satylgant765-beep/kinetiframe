// Floating actions for the selected object: duplicate, flip, reorder and delete.

import { icon } from './icons.js';
import { findObject, cloneObject } from '../core/project.js';

export class ContextBar {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    el.innerHTML = `
      <button class="icon-btn" data-act="dup" title="Дублировать">${icon('copy')}</button>
      <button class="icon-btn" data-act="flip" title="Отразить по горизонтали">${icon('flip')}</button>
      <button class="icon-btn" data-act="forward" title="На передний план">${icon('forward')}</button>
      <button class="icon-btn" data-act="backward" title="На задний план">${icon('backward')}</button>
      <button class="icon-btn" data-act="reset" title="Сбросить поворот и масштаб">${icon('reset')}</button>
      <button class="icon-btn icon-btn--danger" data-act="delete" title="Удалить (Delete)">${icon('trash')}</button>`;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (btn) this.run(btn.dataset.act);
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.found()) { e.preventDefault(); this.run('delete'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && this.found()) { e.preventDefault(); this.run('dup'); }
    });
    store.on('ui', () => this.update());
    store.on('project', () => this.update());
    this.update();
  }

  found() {
    const { project, ui } = this.store;
    return findObject(project, ui.frameIndex, ui.selectedId);
  }

  update() {
    const visible = Boolean(this.found()) && !this.store.ui.playing;
    this.el.hidden = !visible;
  }

  run(action) {
    const { store } = this;
    const found = this.found();
    if (!found) return;
    const { index, list } = found;
    switch (action) {
      case 'dup': {
        const copy = cloneObject(found.obj);
        copy.x += 30;
        copy.y += 30;
        store.mutate(() => list.splice(index + 1, 0, copy));
        store.setUI({ selectedId: copy.id });
        return;
      }
      case 'flip':
        store.mutate(() => { found.obj.sx = -found.obj.sx; });
        return;
      case 'forward':
        store.mutate(() => { const [o] = list.splice(index, 1); list.push(o); });
        return;
      case 'backward':
        store.mutate(() => { const [o] = list.splice(index, 1); list.unshift(o); });
        return;
      case 'reset':
        store.mutate(() => {
          const o = found.obj;
          o.rotation = 0;
          o.sx = Math.sign(o.sx) || 1;
          o.sy = Math.sign(o.sy) || 1;
        });
        return;
      case 'delete':
        store.mutate(() => list.splice(index, 1));
        store.setUI({ selectedId: null });
        return;
      default:
    }
  }
}
