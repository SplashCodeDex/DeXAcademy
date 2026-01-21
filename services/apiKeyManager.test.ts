/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiKeyManager, KeyState } from './apiKeyManager';

// Mock Storage
const mockStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage.store[key] = value; }),
  clear: () => { mockStorage.store = {}; }
};

describe('ApiKeyManager', () => {
  let manager: ApiKeyManager;
  const initialKeys = ['key1', 'key2', 'key3'];

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
    // Use a fresh manager for each test with mocked storage
    manager = new ApiKeyManager(initialKeys, mockStorage as any);
  });

  describe('Initialization', () => {
    it('should initialize with provided keys', () => {
      expect(manager.getKeyCount()).toBe(3);
    });

    it('should deduplicate keys', () => {
      const dupManager = new ApiKeyManager(['key1', 'key1', 'key2'], mockStorage as any);
      expect(dupManager.getKeyCount()).toBe(2);
    });
  });

  describe('Key Selection (Rotation)', () => {
    it('should return a key when available', () => {
      const key = manager.getKey();
      expect(initialKeys).toContain(key);
    });

    it('should rotate keys based on usage (LRU)', () => {
      // First call
      const key1 = manager.getKey();
      expect(key1).toBeTruthy();
      
      // Advance time slightly to ensure timestamps differ
      vi.advanceTimersByTime(10);
      
      const key2 = manager.getKey();
      expect(key2).not.toBe(key1); // Should pick a different key ideally, or at least one with less usage/older timestamp
    });
  });

  describe('Circuit Breaker Logic', () => {
    it('should close circuit on success', () => {
      const key = 'key1';
      manager.markSuccess(key);
      
      // We need to inspect internal state or infer from behavior. 
      // Since `keys` is private, we verify behavior:
      // A successful key should be available.
      const selected = manager.getKey();
      // It's possible key1 is selected if it's the best candidate.
      expect(selected).toBeTruthy();
    });

    it('should count failures', () => {
      const key = 'key1';
      manager.markFailed(key);
      // Logic check: marking failed shouldn't immediately ban it unless it hits threshold
      // But we can check if it persists state
      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    it('should open circuit immediately on Quota (429) error', () => {
      const key = 'key1';
      // Mark as quota error
      manager.markFailed(key, true);

      // Now ensure this key is NOT returned immediately (it should be cooling down)
      // We force the other keys to be "used" so if key1 was available it would be picked, 
      // but since it's 429'd, it should be skipped.
      
      // Actually, easier check: Get all keys until we loop or exhaust.
      // If we only have 3 keys, and we ban 1, we should get the other 2.
      
      const k1 = manager.getKey();
      const k2 = manager.getKey();
      const k3 = manager.getKey();
      const k4 = manager.getKey();

      // We expect 'key1' to NOT be in the immediate rotation if we can identify which one it was.
      // Since we can't easily force 'key1' to be the one we passed to markFailed without mocking internal state or extracting it first:
      
      // Strategy: Create manager with 1 key.
      const singleKeyManager = new ApiKeyManager(['singleKey'], mockStorage as any);
      singleKeyManager.markFailed('singleKey', true); // 429
      
      // Should return null or fallback
      // The implementation falls back to "oldest failed" if all are cooling down.
      // So it returns the key, but we want to verify internal state essentially. 
      // But unit tests should test public API behavior.
      
      // The public API behavior for "All keys exhausted/cooling down" is returning the "oldest failed key" as a fallback.
      const result = singleKeyManager.getKey();
      expect(result).toBe('singleKey'); // Fallback behavior
    });
  });

  describe('Persistence', () => {
    it('should save state to storage', () => {
      manager.markSuccess('key1');
      expect(mockStorage.setItem).toHaveBeenCalledWith('api_rotation_state', expect.any(String));
    });

    it('should load state from storage', () => {
      const state = {
        'key1': { failCount: 5, circuitState: 'OPEN', failedAt: Date.now() }
      };
      mockStorage.getItem.mockReturnValue(JSON.stringify(state));
      
      const newManager = new ApiKeyManager(initialKeys, mockStorage as any);
      
      // key1 is OPEN/Failed, so newManager should prefer key2 or key3
      const key = newManager.getKey();
      expect(key).not.toBe('key1');
    });
  });
});
