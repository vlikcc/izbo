import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-rose-100 p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        
                        <h1 className="text-2xl font-bold text-gray-800 mb-3">
                            Bir Şeyler Yanlış Gitti
                        </h1>
                        
                        <p className="text-gray-500 mb-6">
                            Üzgünüz, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
                        </p>
                        
                        {import.meta.env.DEV && this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="cursor-pointer text-sm text-rose-600 font-medium hover:text-rose-700">
                                    Hata Detayları (Geliştirici)
                                </summary>
                                <div className="mt-2 p-3 bg-gray-50 rounded-lg overflow-auto max-h-40">
                                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                        {this.state.error.toString()}
                                    </pre>
                                    {this.state.errorInfo && (
                                        <pre className="text-xs text-gray-500 whitespace-pre-wrap mt-2">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            </details>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button 
                                onClick={this.handleRetry} 
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                            >
                                🔄 Tekrar Dene
                            </button>
                            <button 
                                onClick={this.handleReload} 
                                className="flex-1 px-4 py-3 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-all flex items-center justify-center gap-2"
                            >
                                🔃 Yenile
                            </button>
                            <button 
                                onClick={this.handleGoHome} 
                                className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                            >
                                🏠 Ana Sayfa
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Simple error fallback component for smaller areas
export const ErrorFallback: React.FC<{ message?: string; onRetry?: () => void }> = ({
    message = 'Bir hata oluştu',
    onRetry
}) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 mb-4 bg-rose-100 rounded-full flex items-center justify-center">
                <span className="text-xl">⚠️</span>
            </div>
            <p className="text-gray-600 mb-4">{message}</p>
            {onRetry && (
                <button 
                    onClick={onRetry} 
                    className="px-4 py-2 bg-rose-500 text-white font-medium rounded-lg hover:bg-rose-600 transition-colors"
                >
                    Tekrar Dene
                </button>
            )}
        </div>
    );
};
