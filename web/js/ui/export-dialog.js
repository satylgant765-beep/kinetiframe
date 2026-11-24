// Dialog that records the animation to a video, shows progress and offers download or share.

import { icon } from './icons.js';
import { exportVideo, videoSupport } from '../services/video-export.js';
import { downloadBlob, fileName } from '../services/storage.js';
import { openSheet, closeSheet } from './sheets.js';

export class ExportDialog {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    this.el.dataset.modal = 'true';
    this.result = null;
    this.abort = null;
    el.innerHTML = `
      <header class="panel__header"><h2>Экспорт видео</h2></header>
      <div class="panel__body">
        <div data-setup>
          <label class="field"><span>Качество</span>
            <select data-size>
              <option value="720">720p — быстрее, меньше файл</option>
              <option value="1280" selected>HD 1280</option>
              <option value="1920">Full HD 1920</option>
            </select>
          </label>
          <label class="field"><span>Сколько раз повторить анимацию</span>
            <select data-repeat>
              ${[1, 2, 3, 5, 10].map((n) => `<option value="${n}">${n}×</option>`).join('')}
            </select>
          </label>
          <p class="hint" data-info></p>
        </div>
        <div data-progress hidden>
          <progress max="1" value="0"></progress>
          <p class="hint" data-status>Записываю…</p>
        </div>
        <div class="dialog__actions">
          <button class="btn" data-act="cancel">Закрыть</button>
          <button class="btn btn--primary" data-act="start">${icon('video')}<span>Записать</span></button>
          <button class="btn" data-act="share" hidden>${icon('share')}<span>Поделиться</span></button>
          <button class="btn btn--primary" data-act="download" hidden>${icon('download')}<span>Скачать</span></button>
        </div>
      </div>`;
    el.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'cancel') this.cancel();
      if (act === 'start') this.start();
      if (act === 'download') this.download();
      if (act === 'share') this.share();
    });
  }

  q(s) { return this.el.querySelector(s); }

  open() {
    const { project } = this.store;
    const seconds = project.frames.length / project.fps;
    const support = videoSupport();
    this.result = null;
    this.q('[data-setup]').hidden = false;
    this.q('[data-progress]').hidden = true;
    this.q('[data-act="start"]').hidden = false;
    this.q('[data-act="download"]').hidden = true;
    this.q('[data-act="share"]').hidden = true;
    this.q('[data-act="cancel"]').textContent = 'Закрыть';
    this.q('[data-info]').textContent = `${project.frames.length} кадр., ${project.fps} к/с — ${seconds.toFixed(1)} с за один проход. `
      + `Формат: ${support ? support.ext.toUpperCase() : 'нет'}. Запись идёт в реальном времени, не закрывайте вкладку.`;
    this.store.setUI({ playing: false });
    openSheet(this.el);
  }

  async start() {
    const { project } = this.store;
    this.abort = new AbortController();
    this.q('[data-setup]').hidden = true;
    this.q('[data-progress]').hidden = false;
    this.q('[data-act="start"]').hidden = true;
    this.q('[data-act="cancel"]').textContent = 'Отмена';
    const bar = this.q('progress');
    const status = this.q('[data-status]');
    try {
      this.result = await exportVideo(project, {
        maxSide: Number(this.q('[data-size]').value),
        repeat: Number(this.q('[data-repeat]').value),
        signal: this.abort.signal,
        onProgress: (v) => { bar.value = v; status.textContent = `Записываю… ${Math.round(v * 100)}%`; },
      });
      const kb = this.result.blob.size / 1024;
      const size = kb < 1024 ? `${Math.max(1, Math.round(kb))} КБ` : `${(kb / 1024).toFixed(1)} МБ`;
      status.textContent = `Готово: ${this.result.ext.toUpperCase()}, ${size}.`;
      this.q('[data-act="download"]').hidden = false;
      this.q('[data-act="share"]').hidden = !this.canShare();
      this.q('[data-act="cancel"]').textContent = 'Закрыть';
    } catch (err) {
      status.textContent = err.name === 'AbortError' ? 'Экспорт отменён.' : `Ошибка: ${err.message}`;
      this.q('[data-act="cancel"]').textContent = 'Закрыть';
    } finally {
      this.abort = null;
    }
  }

  file() {
    const { blob, ext } = this.result;
    return new File([blob], fileName(this.store.project, ext), { type: blob.type });
  }

  canShare() {
    try { return Boolean(navigator.canShare?.({ files: [this.file()] })); } catch { return false; }
  }

  download() {
    if (this.result) downloadBlob(this.result.blob, fileName(this.store.project, this.result.ext));
  }

  async share() {
    try { await navigator.share({ files: [this.file()], title: this.store.project.name }); } catch { /* user closed the share sheet */ }
  }

  cancel() {
    if (this.abort) { this.abort.abort(); return; }
    closeSheet(this.el);
  }
}
