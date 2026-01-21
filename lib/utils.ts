/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a RFC4122 version 4 compliant UUID.
 * Uses the native Crypto API.
 */
export const generateId = (): string => {
  // Use modern Crypto API if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments, strictly adhering to UUID v4 format
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> (+c / 4)).toString(16)
  );
};