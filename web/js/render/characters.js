// Cartoon characters drawn with vector paths inside a 200 x 260 box centred on (0, 0).
// `color` is the character's main colour; `mood` changes the eyes and mouth.

const INK = '#2b2d42';
const LINE = 5;

export const CHARACTER_BOX = { w: 200, h: 260 };

function outline(ctx, fill) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = LINE;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  outline(ctx, fill);
}

function eye(ctx, x, y, r, mood, side) {
  circle(ctx, x, y, r, '#ffffff');
  const pupil = mood === 'surprised' ? r * 0.35 : r * 0.5;
  ctx.beginPath();
  ctx.arc(x + (mood === 'sad' ? 0 : r * 0.15), y + (mood === 'sad' ? r * 0.25 : 0), pupil, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.3, y - r * 0.25, pupil * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (mood === 'angry' || mood === 'sad') {
    // Eyebrow: angry slopes down towards the nose, sad slopes up.
    const inner = mood === 'angry' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x - r * side, y - r * 1.35 - inner * r * 0.3);
    ctx.lineTo(x + r * side, y - r * 1.35 + inner * r * 0.3);
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE;
    ctx.stroke();
  }
}

function mouth(ctx, x, y, w, mood) {
  ctx.beginPath();
  if (mood === 'happy') {
    ctx.arc(x, y - w * 0.25, w / 2, Math.PI * 0.15, Math.PI * 0.85);
    outline(ctx, null);
  } else if (mood === 'surprised') {
    ctx.ellipse(x, y, w * 0.2, w * 0.28, 0, 0, Math.PI * 2);
    outline(ctx, '#7a1f2b');
  } else if (mood === 'sad') {
    ctx.arc(x, y + w * 0.45, w / 2, Math.PI * 1.2, Math.PI * 1.8);
    outline(ctx, null);
  } else {
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 4, y - 4);
    ctx.lineTo(x, y + 2);
    ctx.lineTo(x + w / 4, y - 4);
    ctx.lineTo(x + w / 2, y);
    outline(ctx, null);
  }
}

function face(ctx, cx, cy, spacing, eyeR, mood, mouthW) {
  eye(ctx, cx - spacing, cy, eyeR, mood, -1);
  eye(ctx, cx + spacing, cy, eyeR, mood, 1);
  mouth(ctx, cx, cy + eyeR * 2.4, mouthW, mood);
}

function cat(ctx, color, mood) {
  // Tail
  ctx.beginPath();
  ctx.moveTo(55, 90);
  ctx.bezierCurveTo(120, 80, 95, 10, 75, 20);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 22;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.stroke();
  // Body and paws
  ctx.beginPath();
  ctx.ellipse(0, 70, 62, 58, 0, 0, Math.PI * 2);
  outline(ctx, color);
  ctx.beginPath();
  ctx.ellipse(0, 80, 32, 40, 0, 0, Math.PI * 2);
  outline(ctx, '#fff3e0');
  circle(ctx, -32, 122, 16, color);
  circle(ctx, 32, 122, 16, color);
  // Ears
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 25, -95);
    ctx.lineTo(s * 70, -125);
    ctx.lineTo(s * 70, -60);
    ctx.closePath();
    outline(ctx, color);
  }
  // Head
  ctx.beginPath();
  ctx.ellipse(0, -45, 80, 66, 0, 0, Math.PI * 2);
  outline(ctx, color);
  face(ctx, 0, -55, 30, 15, mood, 36);
  // Nose and whiskers
  ctx.beginPath();
  ctx.moveTo(-6, -30);
  ctx.lineTo(6, -30);
  ctx.lineTo(0, -23);
  ctx.closePath();
  outline(ctx, '#ff6b81');
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    for (const dy of [-6, 4]) {
      ctx.beginPath();
      ctx.moveTo(s * 45, -25 + dy);
      ctx.lineTo(s * 85, -30 + dy * 2);
      ctx.stroke();
    }
  }
}

function robot(ctx, color, mood) {
  ctx.lineWidth = LINE;
  // Legs and arms
  ctx.beginPath(); ctx.roundRect(-45, 95, 30, 35, 6); outline(ctx, '#adb5bd');
  ctx.beginPath(); ctx.roundRect(15, 95, 30, 35, 6); outline(ctx, '#adb5bd');
  ctx.beginPath(); ctx.roundRect(-95, 10, 30, 75, 12); outline(ctx, '#adb5bd');
  ctx.beginPath(); ctx.roundRect(65, 10, 30, 75, 12); outline(ctx, '#adb5bd');
  // Body with panel
  ctx.beginPath(); ctx.roundRect(-65, 0, 130, 100, 16); outline(ctx, color);
  ctx.beginPath(); ctx.roundRect(-35, 25, 70, 45, 8); outline(ctx, '#e9ecef');
  circle(ctx, -15, 47, 7, '#ff6b6b');
  circle(ctx, 12, 47, 7, '#51cf66');
  // Antenna and head
  ctx.beginPath(); ctx.moveTo(0, -105); ctx.lineTo(0, -125); outline(ctx, null);
  circle(ctx, 0, -122, 8, '#ffd43b');
  ctx.beginPath(); ctx.roundRect(-75, -108, 150, 102, 22); outline(ctx, color);
  ctx.beginPath(); ctx.roundRect(-58, -92, 116, 70, 14); outline(ctx, '#e7f5ff');
  face(ctx, 0, -68, 28, 13, mood, 34);
}

