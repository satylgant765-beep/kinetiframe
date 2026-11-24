// Properties panel: brush settings when nothing is selected, or the selected object's style.

import { icon } from './icons.js';
import { findObject } from '../core/project.js';
import { MOODS } from '../core/objects.js';
import { closeSheet } from './sheets.js';

const PALETTE = [
  '#000000', '#2b2d42', '#868e96', '#ffffff', '#ff5a5f', '#e03131', '#ff922b', '#ffd166',
  '#51cf66', '#2f9e44', '#22b8cf', '#4dabf7', '#1c7ed6', '#7950f2', '#f783ac', '#8d5524',
];
const MOOD_LABELS = { happy: 'Радость', surprised: 'Удивление', sad: 'Грусть', angry: 'Злость' };
const TYPE_LABELS = { stroke: 'Линия', shape: 'Фигура', character: 'Персонаж', scene: 'Фон' };

export class PropsPanel {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    this.live = null;
    el.innerHTML = `
      <header class="panel__header">
        <h2 data-title>Кисть</h2>
        <button class="icon-btn panel__close" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body" data-body></div>`;
    this.body = el.querySelector('[data-body]');
    el.addEventListener('click', (e) => this.onClick(e));
    el.addEventListener('input', (e) => this.onInput(e, false));
    el.addEventListener('change', (e) => this.onInput(e, true));
    store.on('ui', (patch) => { if (patch?.source !== 'props') this.render(); });
    store.on('project', () => { if (!this.live) this.render(); });
    this.render();
  }

  selected() {
    const { project, ui } = this.store;
    return findObject(project, ui.frameIndex, ui.selectedId)?.obj || null;
  }

  render() {
    const obj = this.selected();
    const { ui, project } = this.store;
    this.el.querySelector('[data-title]').textContent = obj ? TYPE_LABELS[obj.type] : 'Кисть и проект';
    if (!obj) {
      this.body.innerHTML = `
        ${palette('Цвет кисти', 'color', ui.color)}
        ${range('Толщина кисти', 'strokeWidth', ui.strokeWidth, 1, 60, 'px')}
        ${range('Размер ластика', 'eraserSize', ui.eraserSize, 6, 120, 'px')}
        ${palette('Заливка новых фигур', 'fill', ui.fill)}
        ${palette('Фон сцены', 'background', project.background)}`;
      return;
    }
    let html = '';
    if (obj.type === 'stroke') {
      html += palette('Цвет линии', 'obj.color', obj.color);
      html += range('Толщина', 'obj.width', obj.width, 1, 80, 'px');
    } else if (obj.type === 'shape') {
      if (obj.kind !== 'line') html += palette('Заливка', 'obj.fill', obj.fill, true);
      html += palette('Контур', 'obj.stroke', obj.stroke, obj.kind !== 'line');
      html += range('Толщина контура', 'obj.strokeWidth', obj.strokeWidth, 0, 40, 'px');
    } else if (obj.type === 'character') {
      html += palette('Основной цвет', 'obj.color', obj.color);
      html += `<div class="field"><span>Эмоция</span><div class="chips">
        ${MOODS.map((m) => `<button class="chip" data-mood="${m}" aria-pressed="${obj.mood === m}">${MOOD_LABELS[m]}</button>`).join('')}
      </div></div>`;
    }
    html += range('Непрозрачность', 'obj.opacity', Math.round(obj.opacity * 100), 5, 100, '%');
    html += range('Поворот', 'obj.rotation', Math.round((obj.rotation * 180) / Math.PI), -180, 180, '°');
    html += range('Масштаб', 'obj.scale', Math.round(Math.abs(obj.sx) * 100), 5, 500, '%');
    this.body.innerHTML = html;
  }

  onClick(e) {
    if (e.target.closest('[data-act="close"]')) return closeSheet(this.el);
    const sw = e.target.closest('[data-color]');
    if (sw) return this.apply(sw.dataset.prop, sw.dataset.color, true);
    const mood = e.target.closest('[data-mood]');
    if (mood) this.apply('obj.mood', mood.dataset.mood, true);
  }

  onInput(e, final) {
    const input = e.target.closest('[data-prop]');
    if (!input || input.matches('button')) return;
    const value = input.type === 'range' ? Number(input.value) : input.value;
    const out = input.closest('.field')?.querySelector('output');
    if (out && input.type === 'range') out.textContent = `${value}${input.dataset.unit || ''}`;
    if (input.type === 'color' && !final) return;
    this.apply(input.dataset.prop, value, final);
  }

  /** Applies a value. Live slider edits share one undo step that ends on `final`. */
  apply(prop, value, final) {
    const { store } = this;
    if (!prop.startsWith('obj.')) {
      if (prop === 'background') store.mutate((p) => { p.background = value; });
      else {
        store.ui[prop] = value;
        store.emit('ui', { [prop]: value, source: 'props' });
      }
      if (final) this.render();
      return;
    }
    const obj = this.selected();
    if (!obj) return;
    if (!this.live) { store.checkpoint(); this.live = obj.id; }
    const key = prop.slice(4);
    if (key === 'opacity') obj.opacity = value / 100;
    else if (key === 'rotation') obj.rotation = (value * Math.PI) / 180;
    else if (key === 'scale') {
      obj.sx = Math.sign(obj.sx || 1) * (value / 100);
      obj.sy = Math.sign(obj.sy || 1) * (value / 100);
    } else obj[key] = value;
    if (key === 'color' && obj.type === 'stroke') store.ui.color = value;
    store.changed();
    if (final) {
      this.live = null;
      this.render();
    }
  }
}

function palette(label, prop, current, allowNone = false) {
  const value = current && current !== 'none' ? current : '#000000';
  return `<div class="field"><span>${label}</span><div class="palette">
    ${allowNone ? `<button class="swatch-btn swatch-btn--none" data-prop="${prop}" data-color="none" aria-pressed="${current === 'none'}" title="Без цвета"></button>` : ''}
    ${PALETTE.map((c) => `<button class="swatch-btn" style="--c:${c}" data-prop="${prop}" data-color="${c}" aria-pressed="${c === current}" title="${c}"></button>`).join('')}
    <label class="swatch-btn swatch-btn--custom" title="Свой цвет"><input type="color" data-prop="${prop}" value="${value}" aria-label="${label}: свой цвет"></label>
  </div></div>`;
}

function range(label, prop, value, min, max, unit) {
  return `<label class="field"><span>${label} <output>${value}${unit}</output></span>
    <input type="range" min="${min}" max="${max}" value="${value}" data-prop="${prop}" data-unit="${unit}"></label>`;
}
