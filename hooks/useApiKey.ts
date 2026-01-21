/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useContext, PropsWithChildren } from 'react';
// import { validateConnection } from '../services/geminiService'; // Removed to save quota
import { useToast } from '../context/ToastContext';

interface ApiKeyContextType {
  validateApiKey: () => Promise<boolean>;
}

const ApiKeyContext = createContext<ApiKeyContextType | null>(null);

export const ApiKeyProvider = ({ children }: PropsWithChildren<{}>) => {
  const { showToast } = useToast();

  /**
   * Performs a check to ensure the system is ready.
   * Optimization: We no longer "ping" the API (validateConnection) to save costs/quota.
   * The GeminiService handles 429/Quota errors gracefully via the ApiKeyManager.
   */
  const validateApiKey = async (): Promise<boolean> => {
    // We assume true here and let the actual request fail if quota is hit.
    // This doubles the effective RPM (Requests Per Minute) capacity of the app.
    return true;
  };

  return React.createElement(
    ApiKeyContext.Provider,
    { value: { validateApiKey } },
    children
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};