function kid(ctx, color, mood) {
  const skin = '#f6c89f';
  // Legs and shoes
  ctx.beginPath(); ctx.roundRect(-35, 70, 26, 50, 8); outline(ctx, '#495057');
  ctx.beginPath(); ctx.roundRect(9, 70, 26, 50, 8); outline(ctx, '#495057');
  ctx.beginPath(); ctx.ellipse(-25, 122, 22, 10, 0, 0, Math.PI * 2); outline(ctx, '#e03131');
  ctx.beginPath(); ctx.ellipse(25, 122, 22, 10, 0, 0, Math.PI * 2); outline(ctx, '#e03131');
  // Arms
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 45, 15); ctx.lineTo(s * 80, 60);
    ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 11; ctx.stroke();
    circle(ctx, s * 82, 64, 11, skin);
  }
  // Shirt
  ctx.beginPath(); ctx.roundRect(-50, 0, 100, 80, 20); outline(ctx, color);
  // Head, hair, ears
  circle(ctx, -62, -55, 13, skin);
  circle(ctx, 62, -55, 13, skin);
  circle(ctx, 0, -55, 64, skin);
  ctx.beginPath();
  ctx.moveTo(-64, -62);
  ctx.bezierCurveTo(-70, -140, 70, -140, 64, -62);
  ctx.bezierCurveTo(40, -95, 10, -80, 0, -100);
  ctx.bezierCurveTo(-15, -80, -45, -95, -64, -62);
  outline(ctx, '#5c3d2e');
  face(ctx, 0, -52, 24, 12, mood, 30);
  ctx.globalAlpha *= 0.35;
  circle(ctx, -40, -28, 8, '#ff8787');
  circle(ctx, 40, -28, 8, '#ff8787');
  ctx.globalAlpha /= 0.35;
}

function monster(ctx, color, mood) {
  // Horns
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 30, -85);
    ctx.quadraticCurveTo(s * 70, -110, s * 55, -128);
    ctx.quadraticCurveTo(s * 50, -100, s * 10, -95);
    ctx.closePath();
    outline(ctx, '#fff3bf');
  }
  // Feet
  circle(ctx, -40, 115, 20, color);
  circle(ctx, 40, 115, 20, color);
  // Blob body
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.bezierCurveTo(85, -100, 100, 0, 90, 60);
  ctx.bezierCurveTo(80, 120, -80, 120, -90, 60);
  ctx.bezierCurveTo(-100, 0, -85, -100, 0, -100);
  outline(ctx, color);
  // Spots
  ctx.globalAlpha *= 0.25;
  circle(ctx, -55, 20, 12, '#ffffff');
  circle(ctx, 60, -10, 9, '#ffffff');
  circle(ctx, 50, 60, 14, '#ffffff');
  ctx.globalAlpha /= 0.25;
  // One big eye
  eye(ctx, 0, -40, 32, mood, 1);
  if (mood === 'angry' || mood === 'sad') eye(ctx, 0, -40, 32, mood, -1);
  // Mouth with teeth
  mouth(ctx, 0, 35, 70, mood);
  if (mood === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-15, 27); ctx.lineTo(-8, 40); ctx.lineTo(-1, 29);
    ctx.moveTo(5, 29); ctx.lineTo(12, 40); ctx.lineTo(19, 27);
    outline(ctx, '#ffffff');
  }
}

function bird(ctx, color, mood) {
  // Legs
  ctx.strokeStyle = '#f08c00';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 25, 85); ctx.lineTo(s * 25, 120);
    ctx.moveTo(s * 25, 120); ctx.lineTo(s * 25 + 15, 125);
    ctx.moveTo(s * 25, 120); ctx.lineTo(s * 25 - 15, 125);
    ctx.stroke();
  }
  // Crest
  for (const a of [-0.4, 0, 0.4]) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(a) * 30, -95, 10, 28, a, 0, Math.PI * 2);
    outline(ctx, color);
  }
  // Body
  ctx.beginPath(); ctx.ellipse(0, 0, 90, 95, 0, 0, Math.PI * 2); outline(ctx, color);
  ctx.beginPath(); ctx.ellipse(0, 35, 55, 52, 0, 0, Math.PI * 2); outline(ctx, '#fff0f6');
  // Wings
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 82, 15, 22, 45, s * -0.5, 0, Math.PI * 2);
    outline(ctx, color);
  }
  face(ctx, 0, -35, 30, 17, mood, 0);
  // Beak
  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.lineTo(16, -8);
  ctx.lineTo(0, mood === 'surprised' ? 22 : 12);
  ctx.closePath();
  outline(ctx, '#ffa94d');
}

