export interface InspectionDraft {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

const DB_NAME = 'erf-offline';
const STORE = 'inspection-outbox';

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraft(payload: Record<string, unknown>): Promise<void> {
  const db = await database();
  const id = crypto.randomUUID();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ id, payload, createdAt: new Date().toISOString() } satisfies InspectionDraft);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function drafts(): Promise<InspectionDraft[]> {
  const db = await database();
  const result = await new Promise<InspectionDraft[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as InspectionDraft[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function removeDraft(id: string): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}
