/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface AdNetworkInterface {
    initialize(): Promise<void>;
    showRewardedAd(): Promise<boolean>;
}

export type AdShowRequest = {
    onComplete: (success: boolean) => void;
};

// Service for video ad network integration.
// Uses Google IMA via a custom event bridge to the UI Overlay.
class AdService implements AdNetworkInterface {
    constructor() {
        this.initialize();
    }

    async initialize(): Promise<void> {
        console.log('[AdService] Initializing Web Environment');
    }

    async showRewardedAd(): Promise<boolean> {
        // Dispatch an event to the global window. The <AdOverlay /> component in App.tsx will pick this up.
        // This triggers the real Google IMA SDK flow.
        return new Promise<boolean>((resolve) => {
            let isResolved = false;

            const complete = (result: boolean) => {
                if (isResolved) return;
                isResolved = true;
                resolve(result);
            };

            const detail: AdShowRequest = {
                onComplete: complete
            };

            const event = new CustomEvent('mockup_studio_show_ad', { detail });
            window.dispatchEvent(event);

            // Safety Timeout: 120s (2 minutes)
            // This allows for slow loading + full length video ads (30-60s) + end cards
            setTimeout(() => {
                if (!isResolved) {
                    console.warn('[AdService] Ad request timed out');
                    // Force the UI Overlay to close if it's still stuck
                    window.dispatchEvent(new CustomEvent('mockup_studio_close_ad'));
                    complete(false);
                }
            }, 120000);
        });
    }
}

export const adService = new AdService();