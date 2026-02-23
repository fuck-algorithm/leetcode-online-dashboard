// IndexedDB helper for storing user preferences like sort settings

const DB_NAME = 'leetcode-dashboard';
const DB_VERSION = 1;
const STORE_NAME = 'preferences';

let db: IDBDatabase | null = null;

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });
};

// Get value from IndexedDB
export const getFromIndexedDB = async <T>(key: string): Promise<T | null> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB get error:', error);
    return null;
  }
};

// Set value to IndexedDB
export const setToIndexedDB = async <T>(key: string, value: T): Promise<void> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB set error:', error);
  }
};

// Constants for keys
export const STORAGE_KEYS = {
  RANKINGS_SORT_FIELD: 'rankings_sort_field',
  RANKINGS_SORT_ORDER: 'rankings_sort_order',
  GITHUB_STAR_COUNT: 'github_star_count',
  GITHUB_STAR_CACHE_TIME: 'github_star_cache_time',
} as const;
