// Sound: decodes the project's audio clips and plays them in sync with the frames.
// A clip is { id, name, src (data: URL), startFrame, volume, duration }.

import { uid } from '../core/project.js';

const MAX_CLIP_BYTES = 15 * 1024 * 1024;

let context = null;
const buffers = new Map(); // src -> Promise<AudioBuffer>
let playing = [];

export function audioContext() {
  if (!context) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('Этот браузер не поддерживает звук.');
    context = new Ctx();
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

export function decode(src) {
  if (!buffers.has(src)) {
    const promise = fetch(src)
      .then((r) => r.arrayBuffer())
      .then((data) => audioContext().decodeAudioData(data));
    promise.catch(() => buffers.delete(src));
    buffers.set(src, promise);
  }
  return buffers.get(src);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Turns an audio file or recording into a clip. Throws a readable error for bad input. */
export async function createClip(blob, name, startFrame = 0) {
  if (blob.size > MAX_CLIP_BYTES) throw new Error('Файл больше 15 МБ. Выберите звук покороче.');
  const src = await blobToDataUrl(blob);
  let buffer;
  try {
    buffer = await decode(src);
  } catch {
    throw new Error('Не удалось прочитать звук. Подойдут MP3, M4A, WAV или OGG.');
  }
  return { id: uid('clip'), name, src, startFrame, volume: 1, duration: buffer.duration };
}

/**
 * Schedules clips on an AudioContext destination as if playback started at `fromFrame`.
 * Returns the started source nodes.
 */
export async function schedule(clips, { fps, fromFrame = 0, destination, when = 0, until = Infinity }) {
  const ctx = audioContext();
  const out = destination || ctx.destination;
  const start = when || ctx.currentTime + 0.05;
  const decoded = await Promise.all(clips.map((c) => decode(c.src).catch(() => null)));
  const nodes = [];
  clips.forEach((clip, i) => {
    const buffer = decoded[i];
    if (!buffer) return;
    const offset = (fromFrame - clip.startFrame) / fps; // Seconds into the clip at playback start.
    if (offset >= buffer.duration) return;
    const delay = Math.max(0, -offset);
    if (delay >= until) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = clip.volume ?? 1;
    source.connect(gain).connect(out);
    source.start(start + delay, Math.max(0, offset));
    if (Number.isFinite(until)) source.stop(start + until);
    nodes.push(source);
  });
  return nodes;
}

/** Plays the project's sound from a frame (used by the player). */
export async function playFrom(project, fromFrame) {
  stopAll();
  const clips = project.audio || [];
  if (!clips.length) return;
  const untilEnd = (project.frames.length - fromFrame) / project.fps;
  const token = {};
  playing.token = token;
  const nodes = await schedule(clips, { fps: project.fps, fromFrame, until: untilEnd });
  if (playing.token !== token) { nodes.forEach((n) => n.stop()); return; }
  playing.push(...nodes);
}

export function stopAll() {
  for (const node of playing) {
    try { node.stop(); } catch { /* already stopped */ }
  }
  playing = [];
  playing.token = null;
}

/** Plays one clip on its own, for previewing it in the sound panel. */
export async function preview(clip) {
  stopAll();
  const nodes = await schedule([{ ...clip, startFrame: 0 }], { fps: 1 });
  playing.push(...nodes);
}

/** Records from the microphone. Returns { stop(): Promise<Blob> }. */
export async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Запись с микрофона в этом браузере недоступна.');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error('Нет доступа к микрофону. Разрешите его в настройках сайта в Chrome.');
  }
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.start();
  return {
    stop: () => new Promise((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
      };
      recorder.stop();
    }),
  };
}
