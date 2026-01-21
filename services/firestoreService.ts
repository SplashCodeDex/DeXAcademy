/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { AsyncStorage } from '../lib/storage';
import { Asset, GeneratedMockup, Draft } from '../types';
import { StorageService } from './storageService';
import { PurchaseReceipt } from './iapService';

export interface TransactionRecord {
    id: string;
    amount: number;
    type: 'purchase' | 'reward' | 'spend' | 'adjustment';
    description: string;
    timestamp: number;
}

// Helper to manage lists in storage (Legacy Read)
const getList = async <T>(key: string): Promise<T[]> => {
    return (await AsyncStorage.getObject<T[]>(key)) || [];
};

export const FirestoreService = {
    /**
     * User Profile & Credits
     */
    getProfile: async (userId: string) => {
        const profile = await AsyncStorage.getObject<{credits: number}>(`user:${userId}:profile`);
        return profile || { credits: 3 }; // Default credits
    },

    adjustCredits: async (userId: string, amount: number, type: TransactionRecord['type'], description: string) => {
        const profileKey = `user:${userId}:profile`;
        const txKey = `user:${userId}:transactions`;
        
        // Atomic Update Profile
        await AsyncStorage.updateObject<{credits: number}>(profileKey, (profile) => {
            const current = profile || { credits: 3 };
            return { ...current, credits: (current.credits || 0) + amount };
        });
        
        // Atomic Add Transaction
        await AsyncStorage.updateObject<TransactionRecord[]>(txKey, (list) => {
            const currentList = list || [];
            currentList.unshift({
                id: Date.now().toString() + Math.random().toString(36).slice(2),
                amount,
                type,
                description,
                timestamp: Date.now()
            });
            return currentList;
        });
    },

    savePurchaseReceipt: async (userId: string, receipt: PurchaseReceipt) => {
        // No-op for local demo
    },

    getTransactions: async (userId: string): Promise<TransactionRecord[]> => {
        return getList<TransactionRecord>(`user:${userId}:transactions`);
    },

    /**
     * Assets
     */
    saveAsset: async (userId: string, asset: Asset) => {
        const key = `user:${userId}:assets`;
        
        // Simulate upload if needed (optimize storage)
        if (asset.data.startsWith('data:')) {
            asset.data = await StorageService.uploadImage(userId, asset.data, 'assets');
        }

        await AsyncStorage.updateObject<Asset[]>(key, (list) => {
            const currentList = list || [];
            const idx = currentList.findIndex(a => a.id === asset.id);
            if (idx >= 0) {
                currentList[idx] = asset;
            } else {
                currentList.unshift(asset);
            }
            return currentList;
        });
    },

    deleteAsset: async (userId: string, assetId: string) => {
        const key = `user:${userId}:assets`;
        await AsyncStorage.updateObject<Asset[]>(key, (list) => {
            return (list || []).filter(a => a.id !== assetId);
        });
    },

    getAssets: async (userId: string): Promise<Asset[]> => {
        return getList<Asset>(`user:${userId}:assets`);
    },

    /**
     * Mockups
     */
    saveMockup: async (userId: string, mockup: GeneratedMockup) => {
        const key = `user:${userId}:mockups`;
        
        if (mockup.imageUrl.startsWith('data:')) {
            mockup.imageUrl = await StorageService.uploadImage(userId, mockup.imageUrl, 'mockups');
        }

        await AsyncStorage.updateObject<GeneratedMockup[]>(key, (list) => {
            const currentList = list || [];
            const idx = currentList.findIndex(m => m.id === mockup.id);
            if (idx >= 0) {
                currentList[idx] = mockup;
            } else {
                currentList.unshift(mockup);
            }
            return currentList;
        });
    },

    getMockups: async (userId: string): Promise<GeneratedMockup[]> => {
        return getList<GeneratedMockup>(`user:${userId}:mockups`);
    },

    deleteMockup: async (userId: string, mockupId: string) => {
        const key = `user:${userId}:mockups`;
        await AsyncStorage.updateObject<GeneratedMockup[]>(key, (list) => {
            return (list || []).filter(m => m.id !== mockupId);
        });
    },

    /**
     * Community & Publishing
     */
    publishMockup: async (userId: string, userEmail: string, mockup: GeneratedMockup) => {
        const key = `community:mockups`;
        
        const publicDoc = {
            ...mockup,
            authorId: userId,
            authorName: userEmail.split('@')[0], // Privacy mask
            likes: 0,
            publishedAt: Date.now()
        };
        
        await AsyncStorage.updateObject<GeneratedMockup[]>(key, (list) => {
            const currentList = list || [];
            currentList.unshift(publicDoc);
            return currentList;
        });
    },

    getCommunityMockups: async (): Promise<GeneratedMockup[]> => {
        return getList<GeneratedMockup>(`community:mockups`);
    },

    /**
     * Drafts
     */
    saveDraft: async (userId: string, draft: Draft) => {
        await AsyncStorage.setObject(`user:${userId}:draft`, draft);
    },

    getDraft: async (userId: string): Promise<Draft | null> => {
        return AsyncStorage.getObject<Draft>(`user:${userId}:draft`);
    },
    
    deleteDraft: async (userId: string) => {
        await AsyncStorage.removeItem(`user:${userId}:draft`);
    },

    /**
     * Reset
     */
    clearUserData: async (userId: string) => {
        await AsyncStorage.removeItem(`user:${userId}:assets`);
        await AsyncStorage.removeItem(`user:${userId}:mockups`);
        await AsyncStorage.removeItem(`user:${userId}:draft`);
        await AsyncStorage.removeItem(`user:${userId}:transactions`);
        await AsyncStorage.removeItem(`user:${userId}:profile`);
    }
};