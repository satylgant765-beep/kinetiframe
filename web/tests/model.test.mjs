// Unit tests for the project model and object geometry. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProject, addFrame, duplicateFrame, deleteFrame, moveFrame, addLayer, deleteLayer, moveLayer,
  getCell, findObject, serialize, deserialize,
} from '../js/core/project.js';
import { addInbetweens, lerpAngle, lerpColor, EASINGS } from '../js/core/tween.js';
import { createDemoProject } from '../js/core/demo.js';
import { createScene } from '../js/core/objects.js';
import { createStroke, createShape, createCharacter, hitTest, toLocal, toWorld } from '../js/core/objects.js';

test('new project has one frame and two layers', () => {
  const p = createProject({ aspect: '9:16' });
  assert.equal(p.frames.length, 1);
  assert.equal(p.layers.length, 2);
  assert.deepEqual([p.width, p.height], [720, 1280]);
});

test('frame operations keep indexes valid', () => {
  const p = createProject();
  getCell(p, 0, p.layers[1].id).push(createShape('rect', 10, 10, { fill: '#000', stroke: '#000', strokeWidth: 2 }));
  assert.equal(duplicateFrame(p, 0), 1);
  assert.equal(p.frames[1].cells[p.layers[1].id].length, 1);
  assert.notEqual(p.frames[0].id, p.frames[1].id);
  assert.equal(addFrame(p, 1), 2);
  assert.equal(moveFrame(p, 2, -1), 1);
  assert.equal(moveFrame(p, 0, -1), 0);
  assert.equal(deleteFrame(p, 2), 1);
  assert.equal(p.frames.length, 2);
  deleteFrame(p, 0);
  assert.equal(deleteFrame(p, 0), 0);
  assert.equal(p.frames.length, 1, 'last frame is cleared, not removed');
});

test('layer operations update every frame', () => {
  const p = createProject();
  addFrame(p, 0);
  const layer = addLayer(p, 'Extra');
  assert.ok(p.frames.every((f) => Array.isArray(f.cells[layer.id])));
  assert.equal(moveLayer(p, layer.id, -1), true);
  assert.equal(p.layers[1].id, layer.id);
  assert.equal(deleteLayer(p, layer.id), true);
  assert.ok(p.frames.every((f) => !(layer.id in f.cells)));
  deleteLayer(p, p.layers[0].id);
  assert.equal(deleteLayer(p, p.layers[0].id), false, 'cannot delete the last layer');
});

test('serialize and deserialize round trip', () => {
  const p = createProject({ name: 'Тест' });
  const c = createCharacter('robot', 100, 100);
  getCell(p, 0, p.layers[0].id).push(c);
  const back = deserialize(serialize(p));
  assert.equal(back.name, 'Тест');
  assert.equal(findObject(back, 0, c.id).obj.kind, 'robot');
  assert.throws(() => deserialize('{"format":"other"}'), /не проект/);
  assert.throws(() => deserialize('nope'), /повреждён/);
});

test('stroke is centred and hit-testable', () => {
  const s = createStroke([0, 0, 100, 0], { color: '#000', width: 10 });
  assert.equal(s.x, 50);
  assert.deepEqual(s.points, [-50, 0, 50, 0]);
  assert.ok(hitTest(s, 50, 3));
  assert.ok(!hitTest(s, 50, 30));
});

test('local and world transforms are inverse', () => {
  const o = createShape('rect', 200, 100, { fill: '#000', stroke: '#000', strokeWidth: 0 });
  Object.assign(o, { rotation: 0.7, sx: 1.5, sy: -2 });
  const w = toWorld(o, 12, -7);
  const l = toLocal(o, w.x, w.y);
  assert.ok(Math.abs(l.x - 12) < 1e-9 && Math.abs(l.y + 7) < 1e-9);
  assert.ok(hitTest(o, 200, 100));
});

test('in-betweens interpolate matched objects', () => {
  const p = createProject();
  const layer = p.layers[1].id;
  const c = createCharacter('cat', 0, 0);
  getCell(p, 0, layer).push(c);
  duplicateFrame(p, 0);
  Object.assign(p.frames[1].cells[layer][0], { x: 100, rotation: 1, mood: 'sad', color: '#ffffff' });
  p.frames[0].cells[layer][0].color = '#000000';
  assert.equal(addInbetweens(p, 0, 3, 'linear'), 3);
  assert.equal(p.frames.length, 5);
  const xs = p.frames.map((f) => f.cells[layer][0].x);
  assert.deepEqual(xs, [0, 25, 50, 75, 100]);
  assert.equal(p.frames[1].cells[layer][0].mood, 'happy');
  assert.equal(p.frames[3].cells[layer][0].mood, 'sad');
  assert.equal(p.frames[2].cells[layer][0].color, '#808080');
  assert.equal(addInbetweens(p, 4, 2), 0, 'no next frame');
});

test('unmatched objects swap halfway', () => {
  const p = createProject();
  const layer = p.layers[1].id;
  getCell(p, 0, layer).push(createCharacter('cat', 0, 0));
  addFrame(p, 0);
  getCell(p, 1, layer).push(createCharacter('dog', 0, 0));
  addInbetweens(p, 0, 3, 'linear');
  assert.deepEqual(p.frames.map((f) => f.cells[layer].map((o) => o.kind).join()), ['cat', 'cat', 'dog', 'dog', 'dog']);
});

test('angles take the short way and easings end at 0 and 1', () => {
  assert.ok(Math.abs(lerpAngle(3, -3, 0.5) - Math.PI) < 1e-9);
  assert.equal(lerpColor('#ff0000', 'none', 0.2), '#ff0000');
  for (const [name, fn] of Object.entries(EASINGS)) {
    assert.ok(Math.abs(fn(0)) < 1e-9 && Math.abs(fn(1) - 1) < 1e-9, name);
  }
});

test('new frames keep the background scene', () => {
  const p = createProject();
  getCell(p, 0, p.layers[0].id).push(createScene('sea', p.width, p.height));
  getCell(p, 0, p.layers[1].id).push(createCharacter('cat', 0, 0));
  addFrame(p, 0);
  assert.equal(p.frames[1].cells[p.layers[0].id][0].kind, 'sea');
  assert.equal(p.frames[1].cells[p.layers[1].id].length, 0);
});

test('sample project is valid and round-trips', () => {
  const demo = createDemoProject();
  assert.equal(demo.frames.length, 21);
  const back = deserialize(serialize(demo));
  assert.equal(back.frames.length, 21);
});
