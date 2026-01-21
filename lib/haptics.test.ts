/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Haptics, NotificationFeedbackType } from './haptics';

describe('Haptics', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore navigator
    Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
    });
  });

  it('should call navigator.vibrate when available', async () => {
    const mockVibrate = vi.fn();
    
    // Mock navigator.vibrate
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true
    });

    await Haptics.notificationAsync(NotificationFeedbackType.Success);
    
    expect(mockVibrate).toHaveBeenCalled();
    // Success pattern defined in haptics.ts is [10, 30, 10]
    expect(mockVibrate).toHaveBeenCalledWith([10, 30, 10]);
  });

  it('should not crash if navigator.vibrate is undefined', async () => {
    // Mock navigator without vibrate
    Object.defineProperty(globalThis, 'navigator', {
      value: {}, // Empty object, no vibrate method
      writable: true,
      configurable: true
    });

    // Should not throw
    await expect(Haptics.selectionAsync()).resolves.not.toThrow();
  });

  it('should not crash if navigator is undefined (Node environment simulation)', async () => {
    // @ts-ignore
    delete globalThis.navigator;

    // Should not throw
    await expect(Haptics.selectionAsync()).resolves.not.toThrow();
  });
});