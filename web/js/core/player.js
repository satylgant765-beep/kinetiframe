// Plays frames at the project's frame rate by advancing ui.frameIndex, with the project's sound.

import { playFrom, stopAll } from '../services/audio.js';

export class Player {
  constructor(store) {
    this.store = store;
    this.raf = 0;
    store.on('ui', (patch) => {
      if (patch && 'playing' in patch) patch.playing ? this.start() : this.stop();
    });
  }

  toggle() {
    this.store.setUI({ playing: !this.store.ui.playing, selectedId: null });
  }

  start() {
    cancelAnimationFrame(this.raf);
    const { project, ui } = this.store;
    if (project.frames.length < 2) {
      this.store.setUI({ playing: false });
      return;
    }
    if (!ui.loop && ui.frameIndex >= project.frames.length - 1) this.store.setUI({ frameIndex: 0 });
    playFrom(project, this.store.ui.frameIndex).catch(() => {});
    let last = performance.now();
    const tick = (now) => {
      if (!this.store.ui.playing) return;
      const interval = 1000 / this.store.project.fps;
      if (now - last >= interval) {
        last = now - ((now - last) % interval);
        this.advance();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  advance() {
    const { project, ui } = this.store;
    const next = ui.frameIndex + 1;
    if (next < project.frames.length) this.store.setUI({ frameIndex: next });
    else if (ui.loop) {
      this.store.setUI({ frameIndex: 0 });
      playFrom(project, 0).catch(() => {});
    }
    else this.store.setUI({ playing: false });
  }

  stop() {
    cancelAnimationFrame(this.raf);
    stopAll();
  }
}
