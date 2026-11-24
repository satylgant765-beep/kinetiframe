// Layers panel: choose the active layer, add, rename, reorder, hide, lock, delete and set opacity.

import { icon } from './icons.js';
import { addLayer, deleteLayer, moveLayer } from '../core/project.js';
import { toast } from './toast.js';
import { closeSheet } from './sheets.js';

export class LayersPanel {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    el.innerHTML = `
      <header class="panel__header">
        <h2>Слои</h2>
        <button class="icon-btn" data-act="add" title="Новый слой">${icon('plus')}</button>
        <button class="icon-btn panel__close" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body">
        <ul class="layers" data-list></ul>
        <label class="field">
          <span>Прозрачность слоя <output data-opacity-value></output></span>
          <input type="range" min="0" max="100" data-opacity>
        </label>
      </div>`;
    this.list = el.querySelector('[data-list]');
    this.opacity = el.querySelector('[data-opacity]');

    el.addEventListener('click', (e) => this.onClick(e));
    this.list.addEventListener('change', (e) => {
      const input = e.target.closest('[data-name]');
      if (!input) return;
      const name = input.value.trim() || 'Без названия';
      store.mutate((p) => { p.layers.find((l) => l.id === input.dataset.name).name = name; });
    });
    this.opacity.addEventListener('pointerdown', () => { this.opacityCommitted = false; });
    this.opacity.addEventListener('input', () => {
      if (!this.opacityCommitted) { store.checkpoint(); this.opacityCommitted = true; }
      store.layer.opacity = Number(this.opacity.value) / 100;
      store.changed();
    });
    this.opacity.addEventListener('change', () => { this.opacityCommitted = false; });

    store.on('project', () => this.render());
    store.on('ui', () => this.render());
    this.render();
  }

  onClick(e) {
    const { store } = this;
    const btn = e.target.closest('[data-act]');
    const row = e.target.closest('[data-layer]');
    const layerId = row?.dataset.layer;
    if (!btn) {
      if (row && !e.target.closest('input')) store.setUI({ layerId, selectedId: null });
      else if (row) store.setUI({ layerId });
      return;
    }
    switch (btn.dataset.act) {
      case 'close': closeSheet(this.el); break;
      case 'add': {
        const layer = store.mutate((p) => addLayer(p));
        store.setUI({ layerId: layer.id, selectedId: null });
        break;
      }
      case 'visible':
        store.mutate((p) => { const l = p.layers.find((x) => x.id === layerId); l.visible = !l.visible; });
        store.setUI({ selectedId: null });
        break;
      case 'lock':
        store.mutate((p) => { const l = p.layers.find((x) => x.id === layerId); l.locked = !l.locked; });
        store.setUI({ selectedId: null });
        break;
      case 'up': store.mutate((p) => moveLayer(p, layerId, 1)); break;
      case 'down': store.mutate((p) => moveLayer(p, layerId, -1)); break;
      case 'delete': {
        if (store.project.layers.length <= 1) { toast('Нужен хотя бы один слой.'); break; }
        store.mutate((p) => deleteLayer(p, layerId));
        const layers = store.project.layers;
        if (store.ui.layerId === layerId) store.setUI({ layerId: layers[layers.length - 1].id, selectedId: null });
        toast('Слой удалён. Отменить: кнопка «Назад».');
        break;
      }
      default:
    }
  }

  render() {
    const { project, ui } = this.store;
    if (this.list.contains(document.activeElement) && document.activeElement.matches('[data-name]')) return;
    const frame = project.frames[ui.frameIndex];
    const count = project.layers.length;
    this.list.innerHTML = [...project.layers].reverse().map((l, i) => {
      const objects = frame?.cells[l.id]?.length || 0;
      return `
      <li class="layer ${l.id === ui.layerId ? 'is-active' : ''} ${l.visible ? '' : 'is-hidden'}" data-layer="${l.id}">
        <button class="icon-btn icon-btn--sm" data-act="visible" aria-pressed="${l.visible}" title="${l.visible ? 'Скрыть' : 'Показать'} слой">${icon(l.visible ? 'eye' : 'eyeOff')}</button>
        <button class="icon-btn icon-btn--sm" data-act="lock" aria-pressed="${l.locked}" title="${l.locked ? 'Разблокировать' : 'Заблокировать'} слой">${icon(l.locked ? 'lock' : 'unlock')}</button>
        <input class="layer__name" data-name="${l.id}" value="${escapeAttr(l.name)}" aria-label="Название слоя" maxlength="40">
        <span class="layer__count" title="Объектов в этом кадре">${objects}</span>
        <button class="icon-btn icon-btn--sm" data-act="up" title="Выше" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="icon-btn icon-btn--sm" data-act="down" title="Ниже" ${i === count - 1 ? 'disabled' : ''}>${icon('down')}</button>
        <button class="icon-btn icon-btn--sm" data-act="delete" title="Удалить слой" ${count <= 1 ? 'disabled' : ''}>${icon('trash')}</button>
      </li>`;
    }).join('');
    const layer = this.store.layer;
    if (layer && document.activeElement !== this.opacity) {
      this.opacity.value = String(Math.round(layer.opacity * 100));
    }
    this.el.querySelector('[data-opacity-value]').textContent = `${Math.round((layer?.opacity ?? 1) * 100)}%`;
  }
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
