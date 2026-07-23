// Generic "run a tool" orchestrator shared by every view: hands the input file to a
// worker job, then owns the download + guaranteed cleanup of every object URL and
// in-memory buffer involved, regardless of how the job finishes.
export async function downloadResult(blob, filename) {
  const url = URL.createObjectURL(blob);
  const downloadId = await chrome.downloads.download({ url, filename, saveAs: false });

  return new Promise((resolve) => {
    function onChanged(delta) {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === 'complete' || delta.state?.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        URL.revokeObjectURL(url);
        resolve(delta.state.current === 'complete');
      }
    }
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

// Wipes every reference an in-progress tool session was holding: input buffers,
// output blob, and (if the tool used batch/scratch mode) its IndexedDB record.
export async function wipeSession(session) {
  session.inputBuffers?.forEach((buf) => {
    if (buf instanceof ArrayBuffer) {
      new Uint8Array(buf).fill(0);
    }
  });
  session.objectUrls?.forEach((url) => URL.revokeObjectURL(url));
  if (session.scratchId) {
    const { deleteScratch } = await import('./file-store.js');
    await deleteScratch(session.scratchId);
  }
  session.inputBuffers = [];
  session.objectUrls = [];
  session.scratchId = null;
}

export function readFileAsArrayBuffer(file) {
  return file.arrayBuffer();
}

export function suggestOutputName(originalName, newExt) {
  const base = originalName.replace(/\.[^.]+$/, '');
  return `${base}.${newExt}`;
}
