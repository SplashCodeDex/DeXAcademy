/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { generateId } from '../lib/utils';

export const StorageService = {
    /**
     * Simulates upload by just returning the Data URL.
     * In this local environment, we store the Base64 data directly in IndexedDB via the services.
     */
    uploadImage: async (userId: string, dataUrl: string, folder: 'assets' | 'mockups'): Promise<string> => {
        // Just return the dataUrl. 
        // In a real implementation this would upload to blob storage and return a https:// url.
        return dataUrl;
    }
};