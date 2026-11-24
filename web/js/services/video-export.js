// Records the animation to a video file with MediaRecorder (MP4 when supported, otherwise WebM).

import { renderFrame } from '../render/renderer.js';

const TYPES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function videoSupport() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
  if (!type) return null;
  return { type, ext: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

/**
 * Renders every frame in real time and records it.
 * @param {object} project
 * @param {{ maxSide?: number, repeat?: number, onProgress?: (n: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<{ blob: Blob, ext: string }>}
 */
export async function exportVideo(project, { maxSide = 1280, repeat = 1, onProgress, signal } = {}) {
  const support = videoSupport();
  if (!support) throw new Error('Этот браузер не умеет записывать видео. Обновите Chrome.');
  const scale = Math.min(1, maxSide / Math.max(project.width, project.height));
  const canvas = document.createElement('canvas');
  // Video encoders need even dimensions.
  canvas.width = Math.round((project.width * scale) / 2) * 2;
  canvas.height = Math.round((project.height * scale) / 2) * 2;
  const ctx = canvas.getContext('2d');
  renderFrame(ctx, project, 0, canvas.width / project.width);

  const stream = canvas.captureStream(project.fps);
  const recorder = new MediaRecorder(stream, { mimeType: support.type, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  const total = project.frames.length * repeat;
  const interval = 1000 / project.fps;
  recorder.start(250);
  const start = performance.now();
  try {
    for (let n = 0; n < total; n++) {
      if (signal?.aborted) throw new DOMException('Экспорт отменён', 'AbortError');
      renderFrame(ctx, project, n % project.frames.length, canvas.width / project.width);
      onProgress?.((n + 1) / total);
      // Wait until this frame's slot ends, measured from the start to avoid drift.
      const wait = start + (n + 1) * interval - performance.now();
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
  } finally {
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  }
  await stopped;
  return { blob: new Blob(chunks, { type: support.type.split(';')[0] }), ext: support.ext };
}
