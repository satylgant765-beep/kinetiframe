// Project data model: frames, layers, objects and (de)serialization.
// Pure functions with no DOM access, so they can be unit-tested in Node.

export const FORMAT = 'temirlan-animation-studio';
export const FORMAT_VERSION = 1;

export const ASPECTS = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 1080, height: 1080 },
};

let counter = 0;
export function uid(prefix = 'id') {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createLayer(name) {
  return { id: uid('layer'), name, visible: true, locked: false, opacity: 1 };
}

export function createFrame(layers) {
  const cells = {};
  for (const layer of layers) cells[layer.id] = [];
  return { id: uid('frame'), cells };
}

export function createProject({ name = 'Мой мультфильм', aspect = '16:9', fps = 12, background = '#ffffff' } = {}) {
  const size = ASPECTS[aspect] || ASPECTS['16:9'];
  const layers = [createLayer('Фон'), createLayer('Слой 1')];
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    id: uid('project'),
    name,
    width: size.width,
    height: size.height,
    fps,
    background,
    layers,
    frames: [createFrame(layers)],
    audio: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function getCell(project, frameIndex, layerId) {
  const frame = project.frames[frameIndex];
  if (!frame) return [];
  if (!frame.cells[layerId]) frame.cells[layerId] = [];
  return frame.cells[layerId];
}

export function cloneObject(obj) {
  const copy = structuredClone(obj);
  copy.id = uid('obj');
  return copy;
}

export function cloneFrame(frame) {
  const cells = {};
  for (const [layerId, objects] of Object.entries(frame.cells)) {
    // Keep object ids across duplicated frames: it lets the user track "the same" object.
    cells[layerId] = objects.map((o) => structuredClone(o));
  }
  return { id: uid('frame'), cells };
}

/** Inserts an empty frame after `afterIndex`. Background scenes are carried over. */
export function addFrame(project, afterIndex) {
  const frame = createFrame(project.layers);
  const source = project.frames[afterIndex];
  if (source) {
    for (const layer of project.layers) {
      frame.cells[layer.id] = (source.cells[layer.id] || []).filter((o) => o.type === 'scene').map((o) => structuredClone(o));
    }
  }
  project.frames.splice(afterIndex + 1, 0, frame);
  return afterIndex + 1;
}

export function duplicateFrame(project, index) {
  const copy = cloneFrame(project.frames[index]);
  project.frames.splice(index + 1, 0, copy);
  return index + 1;
}

export function deleteFrame(project, index) {
  if (project.frames.length <= 1) {
    project.frames[0] = createFrame(project.layers);
    return 0;
  }
  project.frames.splice(index, 1);
  return Math.min(index, project.frames.length - 1);
}

export function moveFrame(project, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= project.frames.length) return index;
  const [frame] = project.frames.splice(index, 1);
  project.frames.splice(target, 0, frame);
  return target;
}

export function addLayer(project, name) {
  const layer = createLayer(name || `Слой ${project.layers.length}`);
  project.layers.push(layer);
  for (const frame of project.frames) frame.cells[layer.id] = [];
  return layer;
}

export function deleteLayer(project, layerId) {
  if (project.layers.length <= 1) return false;
  project.layers = project.layers.filter((l) => l.id !== layerId);
  for (const frame of project.frames) delete frame.cells[layerId];
  return true;
}

export function moveLayer(project, layerId, delta) {
  const index = project.layers.findIndex((l) => l.id === layerId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= project.layers.length) return false;
  const [layer] = project.layers.splice(index, 1);
  project.layers.splice(target, 0, layer);
  return true;
}

/** Finds an object by id in a frame. Returns { obj, layerId, list, index } or null. */
export function findObject(project, frameIndex, objectId) {
  const frame = project.frames[frameIndex];
  if (!frame || !objectId) return null;
  for (const [layerId, list] of Object.entries(frame.cells)) {
    const index = list.findIndex((o) => o.id === objectId);
    if (index >= 0) return { obj: list[index], layerId, list, index };
  }
  return null;
}

export function serialize(project) {
  return JSON.stringify({ ...project, updatedAt: Date.now() });
}

/** Parses and validates a project file. Throws an Error with a readable message. */
export function deserialize(text) {
  let data;
  try {
    data = typeof text === 'string' ? JSON.parse(text) : text;
  } catch {
    throw new Error('Файл повреждён или это не проект.');
  }
  if (!data || data.format !== FORMAT) throw new Error('Это не проект Temirlan Animation Studio.');
  if (data.version > FORMAT_VERSION) throw new Error('Проект создан в более новой версии приложения.');
  if (!Array.isArray(data.layers) || !data.layers.length || !Array.isArray(data.frames) || !data.frames.length) {
    throw new Error('В проекте нет кадров или слоёв.');
  }
  for (const frame of data.frames) {
    frame.cells = frame.cells || {};
    for (const layer of data.layers) if (!Array.isArray(frame.cells[layer.id])) frame.cells[layer.id] = [];
  }
  data.audio = (Array.isArray(data.audio) ? data.audio : [])
    .filter((c) => c && typeof c.src === 'string' && c.src.startsWith('data:audio/'))
    .map((c) => ({
      ...c,
      name: String(c.name || 'Звук'),
      startFrame: clampNumber(c.startFrame, 0, data.frames.length - 1, 0),
      volume: clampNumber(c.volume, 0, 2, 1),
      duration: clampNumber(c.duration, 0, 36000, 0),
    }));
  data.fps = clampNumber(data.fps, 1, 60, 12);
  data.width = clampNumber(data.width, 64, 4096, 1280);
  data.height = clampNumber(data.height, 64, 4096, 720);
  return data;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
