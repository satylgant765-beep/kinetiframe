// Sheet for adding shapes and cartoon characters to the active layer of the current frame.

import { icon } from './icons.js';
import { SHAPES, CHARACTERS, createShape, createCharacter, createScene } from '../core/objects.js';
import { SCENES } from '../render/scenes.js';
import { getCell } from '../core/project.js';
import { drawObject } from '../render/renderer.js';
import { closeSheet } from './sheets.js';
import { toast } from './toast.js';

const SHAPE_LABELS = {
  rect: 'Прямоугольник', roundRect: 'Скруглённый', ellipse: 'Круг', triangle: 'Треугольник',
  star: 'Звезда', heart: 'Сердце', arrow: 'Стрелка', line: 'Линия',
};
const SCENE_LABELS = { meadow: 'Луг', city: 'Город', night: 'Ночь', sea: 'Море', forest: 'Лес', room: 'Комната' };
const CHARACTER_LABELS = { cat: 'Кот', robot: 'Робот', kid: 'Ребёнок', monster: 'Монстрик', bird: 'Птичка', dog: 'Собака', girl: 'Девочка', alien: 'Инопланетянин' };

export class InsertSheet {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    el.innerHTML = `
      <header class="panel__header">
        <h2>Добавить</h2>
        <button class="icon-btn" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body">
        <h3 class="sheet__title">Персонажи</h3>
        <div class="grid" data-characters>
          ${CHARACTERS.map((k) => `<button class="grid__item" data-character="${k}"><canvas width="96" height="96"></canvas><span>${CHARACTER_LABELS[k]}</span></button>`).join('')}
        </div>
        <h3 class="sheet__title">Фоны <small>добавляются во все кадры, на нижний слой</small></h3>
        <div class="grid grid--wide" data-scenes>
          ${SCENES.map((k) => `<button class="grid__item" data-scene="${k}"><canvas width="128" height="72"></canvas><span>${SCENE_LABELS[k]}</span></button>`).join('')}
        </div>
        <h3 class="sheet__title">Фигуры</h3>
        <div class="grid" data-shapes>
          ${SHAPES.map((k) => `<button class="grid__item" data-shape="${k}"><canvas width="96" height="96"></canvas><span>${SHAPE_LABELS[k]}</span></button>`).join('')}
        </div>
      </div>`;
    this.renderPreviews();
    el.addEventListener('click', (e) => this.onClick(e));
    store.on('ui', (patch) => { if (patch && ('fill' in patch || 'color' in patch)) this.renderPreviews(); });
  }

  style() {
    const { ui } = this.store;
    return { fill: ui.fill, stroke: '#2b2d42', strokeWidth: 4 };
  }

  renderPreviews() {
    for (const btn of this.el.querySelectorAll('[data-scene]')) {
      const canvas = btn.querySelector('canvas');
      const scene = createScene(btn.dataset.scene, canvas.width, canvas.height);
      drawObject(canvas.getContext('2d'), scene);
    }
    for (const btn of this.el.querySelectorAll('[data-shape], [data-character]')) {
      const canvas = btn.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 96, 96);
      const obj = btn.dataset.shape
        ? createShape(btn.dataset.shape, 48, 48, this.style())
        : createCharacter(btn.dataset.character, 48, 48);
      const scale = 72 / Math.max(obj.w, obj.h, 1);
      obj.sx = scale;
      obj.sy = scale;
      drawObject(ctx, obj);
    }
  }

  onClick(e) {
    if (e.target.closest('[data-act="close"]')) return closeSheet(this.el);
    const scene = e.target.closest('[data-scene]');
    if (scene) return this.addScene(scene.dataset.scene);
    const shape = e.target.closest('[data-shape]');
    const character = e.target.closest('[data-character]');
    if (!shape && !character) return;
    const { store } = this;
    const layer = store.layer;
    if (!layer || layer.locked || !layer.visible) {
      toast('Активный слой скрыт или заблокирован. Выберите другой слой.', { error: true });
      return;
    }
    const { width, height } = store.project;
    // Offset each new object a little so repeated inserts do not stack exactly.
    const count = getCell(store.project, store.ui.frameIndex, layer.id).length;
    const x = width / 2 + ((count % 5) - 2) * 24;
    const y = height / 2 + ((count % 5) - 2) * 18;
    const obj = shape ? createShape(shape.dataset.shape, x, y, this.style()) : createCharacter(character.dataset.character, x, y);
    store.mutate((p) => getCell(p, store.ui.frameIndex, layer.id).push(obj));
    store.setUI({ selectedId: obj.id, tool: 'select', playing: false });
    closeSheet(this.el);
  }

  /** Puts the scene at the back of the bottom layer in every frame, replacing an older scene. */
  addScene(kind) {
    const { store } = this;
    const layer = store.project.layers[0];
    if (layer.locked || !layer.visible) {
      toast(`Нижний слой «${layer.name}» скрыт или заблокирован. Включите его, чтобы добавить фон.`, { error: true });
      return;
    }
    const { width, height } = store.project;
    const scene = createScene(kind, width, height);
    store.mutate((p) => {
      for (let i = 0; i < p.frames.length; i++) {
        const cell = getCell(p, i, layer.id);
        const kept = cell.filter((o) => o.type !== 'scene');
        cell.length = 0;
        cell.push({ ...scene }, ...kept);
      }
    });
    store.setUI({ selectedId: null, playing: false });
    closeSheet(this.el);
    toast('Фон добавлен во все кадры. Чтобы случайно не сдвинуть его, заблокируйте слой.');
  }
}
