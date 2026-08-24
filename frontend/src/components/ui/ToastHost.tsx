import React from 'react';
import { useToastStore } from '../../lib/toast';
import './Toast.css';

export const ToastHost: React.FC = () => {
    const { items, dismiss } = useToastStore();

    return (
        <div className="toast-host" aria-live="polite" aria-relevant="additions">
            {items.map((item) => (
                <div key={item.id} className={`toast toast-${item.kind}`} role="status">
                    <span>{item.message}</span>
                    <button type="button" className="toast-dismiss" onClick={() => dismiss(item.id)} aria-label="Kapat">
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
