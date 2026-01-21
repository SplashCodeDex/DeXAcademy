/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { AsyncStorage } from './storage';

// Mock IndexedDB
const mockStore: Record<string, any> = {};
const mockIDB = {
  open: vi.fn().mockReturnValue({
    result: {
      objectStoreNames: { contains: () => true },
      createObjectStore: vi.fn(),
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: (val: any, key: string) => { mockStore[key] = val; },
          get: (key: string) => ({ result: mockStore[key] }),
          delete: (key: string) => { delete mockStore[key]; },
          clear: () => { for (const k in mockStore) delete mockStore[k]; }
        }),
        oncomplete: null,
        onerror: null
      })
    },
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  })
};

// Manually trigger the success callback for the mock
const triggerOpenSuccess = () => {
   const req = mockIDB.open.mock.results[0].value;
   if (req.onsuccess) req.onsuccess({ target: { result: req.result } });
};

describe('AsyncStorage', () => {
  beforeAll(() => {
    // CRITICAL: Stub the global indexedDB object for JSDOM
    vi.stubGlobal('indexedDB', mockIDB);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store
    for (const key in mockStore) delete mockStore[key];
  });

  it('should set an item', async () => {
    // Trigger the async flow
    const promise = AsyncStorage.setItem('test-key', 'test-value');
    
    // Simulate IDB success
    triggerOpenSuccess();
    
    // Simulate Transaction Complete
    const openReq = mockIDB.open.mock.results[0].value;
    const trans = openReq.result.transaction();
    if (trans.oncomplete) trans.oncomplete();

    await promise;
    expect(mockStore['test-key']).toBe('test-value');
  });

  it('should handle objects correctly', async () => {
    const key = 'obj-key';
    const value = { foo: 'bar' };
    
    const promise = AsyncStorage.setObject(key, value);
    
    triggerOpenSuccess();
    const openReq = mockIDB.open.mock.results[0].value;
    const trans = openReq.result.transaction();
    if (trans.oncomplete) trans.oncomplete();

    await promise;
    expect(mockStore[key]).toBe(JSON.stringify(value));
  });

  it('should return null for non-existent objects', async () => {
    const promise = AsyncStorage.getObject('missing');
    
    triggerOpenSuccess();
    const openReq = mockIDB.open.mock.results[0].value;
    const trans = openReq.result.transaction();
    if (trans.oncomplete) trans.oncomplete();
    
    const result = await promise;
    expect(result).toBeNull();
  });
});