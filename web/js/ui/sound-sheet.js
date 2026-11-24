// Sound sheet: add music or sound files, record a voice, make voices with Azure, edit clips.

import { icon } from './icons.js';
import { createClip, preview, stopAll, startRecording } from '../services/audio.js';
import { VOICES, STYLES, loadSettings, saveSettings, synthesize } from '../services/azure-tts.js';
import { openSheet, closeSheet } from './sheets.js';
import { toast } from './toast.js';

export class SoundSheet {
  constructor(store, el) {
    this.store = store;
    this.el = el;
    this.recording = null;
    const settings = loadSettings();
    el.innerHTML = `
      <header class="panel__header">
        <h2>Звук</h2>
        <button class="icon-btn" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body">
        <p class="hint" data-where></p>
        <div class="menu-list">
          <label class="menu-item">${icon('music')}<span>Добавить музыку или звук из файла</span>
            <input type="file" accept="audio/*" data-file hidden></label>
          <button class="menu-item" data-act="record">${icon('mic')}<span data-record-label>Записать голос</span></button>
        </div>

        <h3 class="sheet__title">Голос из текста (Azure)</h3>
        <label class="field"><span>Текст реплики</span>
          <textarea data-tts-text rows="2" maxlength="400" placeholder="Сәлем! Мен мысықпын."></textarea></label>
        <div class="row-2">
          <label class="field"><span>Голос</span>
            <select data-tts-voice>${VOICES.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}</select></label>
          <label class="field"><span>Характер</span>
            <select data-tts-style>${Object.entries(STYLES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select></label>
        </div>
        <button class="btn btn--primary" data-act="tts">${icon('mic')}<span>Озвучить</span></button>
        <details class="settings" ${settings.key ? '' : 'open'}>
          <summary>Настройки Azure</summary>
          <p class="hint">Ключ и регион ресурса Speech из портала Azure (раздел «Ключи и конечная точка»). Они хранятся только в этом браузере и не попадают в файл проекта.</p>
          <label class="field"><span>Ключ</span><input type="password" data-azure-key autocomplete="off" value="${escapeAttr(settings.key)}"></label>
          <label class="field"><span>Регион</span><input data-azure-region placeholder="westeurope" autocomplete="off" value="${escapeAttr(settings.region)}"></label>
          <button class="btn" data-act="save-azure">Сохранить</button>
        </details>

        <h3 class="sheet__title">Звуки в проекте</h3>
        <ul class="clips" data-clips></ul>
      </div>`;

    el.addEventListener('click', (e) => this.onClick(e));
    el.querySelector('[data-file]').addEventListener('change', (e) => this.addFile(e.target));
    el.querySelector('[data-clips]').addEventListener('change', (e) => this.onClipChange(e));
    store.on('project', () => { if (this.el.classList.contains('is-open')) this.render(); });
    store.on('ui', (patch) => { if (patch && 'frameIndex' in patch) this.renderWhere(); });
  }

  open() {
    this.store.setUI({ playing: false });
    this.render();
    openSheet(this.el);
  }

  renderWhere() {
    this.el.querySelector('[data-where]').textContent = `Новый звук начнётся с текущего кадра (${this.store.ui.frameIndex + 1}). Начальный кадр можно поменять в списке ниже.`;
  }

  render() {
    this.renderWhere();
    const { project } = this.store;
    const clips = project.audio || [];
    const list = this.el.querySelector('[data-clips]');
    list.innerHTML = clips.length ? clips.map((c) => `
      <li class="clip" data-clip="${c.id}">
        <div class="clip__head">
          <button class="icon-btn icon-btn--sm" data-act="preview" title="Прослушать">${icon('play')}</button>
          <strong>${escapeHtml(c.name)}</strong>
          <small>${c.duration.toFixed(1)} с</small>
          <button class="icon-btn icon-btn--sm" data-act="delete-clip" title="Удалить звук">${icon('trash')}</button>
        </div>
        <div class="row-2">
          <label class="field"><span>С кадра</span>
            <input type="number" min="1" max="${project.frames.length}" value="${c.startFrame + 1}" data-start></label>
          <label class="field"><span>Громкость <output>${Math.round(c.volume * 100)}%</output></span>
            <input type="range" min="0" max="150" value="${Math.round(c.volume * 100)}" data-volume></label>
        </div>
      </li>`).join('') : '<li class="empty">Звуков пока нет.</li>';
  }

