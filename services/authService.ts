/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
}

export interface AuthError {
    code: string;
    message: string;
}

const STORAGE_KEY = 'mockup_studio_user';

export const AuthService = {
  /**
   * Mock Login - Accepts any valid looking email
   */
  login: async (email: string, pass: string) => {
    if (!email.includes('@')) throw { code: 'auth/invalid-email', message: 'Invalid email address' };
    if (pass.length < 6) throw { code: 'auth/weak-password', message: 'Password should be at least 6 characters' };
    
    // Modern stable UID generation from email (Mock strategy)
    // Replaces deprecated btoa(unescape(encodeURIComponent(email)))
    const encoder = new TextEncoder();
    const data = encoder.encode(email);
    const binary = Array.from(data, (byte) => String.fromCharCode(byte)).join('');
    const safeUid = btoa(binary).replace(/=/g, ''); // Remove padding for URL safety

    // Create a deterministic mock user
    const user: User = {
        uid: safeUid, 
        email,
        displayName: email.split('@')[0],
        photoURL: null
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event('auth-change'));
    return { user };
  },
  
  register: async (email: string, pass: string) => {
    return AuthService.login(email, pass);
  },

  logout: async () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('auth-change'));
  },

  onUserChange: (callback: (user: User | null) => void) => {
    const check = () => {
        const str = localStorage.getItem(STORAGE_KEY);
        try {
            callback(str ? JSON.parse(str) : null);
        } catch (e) {
            callback(null);
        }
    };
    
    // Listen for local changes
    window.addEventListener('auth-change', check);
    
    // Listen for cross-tab changes
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            check();
        }
    });

    // Initial check
    check();
    
    return () => {
        window.removeEventListener('auth-change', check);
        window.removeEventListener('storage', check);
    };
  },

  formatError: (err: any): string => {
      return err.message || "Authentication failed";
  }
};