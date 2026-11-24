// Project sheet: new, save, open saved projects, import/export files, export video and PNG, install.

import { icon } from './icons.js';
import { createProject } from '../core/project.js';
import { createDemoProject } from '../core/demo.js';
import {
  saveProject, listProjects, loadProject, deleteProject, exportProjectFile, readProjectFile, downloadBlob, fileName,
} from '../services/storage.js';
import { frameToCanvas } from '../render/renderer.js';
import { videoSupport } from '../services/video-export.js';
import { openSheet, closeSheet } from './sheets.js';
import { toast } from './toast.js';

export class ProjectMenu {
  constructor(store, el, { exportDialog }) {
    this.store = store;
    this.el = el;
    this.exportDialog = exportDialog;
    this.installEvent = null;
    const video = videoSupport();
    el.innerHTML = `
      <header class="panel__header">
        <h2>Проект</h2>
        <button class="icon-btn" data-act="close" title="Закрыть">${icon('close')}</button>
      </header>
      <div class="panel__body">
        <div class="menu-list">
          <button class="menu-item" data-act="save">${icon('save')}<span>Сохранить в браузере</span></button>
          <button class="menu-item" data-act="video" ${video ? '' : 'disabled'}>${icon('video')}
            <span>Экспорт видео ${video ? `(${video.ext.toUpperCase()})` : '— не поддерживается этим браузером'}</span></button>
          <button class="menu-item" data-act="png">${icon('image')}<span>Сохранить кадр как PNG</span></button>
          <button class="menu-item" data-act="file">${icon('download')}<span>Скачать файл проекта</span></button>
          <label class="menu-item">${icon('upload')}<span>Открыть файл проекта</span>
            <input type="file" accept=".json,application/json" data-import hidden></label>
          <button class="menu-item" data-act="install" hidden>${icon('install')}<span>Установить приложение</span></button>
        </div>
        <h3 class="sheet__title">Новый проект</h3>
        <div class="chips">
          <button class="chip" data-new="16:9">16:9 Горизонтальный</button>
          <button class="chip" data-new="9:16">9:16 Вертикальный</button>
          <button class="chip" data-new="1:1">1:1 Квадрат</button>
          <button class="chip" data-new="demo">Пример анимации</button>
        </div>
        <h3 class="sheet__title">Мои проекты</h3>
        <ul class="projects" data-projects></ul>
      </div>`;

    el.addEventListener('click', (e) => this.onClick(e));
    el.querySelector('[data-import]').addEventListener('change', (e) => this.importFile(e.target));
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvent = e;
      el.querySelector('[data-act="install"]').hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      el.querySelector('[data-act="install"]').hidden = true;
      toast('Приложение установлено.');
    });
  }

  async open() {
    openSheet(this.el);
    await this.refreshList();
  }

  async refreshList() {
    const list = this.el.querySelector('[data-projects]');
    try {
      const projects = await listProjects();
      list.innerHTML = projects.length ? projects.map((p) => `
        <li class="project-row ${p.id === this.store.project.id ? 'is-current' : ''}">
          <button class="project-row__open" data-open="${p.id}">
            <img src="${p.thumbnail}" alt="">
            <span><strong>${escapeHtml(p.name)}</strong><small>${p.frames} кадр. · ${new Date(p.updatedAt).toLocaleString('ru-RU')}</small></span>
          </button>
          <button class="icon-btn" data-delete="${p.id}" title="Удалить проект">${icon('trash')}</button>
        </li>`).join('') : '<li class="empty">Сохранённых проектов пока нет.</li>';
    } catch (err) {
      list.innerHTML = `<li class="empty">Хранилище браузера недоступно: ${escapeHtml(err.message)}</li>`;
    }
  }

  async onClick(e) {
    const { store } = this;
    const act = e.target.closest('[data-act]')?.dataset.act;
    const newAspect = e.target.closest('[data-new]')?.dataset.new;
    const openId = e.target.closest('[data-open]')?.dataset.open;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    try {
      if (act === 'close') closeSheet(this.el);
      else if (act === 'save') {
        await saveProject(store.project);
        toast('Проект сохранён.');
        await this.refreshList();
      } else if (act === 'video') {
        closeSheet(this.el);
        this.exportDialog.open();
      } else if (act === 'png') {
        const canvas = frameToCanvas(store.project, store.ui.frameIndex, store.project.width);
        canvas.toBlob((blob) => downloadBlob(blob, fileName(store.project, `кадр-${store.ui.frameIndex + 1}.png`)), 'image/png');
      } else if (act === 'file') {
        exportProjectFile(store.project);
      } else if (act === 'install' && this.installEvent) {
        this.installEvent.prompt();
        this.installEvent = null;
        this.el.querySelector('[data-act="install"]').hidden = true;
      } else if (newAspect) {
        await saveProject(store.project);
        store.load(newAspect === 'demo' ? createDemoProject() : createProject({ aspect: newAspect }));
        await saveProject(store.project);
        closeSheet(this.el);
        toast('Создан новый проект. Предыдущий сохранён в «Мои проекты».');
      } else if (openId && openId !== store.project.id) {
        await saveProject(store.project);
        store.load(await loadProject(openId));
        closeSheet(this.el);
        toast(`Открыт проект «${store.project.name}».`);
      } else if (openId) {
        closeSheet(this.el);
      } else if (deleteId) {
        if (deleteId === store.project.id) {
          toast('Это открытый сейчас проект. Сначала откройте или создайте другой.');
          return;
        }
        await deleteProject(deleteId);
        await this.refreshList();
        toast('Проект удалён.');
      }
    } catch (err) {
      toast(err.message || 'Что-то пошло не так.', { error: true });
    }
  }

  async importFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await saveProject(this.store.project);
      const project = await readProjectFile(file);
      this.store.load(project);
      await saveProject(project);
      closeSheet(this.el);
      toast(`Открыт проект «${project.name}».`);
    } catch (err) {
      toast(err.message, { error: true });
    }
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