function dog(ctx, color, mood) {
  // Tail
  ctx.beginPath();
  ctx.moveTo(55, 60);
  ctx.quadraticCurveTo(105, 40, 95, -5);
  ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 11; ctx.stroke();
  // Body, legs
  ctx.beginPath(); ctx.ellipse(0, 65, 65, 55, 0, 0, Math.PI * 2); outline(ctx, color);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(s * 38 - 14, 90, 28, 38, 12); outline(ctx, color);
  }
  ctx.beginPath(); ctx.ellipse(0, 70, 30, 35, 0, 0, Math.PI * 2); outline(ctx, '#fff4e6');
  // Collar
  ctx.beginPath(); ctx.roundRect(-40, 12, 80, 14, 7); outline(ctx, '#e03131');
  circle(ctx, 0, 30, 8, '#ffd43b');
  // Floppy ears behind the head
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 70, -45, 22, 50, s * 0.35, 0, Math.PI * 2);
    outline(ctx, '#8d5524');
  }
  // Head and muzzle
  ctx.beginPath(); ctx.ellipse(0, -50, 70, 62, 0, 0, Math.PI * 2); outline(ctx, color);
  ctx.beginPath(); ctx.ellipse(0, -18, 38, 26, 0, 0, Math.PI * 2); outline(ctx, '#fff4e6');
  face(ctx, 0, -68, 28, 13, mood, 28);
  ctx.beginPath(); ctx.ellipse(0, -30, 11, 8, 0, 0, Math.PI * 2); outline(ctx, INK);
  if (mood === 'happy') {
    ctx.beginPath(); ctx.ellipse(8, 2, 9, 12, 0, 0, Math.PI * 2); outline(ctx, '#ff8787');
  }
}

function girl(ctx, color, mood) {
  const skin = '#f1c27d';
  const hair = '#2b1d14';
  // Long hair behind
  ctx.beginPath();
  ctx.moveTo(-70, -60);
  ctx.bezierCurveTo(-85, 20, -60, 40, -45, 30);
  ctx.lineTo(45, 30);
  ctx.bezierCurveTo(60, 40, 85, 20, 70, -60);
  ctx.closePath();
  outline(ctx, hair);
  // Legs and shoes
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(s * 20 - 9, 85, 18, 35, 6); outline(ctx, skin);
    ctx.beginPath(); ctx.ellipse(s * 22, 122, 18, 9, 0, 0, Math.PI * 2); outline(ctx, '#7950f2');
  }
  // Arms
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 35, 15); ctx.lineTo(s * 70, 55);
    ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = skin; ctx.lineWidth = 8; ctx.stroke();
  }
  // Dress
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(30, 0);
  ctx.lineTo(60, 92);
  ctx.lineTo(-60, 92);
  ctx.closePath();
  outline(ctx, color);
  // Head with fringe
  circle(ctx, 0, -55, 58, skin);
  ctx.beginPath();
  ctx.moveTo(-60, -60);
  ctx.bezierCurveTo(-60, -130, 60, -130, 60, -60);
  ctx.bezierCurveTo(30, -80, -10, -75, -60, -60);
  outline(ctx, hair);
  // Bow
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(40, -100); ctx.lineTo(40 + s * 24, -115); ctx.lineTo(40 + s * 24, -85); ctx.closePath();
    outline(ctx, '#ff6b81');
  }
  circle(ctx, 40, -100, 7, '#ff6b81');
  face(ctx, 0, -50, 22, 11, mood, 26);
  ctx.globalAlpha *= 0.35;
  circle(ctx, -36, -26, 7, '#ff8787');
  circle(ctx, 36, -26, 7, '#ff8787');
  ctx.globalAlpha /= 0.35;
}

function alien(ctx, color, mood) {
  // Antennae
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(s * 25, -85); ctx.quadraticCurveTo(s * 35, -115, s * 50, -118); outline(ctx, null);
    circle(ctx, s * 52, -118, 9, '#ffd43b');
  }
  // Legs
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.roundRect(s * 25 - 10, 80, 20, 40, 8); outline(ctx, color);
  }
  // Space suit body
  ctx.beginPath(); ctx.ellipse(0, 50, 55, 50, 0, 0, Math.PI * 2); outline(ctx, '#dee2e6');
  ctx.beginPath(); ctx.roundRect(-22, 30, 44, 30, 6); outline(ctx, '#4dabf7');
  // Big head
  ctx.beginPath(); ctx.ellipse(0, -35, 85, 62, 0, 0, Math.PI * 2); outline(ctx, color);
  // Three eyes
  eye(ctx, -40, -45, 15, mood, -1);
  eye(ctx, 40, -45, 15, mood, 1);
  eye(ctx, 0, -62, 12, mood, 1);
  mouth(ctx, 0, -8, 34, mood);
}

const DRAWERS = { cat, robot, kid, monster, bird, dog, girl, alien };

export function drawCharacter(ctx, obj) {
  const draw = DRAWERS[obj.kind] || cat;
  ctx.save();
  ctx.scale(obj.w / CHARACTER_BOX.w, obj.h / CHARACTER_BOX.h);
  draw(ctx, obj.color, obj.mood || 'happy');
  ctx.restore();
}
