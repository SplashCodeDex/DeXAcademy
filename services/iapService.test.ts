/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { iapService } from './iapService';

describe('IAPService', () => {
    let originalPaymentRequest: any;

    beforeEach(() => {
        // Save original global
        originalPaymentRequest = (globalThis as any).PaymentRequest;
    });

    afterEach(() => {
        // Restore
        (globalThis as any).PaymentRequest = originalPaymentRequest;
        vi.restoreAllMocks();
    });

    it('should return products', async () => {
        const products = await iapService.getProducts();
        expect(products.length).toBeGreaterThan(0);
        expect(products[0].id).toBe('credits_10');
    });

    it('should fail if PaymentRequest is not supported', async () => {
        // Mock window.PaymentRequest as undefined
        // Note: global.PaymentRequest is undefined in JSDOM by default usually
        (globalThis as any).PaymentRequest = undefined;

        const result = await iapService.purchaseProduct('credits_10');
        expect(result.success).toBe(false);
        expect(result.error).toBe("Not Supported");
    });

    it('should handle successful purchase', async () => {
        // Mock PaymentRequest
        const mockShow = vi.fn().mockResolvedValue({
            requestId: 'req-123',
            details: { token: 'tok-123' },
            complete: vi.fn().mockResolvedValue(true)
        });

        (globalThis as any).PaymentRequest = vi.fn().mockImplementation(() => ({
            show: mockShow
        })) as any;

        const result = await iapService.purchaseProduct('credits_10');
        
        expect(result.success).toBe(true);
        expect(result.credits).toBe(10);
        expect(result.receipt).toBeDefined();
        expect(result.receipt?.transactionId).toBe('req-123');
    });

    it('should handle user cancellation', async () => {
        const mockShow = vi.fn().mockRejectedValue(new Error("User closed the payment sheet"));

        (globalThis as any).PaymentRequest = vi.fn().mockImplementation(() => ({
            show: mockShow
        })) as any;

        const result = await iapService.purchaseProduct('credits_10');
        
        expect(result.success).toBe(false);
        expect(result.error).toContain("User closed");
    });
});