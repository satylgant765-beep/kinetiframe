// Application entry point: restores the last project and wires the components together.

import { createProject } from './core/project.js';
import { Store } from './core/store.js';
import { Player } from './core/player.js';
import { Stage } from './ui/stage.js';
import { Toolbar } from './ui/toolbar.js';
import { Timeline } from './ui/timeline.js';
import { LayersPanel } from './ui/layers-panel.js';
import { PropsPanel } from './ui/props-panel.js';
import { InsertSheet } from './ui/insert-sheet.js';
import { ContextBar } from './ui/context-bar.js';
import { ProjectMenu } from './ui/project-menu.js';
import { ExportDialog } from './ui/export-dialog.js';
import { icon } from './ui/icons.js';
import { toast } from './ui/toast.js';
import { saveProject, loadProject, lastProjectId } from './services/storage.js';

const $ = (id) => document.getElementById(id);

async function restore() {
  const id = lastProjectId();
  if (!id) return null;
  try { return await loadProject(id); } catch { return null; }
}

async function main() {
  const project = (await restore()) || createProject();
  const store = new Store(project);
  const player = new Player(store);

  const stage = new Stage(store, $('stage'));
  const layersPanel = new LayersPanel(store, $('layers-panel'));
  const propsPanel = new PropsPanel(store, $('props-panel'));
  const insertSheet = new InsertSheet(store, $('insert-sheet'));
  const exportDialog = new ExportDialog(store, $('export-dialog'));
  const projectMenu = new ProjectMenu(store, $('project-sheet'), { exportDialog });
  new Toolbar(store, $('toolbar'), { insertSheet: insertSheet.el, propsPanel: propsPanel.el, layersPanel: layersPanel.el });
  new Timeline(store, $('timeline'), player);
  new ContextBar(store, $('context-bar'));

  setupTopbar(store, projectMenu);
  setupZoom(stage);
  setupAutosave(store);
  window.tas = { store, stage }; // Handy for debugging from the browser console.
  document.body.classList.add('is-ready');
}

function setupTopbar(store, projectMenu) {
  const undo = $('undo-btn');
  const redo = $('redo-btn');
  const name = $('project-name');
  undo.innerHTML = icon('undo');
  redo.innerHTML = icon('redo');
  $('menu-btn').innerHTML = icon('menu');
  undo.addEventListener('click', () => store.undo());
  redo.addEventListener('click', () => store.redo());
  $('menu-btn').addEventListener('click', () => projectMenu.open());

  const syncHistory = () => {
    undo.disabled = !store.canUndo();
    redo.disabled = !store.canRedo();
  };
  store.on('history', syncHistory);
  syncHistory();

  const syncName = () => { if (document.activeElement !== name) name.value = store.project.name; };
  store.on('project', syncName);
  syncName();
  name.addEventListener('change', () => {
    const value = name.value.trim() || 'Без названия';
    store.mutate((p) => { p.name = value; });
    name.blur();
  });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); store.redo(); }
    if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); saveProject(store.project).then(() => toast('Проект сохранён.')); }
  });
}

function setupZoom(stage) {
  const host = $('zoom-controls');
  host.innerHTML = `
    <button class="icon-btn" data-z="out" title="Уменьшить">${icon('zoomOut')}</button>
    <button class="icon-btn" data-z="fit" title="Вписать в экран">${icon('fit')}</button>
    <button class="icon-btn" data-z="in" title="Увеличить">${icon('zoomIn')}</button>`;
  host.addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]')?.dataset.z;
    if (z === 'in') stage.zoomBy(1.25);
    if (z === 'out') stage.zoomBy(0.8);
    if (z === 'fit') stage.fit();
  });
}

/** Saves the open project shortly after each change, and when the app goes to the background. */
function setupAutosave(store) {
  let timer = 0;
  let dirty = false;
  const save = async () => {
    if (!dirty) return;
    dirty = false;
    try { await saveProject(store.project); } catch (err) { console.warn('Autosave failed', err); }
  };
  store.on('project', () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(save, 1500);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker not registered', err));
}

main().catch((err) => {
  console.error(err);
  toast(`Ошибка запуска: ${err.message}`, { error: true, duration: 8000 });
});
registerServiceWorker();
