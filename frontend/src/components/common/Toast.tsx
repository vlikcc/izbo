import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (type: Toast['type'], message: string, duration?: number) => void;
    removeToast: (id: string) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const addToast = useCallback((type: Toast['type'], message: string, duration = 5000) => {
        const id = Math.random().toString(36).substring(7);
        const toast: Toast = { id, type, message, duration };
        
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => removeToast(id), duration);
        }
    }, [removeToast]);

    const success = useCallback((message: string, duration?: number) => {
        addToast('success', message, duration);
    }, [addToast]);

    const error = useCallback((message: string, duration?: number) => {
        addToast('error', message, duration);
    }, [addToast]);

    const warning = useCallback((message: string, duration?: number) => {
        addToast('warning', message, duration);
    }, [addToast]);

    const info = useCallback((message: string, duration?: number) => {
        addToast('info', message, duration);
    }, [addToast]);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

interface ToastItemProps {
    toast: Toast;
    onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
    const getIcon = () => {
        switch (toast.type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'warning': return '⚠';
            case 'info': return 'ℹ';
        }
    };

    const getStyles = () => {
        const baseStyles = "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-slide-in-right";
        
        switch (toast.type) {
            case 'success':
                return `${baseStyles} bg-emerald-50/90 border-emerald-200 text-emerald-700`;
            case 'error':
                return `${baseStyles} bg-red-50/90 border-red-200 text-red-700`;
            case 'warning':
                return `${baseStyles} bg-amber-50/90 border-amber-200 text-amber-700`;
            case 'info':
            default:
                return `${baseStyles} bg-rose-50/90 border-rose-200 text-rose-700`;
        }
    };

    const getIconStyles = () => {
        const baseStyles = "w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0";
        
        switch (toast.type) {
            case 'success':
                return `${baseStyles} bg-emerald-500 text-white`;
            case 'error':
                return `${baseStyles} bg-red-500 text-white`;
            case 'warning':
                return `${baseStyles} bg-amber-500 text-white`;
            case 'info':
            default:
                return `${baseStyles} bg-rose-500 text-white`;
        }
    };

    return (
        <div className={getStyles()}>
            <span className={getIconStyles()}>{getIcon()}</span>
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button 
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors text-current opacity-60 hover:opacity-100 flex-shrink-0"
                onClick={onClose}
            >
                ✕
            </button>
        </div>
    );
};
