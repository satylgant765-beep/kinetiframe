// Draws vector shapes and freehand strokes in local coordinates.

export function drawStroke(ctx, obj) {
  const p = obj.points;
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = obj.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p.length <= 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], obj.width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  // Smooth the line through the midpoints of consecutive samples.
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2;
    const my = (p[i + 1] + p[i + 3]) / 2;
    ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
  }
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  ctx.stroke();
}

export function shapePath(ctx, kind, w, h) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.beginPath();
  switch (kind) {
    case 'rect':
      ctx.rect(x, y, w, h);
      break;
    case 'roundRect': {
      const r = Math.min(w, h) * 0.2;
      ctx.roundRect(x, y, w, h, r);
      break;
    }
    case 'ellipse':
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(0, y);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(x, h / 2);
      ctx.closePath();
      break;
    case 'star': {
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const radius = i % 2 === 0 ? 1 : 0.45;
        const px = Math.cos(angle) * radius * (w / 2);
        const py = Math.sin(angle) * radius * (h / 2) + h * 0.05;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'heart':
      ctx.moveTo(0, h * 0.5);
      ctx.bezierCurveTo(-w * 0.6, h * 0.05, -w * 0.5, -h * 0.55, 0, -h * 0.2);
      ctx.bezierCurveTo(w * 0.5, -h * 0.55, w * 0.6, h * 0.05, 0, h * 0.5);
      ctx.closePath();
      break;
    case 'arrow': {
      const shaft = h * 0.36;
      const head = w * 0.35;
      ctx.moveTo(x, -shaft / 2);
      ctx.lineTo(w / 2 - head, -shaft / 2);
      ctx.lineTo(w / 2 - head, y);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - head, h / 2);
      ctx.lineTo(w / 2 - head, shaft / 2);
      ctx.lineTo(x, shaft / 2);
      ctx.closePath();
      break;
    }
    case 'line':
      ctx.moveTo(x, 0);
      ctx.lineTo(w / 2, 0);
      break;
    default:
      ctx.rect(x, y, w, h);
  }
}

export function drawShape(ctx, obj) {
  shapePath(ctx, obj.kind, obj.w, obj.h);
  if (obj.kind !== 'line' && obj.fill && obj.fill !== 'none') {
    ctx.fillStyle = obj.fill;
    ctx.fill();
  }
  const width = obj.kind === 'line' ? Math.max(obj.strokeWidth, 2) : obj.strokeWidth;
  if (width > 0 && obj.stroke && obj.stroke !== 'none') {
    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
