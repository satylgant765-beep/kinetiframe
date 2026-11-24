// Saves projects in the browser (IndexedDB) and imports/exports project files.

import { serialize, deserialize } from '../core/project.js';
import { frameToCanvas } from '../render/renderer.js';

const DB_NAME = 'temirlan-animation-studio';
const STORE = 'projects';
const LAST_KEY = 'tas:lastProjectId';

let dbPromise;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(mode, fn) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const t = database.transaction(STORE, mode);
    const result = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Не удалось сохранить: хранилище браузера недоступно.'));
  });
}

export async function saveProject(project) {
  const thumbnail = frameToCanvas(project, 0, 240).toDataURL('image/jpeg', 0.7);
  const record = {
    id: project.id,
    name: project.name,
    updatedAt: Date.now(),
    frames: project.frames.length,
    thumbnail,
    data: serialize(project),
  };
  await tx('readwrite', (s) => s.put(record));
  rememberLast(project.id);
  return record;
}

export async function listProjects() {
  const records = await tx('readonly', (s) => s.getAll());
  return records
    .map(({ id, name, updatedAt, frames, thumbnail }) => ({ id, name, updatedAt, frames, thumbnail }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id) {
  const record = await tx('readonly', (s) => s.get(id));
  if (!record) throw new Error('Проект не найден.');
  rememberLast(id);
  return deserialize(record.data);
}

export async function deleteProject(id) {
  await tx('readwrite', (s) => s.delete(id));
}

export function lastProjectId() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

function rememberLast(id) {
  try { localStorage.setItem(LAST_KEY, id); } catch { /* storage may be blocked */ }
}

export function fileName(project, ext) {
  const safe = project.name.replace(/[\\/:*?"<>|]+/g, '').trim() || 'animation';
  return `${safe}.${ext}`;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function exportProjectFile(project) {
  const blob = new Blob([serialize(project)], { type: 'application/json' });
  downloadBlob(blob, fileName(project, 'tas.json'));
}

export async function readProjectFile(file) {
  const text = await file.text();
  const project = deserialize(text);
  return project;
}
