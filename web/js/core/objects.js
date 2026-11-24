// Scene objects (strokes, shapes, characters) and the geometry used to select and edit them.
// Every object has a centre (x, y), rotation in radians, scale (sx, sy) and opacity.
// Its geometry is stored in local coordinates around (0, 0).

import { uid } from './project.js';

export const SHAPES = ['rect', 'roundRect', 'ellipse', 'triangle', 'star', 'heart', 'arrow', 'line'];
export const CHARACTERS = ['cat', 'robot', 'kid', 'monster', 'bird'];
export const MOODS = ['happy', 'surprised', 'sad', 'angry'];

function base(type, x, y) {
  return { id: uid('obj'), type, x, y, rotation: 0, sx: 1, sy: 1, opacity: 1 };
}

/** Builds a stroke from world-space points [x0, y0, x1, y1, ...]. */
export function createStroke(points, { color, width }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const local = points.map((v, i) => Math.round((i % 2 === 0 ? v - cx : v - cy) * 10) / 10);
  return { ...base('stroke', cx, cy), points: local, color, width };
}

export function createShape(kind, x, y, { fill, stroke, strokeWidth }) {
  const size = { line: [220, 0], arrow: [220, 90], rect: [200, 140], roundRect: [200, 140] }[kind] || [170, 170];
  return { ...base('shape', x, y), kind, w: size[0], h: size[1], fill, stroke, strokeWidth };
}

export const CHARACTER_COLORS = { cat: '#ff9f43', robot: '#7aa2f7', kid: '#4dabf7', monster: '#7bd88f', bird: '#ff6b81' };

export function createCharacter(kind, x, y) {
  return { ...base('character', x, y), kind, w: 200, h: 260, color: CHARACTER_COLORS[kind] || '#ff9f43', mood: 'happy' };
}

/** Local bounding box of an object: { x, y, w, h } with (0,0) at the object's centre. */
export function localBounds(obj) {
  if (obj.type === 'stroke') {
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (let i = 0; i < obj.points.length; i += 2) {
      minX = Math.min(minX, obj.points[i]); maxX = Math.max(maxX, obj.points[i]);
      minY = Math.min(minY, obj.points[i + 1]); maxY = Math.max(maxY, obj.points[i + 1]);
    }
    const pad = obj.width / 2;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  const pad = obj.type === 'shape' ? (obj.strokeWidth || 0) / 2 : 0;
  const h = Math.max(obj.h, 2);
  return { x: -obj.w / 2 - pad, y: -h / 2 - pad, w: obj.w + pad * 2, h: h + pad * 2 };
}

/** Converts a world point into the object's local coordinates. */
export function toLocal(obj, px, py) {
  const dx = px - obj.x;
  const dy = py - obj.y;
  const cos = Math.cos(-obj.rotation);
  const sin = Math.sin(-obj.rotation);
  return { x: (dx * cos - dy * sin) / (obj.sx || 1), y: (dx * sin + dy * cos) / (obj.sy || 1) };
}

/** Converts a local point into world coordinates. */
export function toWorld(obj, lx, ly) {
  const x = lx * obj.sx;
  const y = ly * obj.sy;
  const cos = Math.cos(obj.rotation);
  const sin = Math.sin(obj.rotation);
  return { x: obj.x + x * cos - y * sin, y: obj.y + x * sin + y * cos };
}

/** World-space corners of the object's bounds: top-left, top-right, bottom-right, bottom-left. */
export function worldCorners(obj) {
  const b = localBounds(obj);
  return [
    toWorld(obj, b.x, b.y),
    toWorld(obj, b.x + b.w, b.y),
    toWorld(obj, b.x + b.w, b.y + b.h),
    toWorld(obj, b.x, b.y + b.h),
  ];
}

/** Whether a world point hits the object. `tolerance` is in world units. */
export function hitTest(obj, px, py, tolerance = 0) {
  const p = toLocal(obj, px, py);
  const scale = Math.max(Math.abs(obj.sx), Math.abs(obj.sy), 0.01);
  const tol = tolerance / scale;
  if (obj.type === 'stroke') return distanceToStroke(obj, p.x, p.y) <= obj.width / 2 + tol;
  const b = localBounds(obj);
  return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
}

export function distanceToStroke(obj, lx, ly) {
  const pts = obj.points;
  if (pts.length < 4) return Math.hypot(lx - pts[0], ly - pts[1]);
  let best = Infinity;
  for (let i = 0; i < pts.length - 2; i += 2) {
    best = Math.min(best, segmentDistance(lx, ly, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]));
  }
  return best;
}

export function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
