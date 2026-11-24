// Timeline: playback controls, frame operations, frame rate and frame thumbnails.

import { icon } from './icons.js';
import { addFrame, duplicateFrame, deleteFrame, moveFrame } from '../core/project.js';
import { renderFrame } from '../render/renderer.js';

const FPS_OPTIONS = [4, 6, 8, 12, 15, 24, 30];
const THUMB_HEIGHT = 52;

export class Timeline {
  constructor(store, el, player, { tweenSheet, soundSheet } = {}) {
    this.tweenSheet = tweenSheet;
    this.soundSheet = soundSheet;
    this.store = store;
    this.el = el;
    this.player = player;
    this.thumbTimer = 0;
    el.innerHTML = `
      <div class="timeline__controls">
        <div class="timeline__group">
          <button class="icon-btn" data-act="first" title="К первому кадру">${icon('first')}</button>
          <button class="icon-btn" data-act="prev" title="Предыдущий кадр">${icon('prev')}</button>
          <button class="icon-btn icon-btn--play" data-act="play" title="Воспроизвести (Пробел)"></button>
          <button class="icon-btn" data-act="next" title="Следующий кадр">${icon('next')}</button>
          <span class="timeline__counter" data-counter aria-live="polite"></span>
        </div>
        <div class="timeline__group">
          <button class="icon-btn" data-act="add" title="Новый пустой кадр">${icon('plus')}</button>
          <button class="icon-btn" data-act="dup" title="Дублировать кадр">${icon('copy')}</button>
          <button class="icon-btn" data-act="del" title="Удалить кадр">${icon('trash')}</button>
          <button class="icon-btn" data-act="left" title="Сдвинуть кадр влево">${icon('left')}</button>
          <button class="icon-btn" data-act="right" title="Сдвинуть кадр вправо">${icon('right')}</button>
          <button class="icon-btn" data-act="tween" title="Плавное движение до следующего кадра">${icon('tween')}</button>
        </div>
        <div class="timeline__group">
          <button class="icon-btn" data-act="onion" aria-pressed="false" title="Калька: показать предыдущий кадр">${icon('onion')}</button>
          <button class="icon-btn" data-act="sound" title="Звук и голоса">${icon('music')}</button>
          <button class="icon-btn" data-act="loop" aria-pressed="false" title="Повтор">${icon('loop')}</button>
          <label class="fps" title="Кадров в секунду">
            <select data-fps aria-label="Кадров в секунду">
              ${FPS_OPTIONS.map((f) => `<option value="${f}">${f} к/с</option>`).join('')}
            </select>
          </label>
        </div>
      </div>
      <div class="timeline__frames" data-frames role="listbox" aria-label="Кадры"></div>`;

    this.framesEl = el.querySelector('[data-frames]');
    el.addEventListener('click', (e) => this.onClick(e));
    el.querySelector('[data-fps]').addEventListener('change', (e) => {
      const fps = Number(e.target.value);
      store.mutate((p) => { p.fps = fps; });
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); this.player.toggle(); }
      if (e.key === ',' || e.key === 'ArrowLeft') this.go(this.store.ui.frameIndex - 1);
      if (e.key === '.' || e.key === 'ArrowRight') this.go(this.store.ui.frameIndex + 1);
    });

    store.on('ui', (patch) => {
      this.updateControls();
      if (patch && 'frameIndex' in patch) this.highlight();
    });
    store.on('project', () => {
      this.updateControls();
      this.scheduleThumbs();
    });
    this.updateControls();
    this.buildThumbs();
  }

  go(index) {
    const count = this.store.project.frames.length;
    this.store.setUI({ frameIndex: Math.max(0, Math.min(count - 1, index)), selectedId: null, playing: false });
  }

  onClick(e) {
    const thumb = e.target.closest('[data-frame]');
    if (thumb) return this.go(Number(thumb.dataset.frame));
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { store } = this;
    const i = store.ui.frameIndex;
    const frameOp = (fn) => {
      store.setUI({ playing: false });
      const index = store.mutate(fn);
      store.setUI({ frameIndex: index, selectedId: null });
    };
    switch (btn.dataset.act) {
      case 'first': this.go(0); break;
      case 'prev': this.go(i - 1); break;
      case 'next': this.go(i + 1); break;
      case 'play': this.player.toggle(); break;
      case 'add': frameOp((p) => addFrame(p, i)); break;
      case 'dup': frameOp((p) => duplicateFrame(p, i)); break;
      case 'del': frameOp((p) => deleteFrame(p, i)); break;
      case 'left': frameOp((p) => moveFrame(p, i, -1)); break;
      case 'right': frameOp((p) => moveFrame(p, i, 1)); break;
      case 'tween': this.tweenSheet?.open(); break;
      case 'sound': this.soundSheet?.open(); break;
      case 'onion': store.setUI({ onion: !store.ui.onion }); break;
      case 'loop': store.setUI({ loop: !store.ui.loop }); break;
      default:
    }
  }

  updateControls() {
    const { project, ui } = this.store;
    const q = (s) => this.el.querySelector(s);
    const play = q('[data-act="play"]');
    play.innerHTML = icon(ui.playing ? 'pause' : 'play');
    play.title = ui.playing ? 'Пауза (Пробел)' : 'Воспроизвести (Пробел)';
    play.setAttribute('aria-label', play.title);
    q('[data-counter]').textContent = `${ui.frameIndex + 1} / ${project.frames.length}`;
    q('[data-act="onion"]').setAttribute('aria-pressed', String(ui.onion));
    q('[data-act="loop"]').setAttribute('aria-pressed', String(ui.loop));
    q('[data-act="left"]').disabled = ui.frameIndex === 0;
    q('[data-act="right"]').disabled = ui.frameIndex >= project.frames.length - 1;
    q('[data-act="prev"]').disabled = ui.frameIndex === 0;
    q('[data-act="next"]').disabled = ui.frameIndex >= project.frames.length - 1;
    const fps = q('[data-fps]');
    if (!FPS_OPTIONS.includes(project.fps) && !fps.querySelector(`[value="${project.fps}"]`)) {
      fps.insertAdjacentHTML('beforeend', `<option value="${project.fps}">${project.fps} к/с</option>`);
    }
    fps.value = String(project.fps);
  }

  scheduleThumbs() {
    clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => this.buildThumbs(), 60);
  }

  buildThumbs() {
    const { project } = this.store;
    const width = Math.round((THUMB_HEIGHT * project.width) / project.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const existing = [...this.framesEl.children];
    project.frames.forEach((frame, i) => {
      let item = existing[i];
      if (!item) {
        item = document.createElement('button');
        item.className = 'frame-thumb';
        item.innerHTML = '<canvas></canvas><span></span>';
        this.framesEl.append(item);
      }
      item.dataset.frame = String(i);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-label', `Кадр ${i + 1}`);
      item.querySelector('span').textContent = String(i + 1);
      const canvas = item.querySelector('canvas');
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(THUMB_HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${THUMB_HEIGHT}px`;
      renderFrame(canvas.getContext('2d'), project, i, (width * dpr) / project.width);
    });
    for (const extra of existing.slice(project.frames.length)) extra.remove();
    const starts = new Set((project.audio || []).map((c) => c.startFrame));
    for (const item of this.framesEl.children) {
      item.classList.toggle('has-sound', starts.has(Number(item.dataset.frame)));
    }
    this.highlight();
  }

  highlight() {
    const { frameIndex } = this.store.ui;
    for (const item of this.framesEl.children) {
      const active = Number(item.dataset.frame) === frameIndex;
      item.classList.toggle('is-current', active);
      item.setAttribute('aria-selected', String(active));
      if (active) item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
}
