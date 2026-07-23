// Thin promise + progress wrapper around postMessage so tool views don't hand-roll
// message-id bookkeeping. Every worker speaks the same tiny protocol:
//   in:  { id, type, payload }
//   out: { id, kind: 'progress', percent, message } | { id, kind: 'done', result } | { id, kind: 'error', message }
let counter = 0;
const pool = new Map();

export function createWorkerClient(workerUrl) {
  const worker = new Worker(workerUrl, { type: 'module' });
  const pending = new Map();

  worker.onmessage = (event) => {
    const { id, kind, percent, message, result, transferNames } = event.data;
    const entry = pending.get(id);
    if (!entry) return;
    if (kind === 'progress') {
      entry.onProgress?.(percent, message);
    } else if (kind === 'done') {
      pending.delete(id);
      entry.resolve(result);
    } else if (kind === 'error') {
      pending.delete(id);
      entry.reject(new Error(message));
    }
  };

  worker.onerror = (event) => {
    // Logs the precise source location for developers; the Error shown to
    // the user (via tool-workspace's "Gagal: ..." toast) stays plain-language.
    console.error('[OpenDoc Studio] worker-level error:', event.message, 'at', `${event.filename}:${event.lineno}:${event.colno}`);
    for (const [id, entry] of pending) {
      entry.reject(new Error(event.message || 'Worker error'));
      pending.delete(id);
    }
  };

  function run(type, payload, { onProgress, transfer = [] } = {}) {
    const id = `job-${++counter}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, type, payload }, transfer);
    });
  }

  function terminate() {
    worker.terminate();
    for (const [, entry] of pending) {
      entry.reject(new Error('Worker terminated'));
    }
    pending.clear();
  }

  pool.set(worker, { terminate });
  return { run, terminate, worker };
}

export function terminateAllWorkers() {
  for (const { terminate } of pool.values()) terminate();
  pool.clear();
}
