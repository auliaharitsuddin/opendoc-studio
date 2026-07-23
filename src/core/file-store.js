// Ephemeral scratch storage, used ONLY by the batch/automation tool, which needs
// intermediate results to survive across several sequential processing steps.
// Every other tool in OpenDoc Studio keeps files purely in memory (a Blob held by
// a JS variable) and never calls this module at all — closing the tab already
// erases those. This store exists so a crashed/closed batch tab still gets swept.
import { get, set, del, keys } from 'idb-keyval';

const PREFIX = 'opendoc-scratch:';

function key(id) {
  return `${PREFIX}${id}`;
}

export async function putScratch(blob) {
  const id = crypto.randomUUID();
  await set(key(id), { blob, createdAt: Date.now() });
  return id;
}

export async function getScratch(id) {
  const record = await get(key(id));
  return record ? record.blob : undefined;
}

export async function deleteScratch(id) {
  await del(key(id));
}

export async function purgeStaleScratch(maxAgeMs) {
  const allKeys = await keys();
  const now = Date.now();
  await Promise.all(
    allKeys
      .filter((k) => typeof k === 'string' && k.startsWith(PREFIX))
      .map(async (k) => {
        const record = await get(k);
        if (!record || now - record.createdAt > maxAgeMs) {
          await del(k);
        }
      })
  );
}

export async function purgeAllScratch() {
  const allKeys = await keys();
  await Promise.all(
    allKeys.filter((k) => typeof k === 'string' && k.startsWith(PREFIX)).map((k) => del(k))
  );
}
