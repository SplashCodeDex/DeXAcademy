/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { createContext, useContext, useState, useCallback, PropsWithChildren } from 'react';
import { Toast, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider");
    return context;
};

export const ToastProvider = ({ children }: PropsWithChildren<{}>) => {
    const [toast, setToast] = useState<{ message: string, visible: boolean, type: ToastType }>({ 
        message: '', visible: false, type: 'success' 
    });

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, visible: true, type });
        // Auto-hide after 3 seconds
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <Toast message={toast.message} visible={toast.visible} type={toast.type} />
        </ToastContext.Provider>
    );
};