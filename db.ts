import { CatalogRecord } from './types';

const DB_NAME = 'CarCatalogDB';
const DB_VERSION = 1;
const STORE_NAME = 'catalogs';

let db: IDBDatabase;

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening DB', request.error);
      reject(false);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(true);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveCatalog = (catalog: Omit<CatalogRecord, 'id'>): Promise<CatalogRecord> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(catalog);

    request.onsuccess = () => {
      // Return the full record including the auto-generated ID
      resolve({ ...catalog, id: request.result as number });
    };

    request.onerror = () => {
      console.error('Error saving catalog', request.error);
      reject(request.error);
    };
  });
};

export const getAllCatalogs = (): Promise<CatalogRecord[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by newest first
      resolve(request.result.sort((a, b) => b.id - a.id));
    };

    request.onerror = () => {
      console.error('Error getting all catalogs', request.error);
      reject(request.error);
    };
  });
};

export const deleteCatalog = (id: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      console.error('Error deleting catalog', request.error);
      reject(request.error);
    };
  });
};
