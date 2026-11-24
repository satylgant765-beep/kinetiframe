// Sample project shown on first launch: a cat and a dog cross a meadow while a bird flies over.
// It is built with the same tools the user has: a scene, characters, key frames and in-betweens.

import { createProject, cloneFrame, getCell } from './project.js';
import { createScene, createCharacter } from './objects.js';
import { addInbetweens } from './tween.js';

export function createDemoProject() {
  const p = createProject({ name: 'Пример: прогулка по лугу', fps: 12 });
  const [bg, actors] = p.layers;
  getCell(p, 0, bg.id).push(createScene('meadow', p.width, p.height));

  const cat = Object.assign(createCharacter('cat', 230, 470), { sx: 0.9, sy: 0.9 });
  const dog = Object.assign(createCharacter('dog', 60, 500), { sx: 0.8, sy: 0.8 });
  const bird = Object.assign(createCharacter('bird', 1150, 140), { sx: -0.45, sy: 0.45 });
  getCell(p, 0, actors.id).push(dog, cat, bird);

  // Key frame 2: halfway, the cat jumps and looks surprised.
  const mid = cloneFrame(p.frames[0]);
  const [dog2, cat2, bird2] = mid.cells[actors.id];
  Object.assign(cat2, { x: 640, y: 360, rotation: -0.2, mood: 'surprised' });
  Object.assign(dog2, { x: 470, y: 500 });
  Object.assign(bird2, { x: 700, y: 210 });

  // Key frame 3: both arrive on the right, happy.
  const end = cloneFrame(mid);
  const [dog3, cat3, bird3] = end.cells[actors.id];
  Object.assign(cat3, { x: 1040, y: 470, rotation: 0, mood: 'happy' });
  Object.assign(dog3, { x: 860, y: 500 });
  Object.assign(bird3, { x: 160, y: 120 });

  p.frames.push(mid, end);
  addInbetweens(p, 1, 9, 'easeIn');
  addInbetweens(p, 0, 9, 'easeOut');
  return p;
}
