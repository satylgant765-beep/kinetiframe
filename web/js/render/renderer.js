// Renders project frames to any 2D canvas context.

import { drawStroke, drawShape } from './shapes.js';
import { drawCharacter } from './characters.js';
import { drawScene } from './scenes.js';

export function drawObject(ctx, obj) {
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(obj.rotation);
  ctx.scale(obj.sx, obj.sy);
  ctx.globalAlpha *= obj.opacity ?? 1;
  if (obj.type === 'stroke') drawStroke(ctx, obj);
  else if (obj.type === 'shape') drawShape(ctx, obj);
  else if (obj.type === 'character') drawCharacter(ctx, obj);
  else if (obj.type === 'scene') drawScene(ctx, obj);
  ctx.restore();
}

/** Draws the layers of one frame (no background). */
export function drawFrameContent(ctx, project, frameIndex, alpha = 1) {
  const frame = project.frames[frameIndex];
  if (!frame) return;
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    const objects = frame.cells[layer.id] || [];
    ctx.save();
    ctx.globalAlpha = alpha * layer.opacity;
    for (const obj of objects) drawObject(ctx, obj);
    ctx.restore();
  }
}

/** Draws a complete frame at project resolution scaled by `scale`, including the background. */
export function renderFrame(ctx, project, frameIndex, scale = 1) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = project.background;
  ctx.fillRect(0, 0, project.width, project.height);
  drawFrameContent(ctx, project, frameIndex);
  ctx.restore();
}

/** Renders a frame to a new canvas of the given width (keeps the aspect ratio). */
export function frameToCanvas(project, frameIndex, width) {
  const scale = width / project.width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(project.width * scale);
  canvas.height = Math.round(project.height * scale);
  renderFrame(canvas.getContext('2d'), project, frameIndex, scale);
  return canvas;
}
