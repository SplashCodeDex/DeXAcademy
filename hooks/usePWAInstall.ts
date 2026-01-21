/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback, createContext, useContext, PropsWithChildren } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAContextType {
  isSupported: boolean;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | null>(null);

export const PWAProvider = ({ children }: PropsWithChildren<{}>) => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return;
    
    try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
    } catch (e) {
        console.error("Install prompt failed", e);
    } finally {
        setInstallPrompt(null);
    }
  }, [installPrompt]);

  return React.createElement(
    PWAContext.Provider,
    { value: { isSupported: !!installPrompt && !isInstalled, promptInstall } },
    children
  );
};

export const usePWAInstall = () => {
  const context = useContext(PWAContext);
  if (!context) {
     throw new Error("usePWAInstall must be used within a PWAProvider");
  }
  return context;
};