// Tool selection plus buttons that open the insert sheet, properties and layers.

import { icon } from './icons.js';
import { openSheet, toggleSheet, isOpen, onSheetsChange } from './sheets.js';

const TOOLS = [
  { id: 'select', label: 'Выбор', icon: 'select', key: 'v' },
  { id: 'pen', label: 'Кисть', icon: 'pen', key: 'b' },
  { id: 'eraser', label: 'Ластик', icon: 'eraser', key: 'e' },
  { id: 'hand', label: 'Рука', icon: 'hand', key: 'h' },
];

export class Toolbar {
  constructor(store, el, { insertSheet, propsPanel, layersPanel }) {
    this.store = store;
    this.el = el;
    this.sheets = { insert: insertSheet, props: propsPanel, layers: layersPanel };
    el.innerHTML = `
      <div class="toolbar__group" role="toolbar" aria-label="Инструменты">
        ${TOOLS.map((t) => `
          <button class="tool" data-tool="${t.id}" aria-pressed="false" title="${t.label} (${t.key.toUpperCase()})">
            ${icon(t.icon)}<span>${t.label}</span>
          </button>`).join('')}
      </div>
      <div class="toolbar__sep"></div>
      <div class="toolbar__group">
        <button class="tool tool--accent" data-open="insert" title="Добавить фигуру или персонажа">
          ${icon('plus')}<span>Добавить</span>
        </button>
        <button class="tool" data-open="props" title="Цвет и свойства">
          <span class="swatch" data-swatch></span><span>Цвет</span>
        </button>
        <button class="tool tool--mobile" data-open="layers" title="Слои">
          ${icon('layers')}<span>Слои</span>
        </button>
      </div>`;

    el.addEventListener('click', (e) => {
      const tool = e.target.closest('[data-tool]');
      if (tool) store.setUI({ tool: tool.dataset.tool });
      const open = e.target.closest('[data-open]');
      if (open) {
        const sheet = this.sheets[open.dataset.open];
        if (open.dataset.open === 'insert') openSheet(sheet); else toggleSheet(sheet);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey) return;
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) store.setUI({ tool: t.id });
    });

    store.on('ui', () => this.update());
    onSheetsChange(() => this.update());
    this.update();
  }

  update() {
    const { ui } = this.store;
    for (const btn of this.el.querySelectorAll('[data-tool]')) {
      btn.setAttribute('aria-pressed', String(btn.dataset.tool === ui.tool));
    }
    for (const btn of this.el.querySelectorAll('[data-open]')) {
      btn.classList.toggle('is-active', isOpen(this.sheets[btn.dataset.open]));
    }
    this.el.querySelector('[data-swatch]').style.background = ui.color;
  }
}
