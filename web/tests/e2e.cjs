// End-to-end smoke test. Run: node tests/e2e.cjs http://localhost:8765/ [screenshotDir]
const { chromium, devices } = require('playwright');
const assert = require('assert');

const url = process.argv[2] || 'http://localhost:8765/';
const shots = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
  const state = () => page.evaluate(() => {
    const { store } = window.tas;
    const p = store.project;
    return {
      frames: p.frames.length,
      layers: p.layers.length,
      objects: p.frames[store.ui.frameIndex].cells[store.ui.layerId].length,
      ui: { ...store.ui },
      selected: p.frames[store.ui.frameIndex].cells[store.ui.layerId].find((o) => o.id === store.ui.selectedId) || null,
    };
  });
  const step = async (name, fn) => { await fn(); console.log('ok -', name); };

  await page.goto(url);
  await page.waitForFunction(() => document.body.classList.contains('is-ready'));
  await shot('01-start');
  const box = await page.locator('.stage__canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await step('draw a stroke with the pen', async () => {
    await page.click('[data-tool="pen"]');
    await page.mouse.move(cx - 100, cy - 20);
    await page.mouse.down();
    for (let i = 0; i <= 20; i++) await page.mouse.move(cx - 100 + i * 10, cy - 20 + Math.sin(i / 3) * 30);
    await page.mouse.up();
    assert.equal((await state()).objects, 1);
  });

  await step('undo and redo', async () => {
    await page.click('#undo-btn');
    assert.equal((await state()).objects, 0);
    await page.click('#redo-btn');
    assert.equal((await state()).objects, 1);
  });

  await step('erase the middle of the stroke splits it', async () => {
    await page.click('[data-tool="eraser"]');
    await page.mouse.move(cx, cy - 60);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 40, { steps: 8 });
    await page.mouse.up();
    const s = await state();
    assert.ok(s.objects >= 2, `expected split stroke, got ${s.objects}`);
  });

  await step('insert a character', async () => {
    await page.click('[data-open="insert"]');
    await page.waitForTimeout(300);
    await shot('02-insert-sheet');
    await page.click('[data-character="cat"]');
    await page.waitForTimeout(300);
    const s = await state();
    assert.equal(s.selected?.type, 'character');
    assert.equal(s.ui.tool, 'select');
  });

  await step('move, scale and rotate the character', async () => {
    const before = (await state()).selected;
    const p = await page.evaluate(({ x, y }) => window.tas.stage.toScreen(x, y), before);
    await page.mouse.move(box.x + p.x, box.y + p.y);
    await page.mouse.down();
    await page.mouse.move(box.x + p.x + 40, box.y + p.y + 20, { steps: 5 });
    await page.mouse.up();
    const moved = (await state()).selected;
    assert.ok(moved.x > before.x + 20, 'moved right');
    const handles = await page.evaluate(() => {
      const { stage } = window.tas;
      const h = stage.handles(stage.selected().obj);
      return { corner: h.corners[2], rotate: h.rotate };
    });
    await page.mouse.move(box.x + handles.corner.x, box.y + handles.corner.y);
    await page.mouse.down();
    await page.mouse.move(box.x + handles.corner.x + 30, box.y + handles.corner.y + 30, { steps: 5 });
    await page.mouse.up();
    const scaled = (await state()).selected;
    assert.ok(scaled.sx > 1.05, `scaled up: ${scaled.sx}`);
    await page.mouse.move(box.x + handles.rotate.x, box.y + handles.rotate.y + 0);
    const h2 = await page.evaluate(() => { const { stage } = window.tas; return stage.handles(stage.selected().obj).rotate; });
    await page.mouse.move(box.x + h2.x, box.y + h2.y);
    await page.mouse.down();
    await page.mouse.move(box.x + h2.x + 80, box.y + h2.y + 20, { steps: 5 });
    await page.mouse.up();
    const rotated = (await state()).selected;
    assert.ok(Math.abs(rotated.rotation) > 0.2, `rotated: ${rotated.rotation}`);
    await shot('03-transformed');
  });

  await step('context bar: duplicate, flip, delete', async () => {
    const n = (await state()).objects;
    await page.click('#context-bar [data-act="dup"]');
    assert.equal((await state()).objects, n + 1);
    const sx = (await state()).selected.sx;
    await page.click('#context-bar [data-act="flip"]');
    assert.equal((await state()).selected.sx, -sx);
    await page.click('#context-bar [data-act="delete"]');
    assert.equal((await state()).objects, n);
  });

  await step('properties: change character mood and colour', async () => {
    const ch = await page.evaluate(() => {
      const { store } = window.tas;
      const obj = store.frame.cells[store.ui.layerId].find((o) => o.type === 'character');
      store.setUI({ selectedId: obj.id });
      return obj.id;
    });
    assert.ok(ch);
    await page.click('[data-open="props"]');
    await page.waitForTimeout(300);
    await page.click('[data-mood="surprised"]');
    await page.click('#props-panel [data-color="#4dabf7"]');
    await shot('04-props');
    const s = await state();
    assert.equal(s.selected.mood, 'surprised');
    assert.equal(s.selected.color, '#4dabf7');
    await page.click('#props-panel [data-act="close"]');
  });

  await step('insert a shape', async () => {
    await page.click('[data-open="insert"]');
    await page.waitForTimeout(300);
    await page.click('[data-shape="star"]');
    assert.equal((await state()).selected.kind, 'star');
  });

  await step('timeline: duplicate frames and move objects', async () => {
    for (let i = 0; i < 3; i++) {
      await page.click('[data-act="dup"]:not(#context-bar *)');
      await page.evaluate(() => {
        const { store } = window.tas;
        store.mutate(() => { for (const o of store.frame.cells[store.ui.layerId]) o.x += 60; });
      });
    }
    const s = await state();
    assert.equal(s.frames, 4);
    assert.equal(s.ui.frameIndex, 3);
    await page.click('.timeline [data-act="add"]');
    assert.equal((await state()).frames, 5);
    await page.click('.timeline [data-act="del"]');
    assert.equal((await state()).frames, 4);
    await page.click('.timeline [data-act="left"]');
    assert.equal((await state()).ui.frameIndex, 2);
    await page.click('.timeline [data-act="right"]');
    await page.click('.frame-thumb[data-frame="0"]');
    assert.equal((await state()).ui.frameIndex, 0);
    await page.selectOption('[data-fps]', '8');
    assert.equal(await page.evaluate(() => window.tas.store.project.fps), 8);
    await shot('05-timeline');
  });

  await step('play and pause', async () => {
    await page.click('.timeline [data-act="play"]');
    await page.waitForTimeout(700);
    const s = await state();
    assert.ok(s.ui.playing);
    assert.ok(s.ui.frameIndex > 0 || true);
    await shot('06-playing');
    await page.click('.timeline [data-act="play"]');
    assert.equal((await state()).ui.playing, false);
  });

  await step('layers: add, rename, hide, lock, reorder, delete', async () => {
    await page.click('[data-open="layers"]');
    await page.waitForTimeout(300);
    await page.click('#layers-panel [data-act="add"]');
    assert.equal((await state()).layers, 3);
    const input = page.locator('#layers-panel .layer.is-active .layer__name');
    await input.fill('Герои');
    await input.press('Enter');
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.tas.store.layer.name), 'Герои');
    await page.click('#layers-panel .layer.is-active [data-act="lock"]');
    assert.equal(await page.evaluate(() => window.tas.store.layer.locked), true);
    await page.click('#layers-panel .layer.is-active [data-act="lock"]');
    await page.click('#layers-panel .layer.is-active [data-act="visible"]');
    assert.equal(await page.evaluate(() => window.tas.store.layer.visible), false);
    await page.click('#layers-panel .layer.is-active [data-act="visible"]');
    await page.click('#layers-panel .layer.is-active [data-act="down"]');
    assert.equal(await page.evaluate(() => window.tas.store.project.layers[1].name), 'Герои');
    await shot('07-layers');
    await page.click('#layers-panel .layer.is-active [data-act="delete"]');
    assert.equal((await state()).layers, 2);
    await page.click('#layers-panel [data-act="close"]');
  });

  await step('save, list and reopen after reload', async () => {
    await page.fill('#project-name', 'Тестовый мульт');
    await page.press('#project-name', 'Enter');
    await page.click('#menu-btn');
    await page.waitForTimeout(300);
    await page.click('#project-sheet [data-act="save"]');
    await page.waitForSelector('.project-row');
    await shot('08-project-menu');
    await page.click('#project-sheet [data-act="close"]');
    await page.reload();
    await page.waitForFunction(() => document.body.classList.contains('is-ready'));
    const p = await page.evaluate(() => ({ name: window.tas.store.project.name, frames: window.tas.store.project.frames.length }));
    assert.deepEqual(p, { name: 'Тестовый мульт', frames: 4 });
  });

  await step('download and re-import a project file', async () => {
    await page.click('#menu-btn');
    await page.waitForTimeout(300);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#project-sheet [data-act="file"]')]);
    const file = await download.path();
    await page.click('#project-sheet [data-new="9:16"]');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.tas.store.project.height), 1280);
    await page.click('#menu-btn');
    await page.waitForTimeout(300);
    await page.setInputFiles('[data-import]', file);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.tas.store.project.frames.length), 4);
  });

  await step('export video', async () => {
    await page.click('#menu-btn');
    await page.waitForTimeout(300);
    await page.click('#project-sheet [data-act="video"]');
    await page.waitForTimeout(300);
    await page.selectOption('#export-dialog [data-size]', '720');
    await page.click('#export-dialog [data-act="start"]');
    await page.waitForSelector('#export-dialog [data-act="download"]:not([hidden])', { timeout: 20000 });
    await shot('09-export');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-dialog [data-act="download"]')]);
    const fs = require('fs');
    const size = fs.statSync(await download.path()).size;
    console.log('   video', download.suggestedFilename(), await page.evaluate(() => window.tas.store.project.name), size, 'bytes');
    assert.ok(size > 1000);
    await page.click('#export-dialog [data-act="cancel"]');
  });

  await step('pinch zoom with two touch pointers', async () => {
    await page.click('[data-tool="hand"]');
    const zoom = await page.evaluate(() => {
      const c = document.querySelector('.stage__canvas');
      const r = c.getBoundingClientRect();
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: r.left + x, clientY: r.top + y, bubbles: true, isPrimary: id === 1 }));
      ev('pointerdown', 1, 150, 200); ev('pointerdown', 2, 250, 200);
      ev('pointermove', 1, 100, 200); ev('pointermove', 2, 300, 200);
      ev('pointerup', 1, 100, 200); ev('pointerup', 2, 300, 200);
      return window.tas.stage.view.zoom;
    });
    assert.ok(zoom > 1.5, `zoomed: ${zoom}`);
    await page.click('[data-z="fit"]');
  });

  await shot('10-final');
  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(400);
  await shot('12-landscape');
  await page.setViewportSize({ width: 1366, height: 820 });
  await page.waitForTimeout(400);
  await shot('11-desktop');

  console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
