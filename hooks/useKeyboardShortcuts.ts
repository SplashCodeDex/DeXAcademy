/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect } from 'react';

interface ShortcutConfig {
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onNudge?: (x: number, y: number) => void;
  onDeselect?: () => void;
}

export const useKeyboardShortcuts = (config: ShortcutConfig, enabled: boolean = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const step = e.shiftKey ? 5 : 0.5; // Nudge amount

      switch (e.key) {
        case 'Backspace':
        case 'Delete':
          if (config.onDelete) {
            e.preventDefault();
            config.onDelete();
          }
          break;
        
        case 'z':
        case 'Z':
          if (isCmdOrCtrl) {
            e.preventDefault();
            if (e.shiftKey) {
              config.onRedo?.();
            } else {
              config.onUndo?.();
            }
          }
          break;

        case 'y':
        case 'Y':
          if (isCmdOrCtrl) {
            e.preventDefault();
            config.onRedo?.();
          }
          break;

        case 'Escape':
          if (config.onDeselect) {
            e.preventDefault();
            config.onDeselect();
          }
          break;

        case 'ArrowUp':
          if (config.onNudge) {
            e.preventDefault();
            config.onNudge(0, -step);
          }
          break;
        case 'ArrowDown':
          if (config.onNudge) {
            e.preventDefault();
            config.onNudge(0, step);
          }
          break;
        case 'ArrowLeft':
          if (config.onNudge) {
            e.preventDefault();
            config.onNudge(-step, 0);
          }
          break;
        case 'ArrowRight':
          if (config.onNudge) {
            e.preventDefault();
            config.onNudge(step, 0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, config]);
};