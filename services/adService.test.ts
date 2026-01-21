/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { adService } from './adService';

describe('AdService', () => {
    beforeEach(() => {
        vi.spyOn(window, 'dispatchEvent');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should dispatch custom event to window', async () => {
        // Start the ad flow
        const promise = adService.showRewardedAd();

        // Check if event was dispatched
        expect(window.dispatchEvent).toHaveBeenCalled();
        const event = (window.dispatchEvent as any).mock.calls[0][0] as CustomEvent;
        expect(event.type).toBe('sku_foundry_show_ad');
        expect(event.detail.onComplete).toBeDefined();

        // Simulate UI completion callback
        event.detail.onComplete(true);
        
        const result = await promise;
        expect(result).toBe(true);
    });

    it('should handle failure callback', async () => {
        const promise = adService.showRewardedAd();
        const event = (window.dispatchEvent as any).mock.calls[0][0] as CustomEvent;
        
        // Simulate Failure
        event.detail.onComplete(false);
        
        const result = await promise;
        expect(result).toBe(false);
    });
});