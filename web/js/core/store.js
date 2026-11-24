// Central application state with undo/redo history.
// Components listen for 'project' (data changed), 'ui' (selection, tool, frame) and 'history'.

const HISTORY_LIMIT = 60;

export class Store extends EventTarget {
  constructor(project) {
    super();
    this.project = project;
    this.ui = {
      tool: 'select',
      frameIndex: 0,
      layerId: project.layers[project.layers.length - 1].id,
      selectedId: null,
      color: '#ff5a5f',
      fill: '#ffd166',
      strokeWidth: 6,
      eraserSize: 24,
      onion: true,
      playing: false,
      loop: true,
    };
    this.undoStack = [];
    this.redoStack = [];
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, handler) {
    this.addEventListener(type, (e) => handler(e.detail));
  }

  /** Saves the current state so the next change can be undone. Call before mutating. */
  checkpoint() {
    this.undoStack.push(JSON.stringify(this.project));
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.emit('history');
  }

  /** Records history, applies `fn(project)` and notifies listeners. */
  mutate(fn) {
    this.checkpoint();
    const result = fn(this.project);
    this.changed();
    return result;
  }

  /** Notifies that the project changed (for live edits after a checkpoint). */
  changed() {
    this.project.updatedAt = Date.now();
    this.emit('project');
  }

  setUI(patch) {
    Object.assign(this.ui, patch);
    this.emit('ui', patch);
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  undo() {
    if (!this.canUndo()) return;
    this.redoStack.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.undoStack.pop());
    this.afterRestore();
  }

  redo() {
    if (!this.canRedo()) return;
    this.undoStack.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.redoStack.pop());
    this.afterRestore();
  }

  /** Replaces the whole project (new or opened). Clears history. */
  load(project) {
    this.project = project;
    this.undoStack = [];
    this.redoStack = [];
    this.ui.frameIndex = 0;
    this.ui.selectedId = null;
    this.ui.layerId = project.layers[project.layers.length - 1].id;
    this.emit('project', { replaced: true });
    this.emit('ui', {});
    this.emit('history');
  }

  afterRestore() {
    const p = this.project;
    const ui = this.ui;
    ui.frameIndex = Math.min(ui.frameIndex, p.frames.length - 1);
    if (!p.layers.some((l) => l.id === ui.layerId)) ui.layerId = p.layers[p.layers.length - 1].id;
    ui.selectedId = null;
    this.emit('project');
    this.emit('ui', {});
    this.emit('history');
  }

  get frame() { return this.project.frames[this.ui.frameIndex]; }
  get layer() { return this.project.layers.find((l) => l.id === this.ui.layerId); }
}
