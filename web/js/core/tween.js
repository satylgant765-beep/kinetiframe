// Smooth movement: builds in-between frames from two key frames.
// Objects are matched by id (a duplicated frame keeps its objects' ids), so the usual workflow is
// "duplicate the frame, move or rotate things, then add in-betweens".

import { uid } from './project.js';

export const EASINGS = {
  linear: (t) => t,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  bounce: (t) => {
    const n = 7.5625;
    const d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

const NUMERIC = ['x', 'y', 'sx', 'sy', 'opacity', 'w', 'h', 'width', 'strokeWidth'];
const COLORS = ['color', 'fill', 'stroke'];

const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolates rotation along the shortest way round. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function lerpColor(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return t < 0.5 ? a : b;
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Returns the object between `a` and `b` at progress `t` (0..1, already eased). */
export function interpolateObject(a, b, t) {
  const out = structuredClone(t < 0.5 ? a : b);
  for (const key of NUMERIC) {
    if (typeof a[key] === 'number' && typeof b[key] === 'number') out[key] = lerp(a[key], b[key], t);
  }
  for (const key of COLORS) {
    if (typeof a[key] === 'string' && typeof b[key] === 'string') out[key] = lerpColor(a[key], b[key], t);
  }
  out.rotation = lerpAngle(a.rotation, b.rotation, t);
  if (Array.isArray(a.points) && Array.isArray(b.points) && a.points.length === b.points.length) {
    out.points = a.points.map((v, i) => lerp(v, b.points[i], t));
  }
  return out;
}

/** Builds the contents of one in-between frame. */
export function interpolateFrame(project, from, to, t) {
  const cells = {};
  for (const layer of project.layers) {
    const listA = from.cells[layer.id] || [];
    const listB = to.cells[layer.id] || [];
    const byId = new Map(listB.map((o) => [o.id, o]));
    const result = [];
    for (const a of listA) {
      const b = byId.get(a.id);
      if (b) result.push(interpolateObject(a, b, t));
      else if (t < 0.5) result.push(structuredClone(a)); // Disappears halfway.
    }
    if (t >= 0.5) {
      const idsA = new Set(listA.map((o) => o.id));
      for (const b of listB) if (!idsA.has(b.id)) result.push(structuredClone(b)); // Appears halfway.
    }
    cells[layer.id] = result;
  }
  return { id: uid('frame'), cells };
}

/** Counts objects that exist in both frames, i.e. that will move smoothly. */
export function matchedCount(from, to) {
  let n = 0;
  for (const [layerId, list] of Object.entries(from.cells)) {
    const ids = new Set((to.cells[layerId] || []).map((o) => o.id));
    n += list.filter((o) => ids.has(o.id)).length;
  }
  return n;
}

/**
 * Inserts `count` in-between frames after `index`, moving towards frame `index + 1`.
 * Returns the number of frames inserted.
 */
export function addInbetweens(project, index, count, easing = 'easeInOut') {
  const from = project.frames[index];
  const to = project.frames[index + 1];
  if (!from || !to || count < 1) return 0;
  const ease = EASINGS[easing] || EASINGS.linear;
  const frames = [];
  for (let i = 1; i <= count; i++) frames.push(interpolateFrame(project, from, to, ease(i / (count + 1))));
  project.frames.splice(index + 1, 0, ...frames);
  return count;
}
