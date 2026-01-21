/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { Haptics, NotificationFeedbackType } from '../lib/haptics';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
}

export const Toast: React.FC<ToastProps> = ({ message, visible, type = 'success' }) => {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    setShow(visible);
    if (visible) {
      const feedbackType = type === 'error' ? NotificationFeedbackType.Error : NotificationFeedbackType.Success;
      Haptics.notificationAsync(feedbackType);
    }
  }, [visible, type]);

  if (!show) return null;

  const bgColors = {
    success: 'bg-zinc-800 border-zinc-700',
    error: 'bg-red-900/90 border-red-700',
    info: 'bg-indigo-900/90 border-indigo-700'
  };

  const icons = {
    success: <Check size={16} className="text-green-500" />,
    error: <AlertCircle size={16} className="text-red-200" />,
    info: <Check size={16} className="text-indigo-300" />
  };

  return (
    <div className="absolute top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none animate-toast-in px-4">
      <div className={`${bgColors[type]} border rounded-full px-5 py-3 flex flex-row items-center shadow-2xl backdrop-blur-md max-w-sm`}>
         <div className="mr-3">{icons[type]}</div>
         <span className="text-white font-medium text-sm drop-shadow-sm">{message}</span>
      </div>
    </div>
  );
};