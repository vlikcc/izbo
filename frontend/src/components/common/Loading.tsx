import React from 'react';
import './Loading.css';

interface LoadingProps {
    text?: string;
    size?: 'small' | 'medium' | 'large';
    fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
    text = 'Yükleniyor...',
    size = 'medium',
    fullScreen = false
}) => {
    return (
        <div className={`loading-container ${fullScreen ? 'fullscreen' : ''}`}>
            <div className={`loading-spinner ${size}`}>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
                <div className="spinner-ring"></div>
            </div>
            {text && <p className="loading-text">{text}</p>}
        </div>
    );
};

export default Loading;
