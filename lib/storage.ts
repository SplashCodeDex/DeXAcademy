/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'mockup_studio_db';
const STORE_NAME = 'keyval';
const DB_VERSION = 1;

/**
 * Open (or create) the IndexedDB database.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Perform a transaction on the database.
 */
const performTransaction = <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> => {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      
      let request: IDBRequest<T> | void;
      try {
        request = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      transaction.oncomplete = () => {
        // If the callback returned a request, resolve with its result
        if (request) {
          resolve(request.result);
        } else {
          resolve(undefined as T);
        }
      };

      transaction.onerror = () => reject(transaction.error);
    });
  });
};

export const AsyncStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await performTransaction('readwrite', (store) => store.put(value, key));
    } catch (e) {
      console.error('AsyncStorage setItem Error:', e);
    }
  },

  getItem: async (key: string): Promise<string | null> => {
    try {
      const result = await performTransaction<string>('readonly', (store) => store.get(key));
      return result || null;
    } catch (e) {
      console.error('AsyncStorage getItem Error:', e);
      return null;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await performTransaction('readwrite', (store) => store.delete(key));
    } catch (e) {
      console.error('AsyncStorage removeItem Error:', e);
    }
  },

  clear: async (): Promise<void> => {
    try {
      await performTransaction('readwrite', (store) => store.clear());
    } catch (e) {
      console.error('AsyncStorage clear Error:', e);
    }
  },
  
  // Helper to store objects directly
  setObject: async (key: string, value: any): Promise<void> => {
    const json = JSON.stringify(value);
    await AsyncStorage.setItem(key, json);
  },

  getObject: async <T>(key: string): Promise<T | null> => {
    const json = await AsyncStorage.getItem(key);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error('JSON Parse Error', e);
      return null;
    }
  },

  /**
   * Performs an atomic Read-Modify-Write operation.
   * Essential for updating lists or counters where concurrency might be an issue.
   */
  updateObject: async <T>(key: string, updater: (current: T | null) => T): Promise<void> => {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          let currentVal: T | null = null;
          if (req.result) {
            try {
              currentVal = JSON.parse(req.result);
            } catch (e) {
              console.warn("Failed to parse existing value during update", e);
            }
          }
          
          const newVal = updater(currentVal);
          store.put(JSON.stringify(newVal), key);
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    });
  }
};