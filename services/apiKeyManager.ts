/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal ApiKeyManager
 * Implements: Rotation, Circuit Breaker, Persistence, Exponential Backoff
 */

export interface KeyState {
    key: string;
    failCount: number;           // Consecutive failures
    failedAt: number | null;     // Timestamp of last failure
    isQuotaError: boolean;       // Was last error a 429?
    circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    lastUsed: number;
    successCount: number;
    totalRequests: number;
    halfOpenTestTime: number | null;
}

const CONFIG = {
    MAX_CONSECUTIVE_FAILURES: 5,
    COOLDOWN_TRANSIENT: 60 * 1000,    // 1 minute
    COOLDOWN_QUOTA: 5 * 60 * 1000,    // 5 minutes
    HALF_OPEN_TEST_DELAY: 60 * 1000,  // 1 minute after open
};

export class ApiKeyManager {
    private keys: KeyState[] = [];
    private storageKey = 'api_rotation_state';

    constructor(
        initialKeys: string[],
        private storage: Storage = typeof window !== 'undefined' ? window.localStorage : undefined as any
    ) {
        // Deduplicate keys
        const uniqueKeys = Array.from(new Set(initialKeys)).filter(k => !!k);

        this.keys = uniqueKeys.map(k => ({
            key: k,
            failCount: 0,
            failedAt: null,
            isQuotaError: false,
            circuitState: 'CLOSED',
            lastUsed: 0,
            successCount: 0,
            totalRequests: 0,
            halfOpenTestTime: null
        }));

        this.loadState();
        
        // Listen for cross-tab updates
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (e) => {
                if (e.key === this.storageKey) {
                    this.loadState();
                }
            });
        }
    }

    /**
     * HEALTH CHECK
     * Determines if a key is usable based on Circuit Breaker logic
     */
    private isOnCooldown(k: KeyState): boolean {
        const now = Date.now();

        if (k.circuitState === 'OPEN') {
            // Check if ready for HALF_OPEN test
            if (k.halfOpenTestTime && now >= k.halfOpenTestTime) {
                k.circuitState = 'HALF_OPEN'; // State Transition
                return false; // Allow this one request
            }
            return true; // Still blocked
        }

        // Additional safeguard for non-circuit cooldowns (e.g. rapid 429s)
        if (k.failedAt) {
            const cooldown = k.isQuotaError ? CONFIG.COOLDOWN_QUOTA : CONFIG.COOLDOWN_TRANSIENT;
            if (now - k.failedAt < cooldown) return true;
        }

        return false;
    }

    /**
     * CORE ROTATION LOGIC
     * Returns the best available key
     */
    public getKey(): string | null {
        // Ensure state is fresh if in-memory sync lagged
        this.loadState();

        if (this.keys.length === 0) return null;

        // 1. Filter healthy candidates
        const candidates = this.keys.filter(k => !this.isOnCooldown(k));

        if (candidates.length === 0) {
            // FALLBACK: Return oldest failed key (Desperation mode)
            // Fix: Create a shallow copy before sorting to avoid mutating the master key list order in-place
            return [...this.keys].sort((a,b) => (a.failedAt||0) - (b.failedAt||0))[0]?.key || null;
        }

        // 2. Sort candidates
        // Priority A: Pristine keys (0 failures)
        // Priority B: Fewest failures
        // Priority C: Least recently used (Load Balancing)
        candidates.sort((a, b) => {
            if (a.failCount !== b.failCount) return a.failCount - b.failCount;
            return a.lastUsed - b.lastUsed;
        });

        const selected = candidates[0];
        selected.lastUsed = Date.now();
        this.saveState();

        return selected.key;
    }

    /**
     * Returns the number of configured keys
     */
    public getKeyCount(): number {
        return this.keys.length;
    }

    /**
     * DEBUG / MONITORING
     * Returns a snapshot of the current pool state
     */
    public getPoolStatus() {
        return this.keys.map(k => ({
            id: k.key.slice(-4),
            state: k.circuitState,
            failures: k.failCount,
            total: k.totalRequests,
            lastUsed: k.lastUsed,
            isCoolingDown: this.isOnCooldown(k)
        }));
    }

    /**
     * FEEDBACK LOOP: Success
     */
    public markSuccess(key: string) {
        const k = this.keys.find(x => x.key === key);
        if (!k) return;

        // Reset Circuit
        if (k.circuitState !== 'CLOSED') console.log(`[Key Recovered] ...${key.slice(-4)}`);

        k.circuitState = 'CLOSED';
        k.failCount = 0;
        k.failedAt = null;
        k.isQuotaError = false;
        k.successCount++;
        k.totalRequests++;

        this.saveState();
    }

    /**
     * FEEDBACK LOOP: Failure
     */
    public markFailed(key: string, isQuota: boolean = false) {
        const k = this.keys.find(x => x.key === key);
        if (!k) return;

        k.failedAt = Date.now();
        k.failCount++;
        k.totalRequests++;
        k.isQuotaError = isQuota;

        // State Transitions
        if (k.circuitState === 'HALF_OPEN') {
            // Test failed, go back to OPEN immediately
            k.circuitState = 'OPEN';
            k.halfOpenTestTime = Date.now() + CONFIG.HALF_OPEN_TEST_DELAY;
        } else if (k.failCount >= CONFIG.MAX_CONSECUTIVE_FAILURES || isQuota) {
            // Exhausted or Hard Quota -> OPEN
            k.circuitState = 'OPEN';
            k.halfOpenTestTime = Date.now() + (isQuota ? CONFIG.COOLDOWN_QUOTA : CONFIG.HALF_OPEN_TEST_DELAY);
        }

        this.saveState();
    }

    private saveState() {
        if (!this.storage) return;
        const state = this.keys.reduce((acc, k) => ({
            ...acc,
            [k.key]: {
                failCount: k.failCount,
                circuitState: k.circuitState,
                lastUsed: k.lastUsed,
                failedAt: k.failedAt,
                halfOpenTestTime: k.halfOpenTestTime,
                isQuotaError: k.isQuotaError
            }
        }), {});
        this.storage.setItem(this.storageKey, JSON.stringify(state));
    }

    private loadState() {
        if (!this.storage) return;
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.keys.forEach(k => {
                if (data[k.key]) Object.assign(k, data[k.key]);
            });
        } catch (e) { console.error("Failed to load key state"); }
    }
}

// Initialize Singleton
const initialKeys: string[] = [];

const parseKeys = (source: any) => {
    if (!source) return;
    
    // Check for API_KEYS (JSON Array)
    if (source.API_KEYS) {
        try {
            const parsed = JSON.parse(source.API_KEYS);
            if (Array.isArray(parsed)) initialKeys.push(...parsed);
        } catch (e) {
            console.warn("Failed to parse API_KEYS");
        }
    }
    
    // Check for Single API_KEY
    if (source.API_KEY && !initialKeys.includes(source.API_KEY)) {
        initialKeys.push(source.API_KEY);
    }
    
    // Check for VITE_ prefixed keys (Vite default)
    if (source.VITE_API_KEY && !initialKeys.includes(source.VITE_API_KEY)) {
        initialKeys.push(source.VITE_API_KEY);
    }
};

// 1. Try Node process.env (Standard)
if (typeof process !== 'undefined' && process.env) {
    parseKeys(process.env);
}

// 2. Try Vite import.meta.env (Modern Bundlers)
try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
        // @ts-ignore
        parseKeys(import.meta.env);
    }
} catch (e) { /* ignore if not supported */ }

export const apiKeyManager = new ApiKeyManager(initialKeys);