// The drawing stage: renders the current frame and handles touch, pen and mouse input
// for drawing, erasing, selecting, moving, rotating, scaling and zooming.

import { drawFrameContent, drawObject } from '../render/renderer.js';
import { createStroke, hitTest, toWorld, worldCorners } from '../core/objects.js';
import { getCell, findObject } from '../core/project.js';
import { toast } from './toast.js';

const HANDLE_RADIUS = 11;
const HANDLE_HIT = 26;
const ROTATE_OFFSET = 38;

export class Stage {
  constructor(store, container) {
    this.store = store;
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage__canvas';
    this.canvas.setAttribute('aria-label', 'Холст анимации');
    container.prepend(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.pointers = new Map();
    this.gesture = null;
    this.draft = null;
    this.cursor = null;
    this.frameRequested = false;

    new ResizeObserver(() => this.resize()).observe(container);
    this.bindInput();
    store.on('project', (d) => { if (d?.replaced) this.fit(); this.requestRender(); });
    store.on('ui', () => this.requestRender());
    this.resize();
  }

  // ---------- Geometry ----------

  get layout() {
    const p = this.store.project;
    const base = Math.min((this.cw - 24) / p.width, (this.ch - 24) / p.height);
    const scale = Math.max(base, 0.01) * this.view.zoom;
    return {
      scale,
      ox: (this.cw - p.width * scale) / 2 + this.view.panX,
      oy: (this.ch - p.height * scale) / 2 + this.view.panY,
    };
  }

  toWorld(sx, sy) {
    const { scale, ox, oy } = this.layout;
    return { x: (sx - ox) / scale, y: (sy - oy) / scale };
  }

  toScreen(wx, wy) {
    const { scale, ox, oy } = this.layout;
    return { x: wx * scale + ox, y: wy * scale + oy };
  }

  fit() {
    this.view = { zoom: 1, panX: 0, panY: 0 };
    this.requestRender();
  }

  zoomBy(factor, sx = this.cw / 2, sy = this.ch / 2) {
    const world = this.toWorld(sx, sy);
    this.view.zoom = Math.min(8, Math.max(0.2, this.view.zoom * factor));
    this.anchor(world, sx, sy);
    this.requestRender();
  }

  /** Adjusts the pan so that a world point appears at a screen point. */
  anchor(world, sx, sy) {
    const p = this.store.project;
    const { scale } = this.layout;
    this.view.panX = sx - world.x * scale - (this.cw - p.width * scale) / 2;
    this.view.panY = sy - world.y * scale - (this.ch - p.height * scale) / 2;
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.cw = Math.max(rect.width, 1);
    this.ch = Math.max(rect.height, 1);
    this.canvas.width = Math.round(this.cw * this.dpr);
    this.canvas.height = Math.round(this.ch * this.dpr);
    this.canvas.style.width = `${this.cw}px`;
    this.canvas.style.height = `${this.ch}px`;
    this.render();
  }

  // ---------- Rendering ----------

  requestRender() {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      this.render();
    });
  }

  render() {
    const { ctx, dpr } = this;
    const { project, ui } = this.store;
    const { scale, ox, oy } = this.layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = getComputedStyle(this.container).getPropertyValue('--workspace').trim() || '#111318';
    ctx.fillRect(0, 0, this.cw, this.ch);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = project.background;
    ctx.fillRect(ox, oy, project.width * scale, project.height * scale);
    ctx.restore();

    ctx.save();
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    ctx.beginPath();
    ctx.rect(0, 0, project.width, project.height);
    ctx.clip();
    if (ui.onion && !ui.playing && ui.frameIndex > 0) {
      drawFrameContent(ctx, project, ui.frameIndex - 1, 0.22);
    }
    drawFrameContent(ctx, project, ui.frameIndex);
    if (this.draft) drawObject(ctx, this.draft);
    ctx.restore();

    if (!ui.playing) this.drawSelection();
    if (this.cursor && ui.tool === 'eraser') {
      ctx.beginPath();
      ctx.arc(this.cursor.x, this.cursor.y, ui.eraserSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  selected() {
    const { project, ui } = this.store;
    return findObject(project, ui.frameIndex, ui.selectedId);
  }

  handles(obj) {
    const corners = worldCorners(obj).map((c) => this.toScreen(c.x, c.y));
    const top = { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 };
    const dir = Math.sign(obj.sy) || 1;
    const rotate = {
      x: top.x + Math.sin(obj.rotation) * ROTATE_OFFSET * dir,
      y: top.y - Math.cos(obj.rotation) * ROTATE_OFFSET * dir,
    };
    return { corners, top, rotate };
  }

  drawSelection() {
    const found = this.selected();
    if (!found) return;
    const { ctx } = this;
    const { corners, top, rotate } = this.handles(found.obj);
    ctx.save();
    ctx.strokeStyle = '#4dabf7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(rotate.x, rotate.y);
    ctx.stroke();
    for (const c of corners) this.drawHandle(c, '#ffffff');
    this.drawHandle(rotate, '#4dabf7');
    ctx.restore();
  }

  drawHandle(p, fill) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#1c7ed6';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // ---------- Input ----------

  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e, true));
    c.addEventListener('pointerleave', () => { this.cursor = null; this.requestRender(); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  point(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  editableLayer() {
    const layer = this.store.layer;
    if (!layer) return null;
    if (layer.locked) { toast('Слой заблокирован. Снимите замок в панели слоёв.'); return null; }
    if (!layer.visible) { toast('Слой скрыт. Включите его в панели слоёв.'); return null; }
    return layer;
  }

  onDown(e) {
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already released pointer */ }
    const p = this.point(e);
    this.pointers.set(e.pointerId, p);
    if (this.store.ui.playing) this.store.setUI({ playing: false });

    if (this.pointers.size === 2) return this.startPinch();
    if (this.pointers.size > 2) return;

    const { tool } = this.store.ui;
    const world = this.toWorld(p.x, p.y);
    if (tool === 'hand' || e.button === 1) {
      this.gesture = { type: 'pan', last: p };
    } else if (tool === 'pen') {
      if (!this.editableLayer()) return;
      const { color, strokeWidth } = this.store.ui;
      this.draft = { type: 'stroke', id: 'draft', x: 0, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, points: [world.x, world.y], color, width: strokeWidth };
      this.gesture = { type: 'draw' };
    } else if (tool === 'eraser') {
      if (!this.editableLayer()) return;
      this.cursor = p;
      this.gesture = { type: 'erase', last: world, committed: false };
      this.eraseAt(world);
    } else {
      this.startSelectGesture(p, world);
    }
    this.requestRender();
  }

  startSelectGesture(p, world) {
    const found = this.selected();
    if (found) {
      const { corners, rotate } = this.handles(found.obj);
      if (Math.hypot(p.x - rotate.x, p.y - rotate.y) < HANDLE_HIT) {
        this.gesture = { type: 'rotate', start: world, obj: { ...found.obj }, committed: false };
        return;
      }
      if (corners.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < HANDLE_HIT)) {
        this.gesture = { type: 'scale', start: world, obj: { ...found.obj }, committed: false };
        return;
      }
    }
    const hit = this.hitAt(world);
    if (hit) {
      this.store.setUI({ selectedId: hit.obj.id, layerId: hit.layerId });
      this.gesture = { type: 'move', start: world, startScreen: p, obj: { ...hit.obj }, committed: false };
    } else {
      this.gesture = { type: 'pan', last: p, tapToDeselect: true, startScreen: p };
    }
  }

  hitAt(world) {
    const { project, ui } = this.store;
    const frame = project.frames[ui.frameIndex];
    const tolerance = 8 / this.layout.scale;
    for (let li = project.layers.length - 1; li >= 0; li--) {
      const layer = project.layers[li];
      if (!layer.visible || layer.locked) continue;
      const list = frame.cells[layer.id] || [];
      for (let i = list.length - 1; i >= 0; i--) {
        if (hitTest(list[i], world.x, world.y, tolerance)) return { obj: list[i], layerId: layer.id };
      }
    }
    return null;
  }

  startPinch() {
    const [a, b] = [...this.pointers.values()];
    this.draft = null;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const found = this.selected();
    if (this.gesture?.type === 'move' && found) {
      this.gesture = { type: 'objPinch', mid, dist, angle, obj: { ...found.obj }, committed: this.gesture.committed };
    } else {
      this.gesture = { type: 'viewPinch', dist, zoom: this.view.zoom, world: this.toWorld(mid.x, mid.y) };
    }
    this.requestRender();
  }

  /** Applies a live change to the selected object; records history on the first change. */
  editSelected(gesture, apply) {
    const found = this.selected();
    if (!found) return;
    if (!gesture.committed) {
      this.store.checkpoint();
      gesture.committed = true;
    }
    apply(this.selected().obj);
    this.store.changed();
  }

  onMove(e) {
    const p = this.point(e);
    if (this.store.ui.tool === 'eraser') { this.cursor = p; this.requestRender(); }
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, p);
    const g = this.gesture;
    if (!g) return;
    const world = this.toWorld(p.x, p.y);

    switch (g.type) {
      case 'pan':
        this.view.panX += p.x - g.last.x;
        this.view.panY += p.y - g.last.y;
        g.last = p;
        if (Math.hypot(p.x - g.startScreen?.x, p.y - g.startScreen?.y) > 6) g.tapToDeselect = false;
        this.requestRender();
        break;
      case 'draw': {
        const pts = this.draft.points;
        const minStep = 1.5 / this.layout.scale;
        if (Math.hypot(world.x - pts[pts.length - 2], world.y - pts[pts.length - 1]) >= minStep) {
          pts.push(world.x, world.y);
          this.requestRender();
        }
        break;
      }
      case 'erase': {
        const step = Math.max(this.store.ui.eraserSize / 4 / this.layout.scale, 1);
        const dist = Math.hypot(world.x - g.last.x, world.y - g.last.y);
        const n = Math.ceil(dist / step);
        for (let i = 1; i <= n; i++) {
          this.eraseAt({ x: g.last.x + ((world.x - g.last.x) * i) / n, y: g.last.y + ((world.y - g.last.y) * i) / n });
        }
        g.last = world;
        break;
      }
      case 'move':
        if (!g.committed && Math.hypot(p.x - g.startScreen.x, p.y - g.startScreen.y) < 4) return;
        this.editSelected(g, (o) => {
          o.x = g.obj.x + world.x - g.start.x;
          o.y = g.obj.y + world.y - g.start.y;
        });
        break;
      case 'rotate':
        this.editSelected(g, (o) => {
          const a0 = Math.atan2(g.start.y - g.obj.y, g.start.x - g.obj.x);
          const a1 = Math.atan2(world.y - g.obj.y, world.x - g.obj.x);
          o.rotation = snapAngle(g.obj.rotation + a1 - a0);
        });
        break;
      case 'scale':
        this.editSelected(g, (o) => {
          const d0 = Math.max(Math.hypot(g.start.x - g.obj.x, g.start.y - g.obj.y), 0.001);
          const ratio = Math.hypot(world.x - g.obj.x, world.y - g.obj.y) / d0;
          o.sx = clampScale(g.obj.sx * ratio);
          o.sy = clampScale(g.obj.sy * ratio);
        });
        break;
      case 'objPinch':
      case 'viewPinch':
        this.updatePinch(g);
        break;
      default:
    }
  }

  updatePinch(g) {
    const [a, b] = [...this.pointers.values()];
    if (!b) return;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ratio = Math.hypot(b.x - a.x, b.y - a.y) / g.dist;
    if (g.type === 'viewPinch') {
      this.view.zoom = Math.min(8, Math.max(0.2, g.zoom * ratio));
      this.anchor(g.world, mid.x, mid.y);
      this.requestRender();
      return;
    }
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const scale = this.layout.scale;
    this.editSelected(g, (o) => {
      o.rotation = g.obj.rotation + angle - g.angle;
      o.sx = clampScale(g.obj.sx * ratio);
      o.sy = clampScale(g.obj.sy * ratio);
      o.x = g.obj.x + (mid.x - g.mid.x) / scale;
      o.y = g.obj.y + (mid.y - g.mid.y) / scale;
    });
  }

  onUp(e, cancelled = false) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    if (this.pointers.size > 0) {
      // One finger lifted from a pinch: stop the gesture until all fingers are up.
      if (g && (g.type === 'objPinch' || g.type === 'viewPinch')) this.gesture = { type: 'idle' };
      return;
    }
    if (g?.type === 'draw' && this.draft && !cancelled) this.commitStroke();
    if (g?.type === 'pan' && g.tapToDeselect && this.store.ui.selectedId) this.store.setUI({ selectedId: null });
    if (e.pointerType !== 'mouse') this.cursor = null;
    this.draft = null;
    this.gesture = null;
    this.requestRender();
  }

  commitStroke() {
    const { points, color, width } = this.draft;
    const stroke = createStroke(points, { color, width });
    const layerId = this.store.ui.layerId;
    this.store.mutate((project) => {
      getCell(project, this.store.ui.frameIndex, layerId).push(stroke);
    });
  }

  /** Erases the parts of strokes on the active layer that are under the eraser. */
  eraseAt(world) {
    const { project, ui } = this.store;
    const radius = ui.eraserSize / 2 / this.layout.scale;
    const list = getCell(project, ui.frameIndex, ui.layerId);
    const next = [];
    let changed = false;
    for (const obj of list) {
      if (obj.type !== 'stroke' || !hitTest(obj, world.x, world.y, radius)) { next.push(obj); continue; }
      changed = true;
      next.push(...splitStroke(obj, world, radius));
    }
    if (!changed) return;
    if (!this.gesture.committed) {
      this.store.checkpoint();
      this.gesture.committed = true;
    }
    const cell = project.frames[ui.frameIndex].cells;
    cell[ui.layerId] = next;
    if (ui.selectedId && !next.some((o) => o.id === ui.selectedId)) ui.selectedId = null;
    this.store.changed();
  }
}

/** Splits a stroke into the runs of points that are outside the eraser circle. */
function splitStroke(obj, world, radius) {
  const runs = [];
  let run = [];
  const reach = radius + obj.width / 2;
  for (let i = 0; i < obj.points.length; i += 2) {
    const w = toWorld(obj, obj.points[i], obj.points[i + 1]);
    if (Math.hypot(w.x - world.x, w.y - world.y) <= reach) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push(w.x, w.y);
    }
  }
  if (run.length) runs.push(run);
  const width = obj.width * (Math.abs(obj.sx) + Math.abs(obj.sy)) / 2;
  return runs.filter((r) => r.length >= 4).map((r) => ({
    ...createStroke(r, { color: obj.color, width }),
    opacity: obj.opacity,
  }));
}

function snapAngle(angle) {
  const step = Math.PI / 4;
  const nearest = Math.round(angle / step) * step;
  return Math.abs(angle - nearest) < 0.06 ? nearest : angle;
}

function clampScale(v) {
  const sign = Math.sign(v) || 1;
  return sign * Math.min(20, Math.max(0.05, Math.abs(v)));
}

