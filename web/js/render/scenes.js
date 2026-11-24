// Background scenes drawn procedurally to any width and height, centred on (0, 0).
// Positions are fractions of the scene size so scenes fit 16:9, 9:16 and 1:1 projects.

export const SCENES = ['meadow', 'city', 'night', 'sea', 'forest', 'room'];

/** Small deterministic random generator so stars and windows do not flicker between frames. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function sky(ctx, w, h, top, bottom, horizon = 1) {
  const g = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + h * horizon);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
}

function disc(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function cloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.15, 0.8], [-0.9, 0.2, 0.75], [0.35, -0.45, 0.8]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function hill(ctx, w, h, baseY, amp, color, phase) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  for (let i = 0; i <= 40; i++) {
    const x = -w / 2 + (w * i) / 40;
    ctx.lineTo(x, baseY + Math.sin(i / 6 + phase) * amp);
  }
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function tree(ctx, x, groundY, size, leaf) {
  ctx.fillStyle = '#6b4226';
  ctx.fillRect(x - size * 0.08, groundY - size * 0.5, size * 0.16, size * 0.5);
  ctx.fillStyle = leaf;
  for (const [dx, dy, r] of [[0, -0.75, 0.38], [-0.22, -0.55, 0.3], [0.22, -0.55, 0.3]]) {
    ctx.beginPath();
    ctx.arc(x + dx * size, groundY + dy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function meadow(ctx, w, h) {
  const m = Math.min(w, h);
  sky(ctx, w, h, '#74c0fc', '#d0ebff', 0.7);
  disc(ctx, w * 0.32, -h * 0.3, m * 0.09, '#ffd43b');
  cloud(ctx, -w * 0.28, -h * 0.3, m * 0.06);
  cloud(ctx, w * 0.05, -h * 0.36, m * 0.045);
  hill(ctx, w, h, h * 0.12, h * 0.05, '#8ce99a', 0);
  hill(ctx, w, h, h * 0.25, h * 0.03, '#51cf66', 2);
  const rand = seeded(7);
  for (let i = 0; i < 30; i++) {
    const x = -w / 2 + rand() * w;
    const y = h * 0.3 + rand() * h * 0.18;
    disc(ctx, x, y, m * 0.008, ['#fff', '#ffd43b', '#ff8787'][i % 3]);
  }
}

function city(ctx, w, h) {
  sky(ctx, w, h, '#5f3dc4', '#ffa94d', 0.75);
  disc(ctx, 0, h * 0.1, Math.min(w, h) * 0.16, '#ffe066');
  const rand = seeded(42);
  const ground = h * 0.32;
  let x = -w / 2;
  while (x < w / 2) {
    const bw = w * (0.06 + rand() * 0.07);
    const bh = h * (0.25 + rand() * 0.45);
    ctx.fillStyle = ['#343a40', '#495057', '#212529'][Math.floor(rand() * 3)];
    ctx.fillRect(x, ground - bh, bw - 4, bh);
    ctx.fillStyle = '#ffe066';
    for (let wy = ground - bh + 12; wy < ground - 14; wy += 22) {
      for (let wx = x + 8; wx < x + bw - 16; wx += 16) {
        if (rand() > 0.45) ctx.fillRect(wx, wy, 7, 10);
      }
    }
    x += bw;
  }
  ctx.fillStyle = '#495057';
  ctx.fillRect(-w / 2, ground, w, h / 2 - ground);
  ctx.fillStyle = '#f8f9fa';
  for (let sx = -w / 2; sx < w / 2; sx += w * 0.08) ctx.fillRect(sx, ground + (h / 2 - ground) / 2 - 3, w * 0.04, 6);
}

function night(ctx, w, h) {
  const m = Math.min(w, h);
  sky(ctx, w, h, '#0b1026', '#364fc7', 0.8);
  const rand = seeded(3);
  for (let i = 0; i < 90; i++) {
    disc(ctx, -w / 2 + rand() * w, -h / 2 + rand() * h * 0.6, m * (0.002 + rand() * 0.004), 'rgba(255,255,255,0.9)');
  }
  disc(ctx, -w * 0.3, -h * 0.27, m * 0.08, '#fff3bf');
  disc(ctx, -w * 0.3 + m * 0.035, -h * 0.27 - m * 0.02, m * 0.07, '#0f1638');
  hill(ctx, w, h, h * 0.18, h * 0.06, '#1b2a4e', 1);
  hill(ctx, w, h, h * 0.3, h * 0.03, '#10192f', 3);
}

function sea(ctx, w, h) {
  const m = Math.min(w, h);
  sky(ctx, w, h, '#4dabf7', '#e7f5ff', 0.5);
  disc(ctx, w * 0.3, -h * 0.25, m * 0.08, '#ffd43b');
  cloud(ctx, -w * 0.25, -h * 0.32, m * 0.05);
  const water = ctx.createLinearGradient(0, 0, 0, h * 0.3);
  water.addColorStop(0, '#1c7ed6');
  water.addColorStop(1, '#4dabf7');
  ctx.fillStyle = water;
  ctx.fillRect(-w / 2, 0, w, h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = m * 0.006;
  ctx.lineCap = 'round';
  const rand = seeded(11);
  for (let i = 0; i < 18; i++) {
    const x = -w / 2 + rand() * w;
    const y = h * 0.03 + rand() * h * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, m * 0.025, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  hill(ctx, w, h, h * 0.34, h * 0.02, '#ffe8a3', 0.5);
}

function forest(ctx, w, h) {
  const m = Math.min(w, h);
  sky(ctx, w, h, '#a5d8ff', '#e6fcf5', 0.6);
  hill(ctx, w, h, -h * 0.02, h * 0.04, '#69db7c', 1);
  const rand = seeded(19);
  for (let i = 0; i < 9; i++) tree(ctx, -w / 2 + ((i + rand() * 0.5) * w) / 8.5, h * 0.06, m * 0.3, '#2b8a3e');
  hill(ctx, w, h, h * 0.2, h * 0.02, '#40c057', 2);
  for (let i = 0; i < 6; i++) tree(ctx, -w / 2 + ((i + 0.3 + rand() * 0.4) * w) / 5.5, h * 0.32, m * 0.42, '#37b24d');
}

function room(ctx, w, h) {
  const m = Math.min(w, h);
  ctx.fillStyle = '#ffe8cc';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#ffd8a8';
  for (let x = -w / 2; x < w / 2; x += w * 0.08) ctx.fillRect(x, -h / 2, w * 0.035, h * 0.75);
  const floor = h * 0.25;
  ctx.fillStyle = '#b07a4b';
  ctx.fillRect(-w / 2, floor, w, h / 2 - floor);
  ctx.strokeStyle = '#8d5524';
  ctx.lineWidth = 3;
  for (let x = -w / 2; x < w / 2; x += w * 0.12) {
    ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x - w * 0.05, h / 2); ctx.stroke();
  }
  // Window
  const ww = m * 0.42;
  const wh = m * 0.32;
  const wx = -w * 0.25 - ww / 2;
  const wy = -h * 0.3;
  ctx.fillStyle = '#a5d8ff';
  ctx.fillRect(wx, wy, ww, wh);
  disc(ctx, wx + ww * 0.75, wy + wh * 0.3, m * 0.04, '#ffd43b');
  ctx.strokeStyle = '#f8f9fa';
  ctx.lineWidth = m * 0.015;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
  // Picture frame
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w * 0.18, -h * 0.28, m * 0.22, m * 0.16);
  ctx.strokeStyle = '#e8590c';
  ctx.strokeRect(w * 0.18, -h * 0.28, m * 0.22, m * 0.16);
  hillInFrame(ctx, w * 0.18, -h * 0.28, m * 0.22, m * 0.16);
}

function hillInFrame(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.85);
  ctx.lineTo(x + w * 0.4, y + h * 0.3);
  ctx.lineTo(x + w * 0.6, y + h * 0.6);
  ctx.lineTo(x + w * 0.75, y + h * 0.45);
  ctx.lineTo(x + w * 0.9, y + h * 0.85);
  ctx.closePath();
  ctx.fillStyle = '#74b816';
  ctx.fill();
}

const DRAWERS = { meadow, city, night, sea, forest, room };

export function drawScene(ctx, obj) {
  const draw = DRAWERS[obj.kind] || meadow;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-obj.w / 2, -obj.h / 2, obj.w, obj.h);
  ctx.clip();
  draw(ctx, obj.w, obj.h);
  ctx.restore();
}
