/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
}

export enum NotificationFeedbackType {
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

const triggerVibration = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export const Haptics = {
  impactAsync: async (style: ImpactFeedbackStyle = ImpactFeedbackStyle.Medium) => {
    switch (style) {
      case ImpactFeedbackStyle.Light:
        triggerVibration(10);
        break;
      case ImpactFeedbackStyle.Medium:
        triggerVibration(20);
        break;
      case ImpactFeedbackStyle.Heavy:
        triggerVibration(40);
        break;
    }
  },

  notificationAsync: async (type: NotificationFeedbackType) => {
    switch (type) {
      case NotificationFeedbackType.Success:
        triggerVibration([10, 30, 10]);
        break;
      case NotificationFeedbackType.Warning:
        triggerVibration([30, 50, 10]);
        break;
      case NotificationFeedbackType.Error:
        triggerVibration([50, 50, 50, 50]);
        break;
    }
  },

  selectionAsync: async () => {
    triggerVibration(5);
  },
};