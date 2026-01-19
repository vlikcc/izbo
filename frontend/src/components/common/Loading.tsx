import React from 'react';

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
    const sizeClasses = {
        small: 'w-6 h-6 border-2',
        medium: 'w-10 h-10 border-4',
        large: 'w-14 h-14 border-4'
    };

    const textSizeClasses = {
        small: 'text-sm',
        medium: 'text-base',
        large: 'text-lg'
    };

    const content = (
        <div className="flex flex-col items-center justify-center gap-4">
            <div className={`
                ${sizeClasses[size]}
                border-rose-100 border-t-rose-500
                rounded-full animate-spin
            `}></div>
            {text && (
                <p className={`${textSizeClasses[size]} text-gray-500 font-medium`}>
                    {text}
                </p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
            {content}
        </div>
    );
};

export const LoadingOverlay: React.FC<{ text?: string }> = ({ text }) => (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-sm rounded-xl">
        <Loading text={text} size="small" />
    </div>
);

export const LoadingDots: React.FC = () => (
    <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
);

export const LoadingBar: React.FC<{ progress?: number }> = ({ progress }) => (
    <div className="w-full h-1 bg-rose-100 rounded-full overflow-hidden">
        {progress !== undefined ? (
            <div 
                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
            ></div>
        ) : (
            <div className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full animate-pulse"></div>
        )}
    </div>
);

export default Loading;