  async onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const clipId = e.target.closest('[data-clip]')?.dataset.clip;
    const clip = (this.store.project.audio || []).find((c) => c.id === clipId);
    try {
      if (act === 'close') { stopAll(); closeSheet(this.el); }
      if (act === 'record') await this.toggleRecording();
      if (act === 'tts') await this.speak();
      if (act === 'save-azure') this.saveAzure();
      if (act === 'preview' && clip) await preview(clip);
      if (act === 'delete-clip' && clip) {
        this.store.mutate((p) => { p.audio = p.audio.filter((c) => c.id !== clip.id); });
        toast('Звук удалён. Вернуть: кнопка «Назад».');
      }
    } catch (err) {
      toast(err.message, { error: true, duration: 5000 });
    }
  }

  onClipChange(e) {
    const clipId = e.target.closest('[data-clip]')?.dataset.clip;
    if (!clipId) return;
    const value = Number(e.target.value);
    this.store.mutate((p) => {
      const clip = p.audio.find((c) => c.id === clipId);
      if (e.target.matches('[data-start]')) clip.startFrame = Math.max(0, Math.min(p.frames.length - 1, Math.round(value) - 1));
      if (e.target.matches('[data-volume]')) clip.volume = value / 100;
    });
  }

  addClip(clip) {
    this.store.mutate((p) => { p.audio = [...(p.audio || []), clip]; });
    toast(`Звук «${clip.name}» добавлен с кадра ${clip.startFrame + 1}.`);
  }

  async addFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.addClip(await createClip(file, file.name.replace(/\.[^.]+$/, ''), this.store.ui.frameIndex));
    } catch (err) {
      toast(err.message, { error: true, duration: 5000 });
    }
  }

  async toggleRecording() {
    const label = this.el.querySelector('[data-record-label]');
    const button = this.el.querySelector('[data-act="record"]');
    if (!this.recording) {
      this.recording = await startRecording();
      label.textContent = 'Остановить запись';
      button.classList.add('is-recording');
      return;
    }
    const blob = await this.recording.stop();
    this.recording = null;
    label.textContent = 'Записать голос';
    button.classList.remove('is-recording');
    const count = (this.store.project.audio || []).length + 1;
    this.addClip(await createClip(blob, `Голос ${count}`, this.store.ui.frameIndex));
  }

  async speak() {
    const button = this.el.querySelector('[data-act="tts"]');
    const text = this.el.querySelector('[data-tts-text]').value;
    const voice = this.el.querySelector('[data-tts-voice]').value;
    const style = this.el.querySelector('[data-tts-style]').value;
    button.disabled = true;
    try {
      const blob = await synthesize(text, voice, style);
      const name = text.trim().slice(0, 30) + (text.trim().length > 30 ? '…' : '');
      const clip = await createClip(blob, name, this.store.ui.frameIndex);
      this.addClip(clip);
      await preview(clip);
    } finally {
      button.disabled = false;
    }
  }

  saveAzure() {
    const key = this.el.querySelector('[data-azure-key]').value;
    const region = this.el.querySelector('[data-azure-region]').value;
    if (!key.trim() || !region.trim()) { toast('Заполните ключ и регион.', { error: true }); return; }
    if (saveSettings({ key, region })) {
      toast('Настройки Azure сохранены на этом устройстве.');
      this.el.querySelector('details.settings').open = false;
    } else {
      toast('Браузер не разрешил сохранить настройки.', { error: true });
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}
