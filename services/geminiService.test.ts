/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAsset, generateMockup } from './geminiService';

// --- Mocks ---

// Mock GoogleGenAI
const mockGenerateContent = vi.fn();
const mockGoogleGenAIConstructor = vi.fn().mockImplementation(() => ({
  models: {
    generateContent: mockGenerateContent
  }
}));

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: mockGoogleGenAIConstructor,
    Modality: {
      IMAGE: 'IMAGE'
    }
  };
});

// Mock ApiKeyManager
const mockGetKey = vi.fn();
const mockMarkSuccess = vi.fn();
const mockMarkFailed = vi.fn();
const mockGetKeyCount = vi.fn().mockReturnValue(3);

vi.mock('./apiKeyManager', () => {
  return {
    apiKeyManager: {
      getKey: () => mockGetKey(),
      getKeyCount: () => mockGetKeyCount(),
      markSuccess: (k: string) => mockMarkSuccess(k),
      markFailed: (k: string, q: boolean) => mockMarkFailed(k, q)
    }
  };
});

describe('GeminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKey.mockReturnValue('test-api-key-1');
  });

  describe('generateAsset', () => {
    it('should call apiKeyManager.getKey and use the returned key', async () => {
      mockGenerateContent.mockResolvedValue({
        candidates: [{
          content: {
            parts: [{
              inlineData: { mimeType: 'image/png', data: 'base64_logo_data' }
            }]
          }
        }]
      });

      await generateAsset('coffee cup', 'logo');

      expect(mockGetKey).toHaveBeenCalled();
      expect(mockGoogleGenAIConstructor).toHaveBeenCalledWith({ apiKey: 'test-api-key-1' });
      expect(mockMarkSuccess).toHaveBeenCalledWith('test-api-key-1');
    });

    it('should retry with a new key on error', async () => {
      // First attempt fails
      mockGenerateContent.mockRejectedValueOnce(new Error('Quota exceeded'));
      // Second attempt succeeds
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{
              inlineData: { mimeType: 'image/png', data: 'base64_logo_data' }
            }]
          }
        }]
      });

      mockGetKey
        .mockReturnValueOnce('key-1')
        .mockReturnValueOnce('key-2');

      await generateAsset('coffee cup', 'logo');

      // Should have tried twice
      expect(mockGetKey).toHaveBeenCalledTimes(2);
      expect(mockMarkFailed).toHaveBeenCalledWith('key-1', true); // Check if quota detection worked (Error message 'Quota exceeded' contains 'quota')
      expect(mockMarkSuccess).toHaveBeenCalledWith('key-2');
    });

    it('should throw if all keys fail', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Generic Error'));
      mockGetKeyCount.mockReturnValue(1); // Only 1 key
      mockGetKey.mockReturnValue('key-1');

      // Loop runs MAX_ATTEMPTS = 1 + 1 = 2 times for 1 key? 
      // Code says: Math.max(1, apiKeyManager.getKeyCount() + 1)
      
      await expect(generateAsset('fail', 'logo')).rejects.toThrow('Generic Error');
      
      expect(mockMarkFailed).toHaveBeenCalled();
    });
  });
});
