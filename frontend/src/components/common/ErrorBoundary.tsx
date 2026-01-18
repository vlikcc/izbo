import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

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
        
        // In production, you would send this to an error tracking service
        // logErrorToService(error, errorInfo);
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
                <div className="error-boundary">
                    <div className="error-content">
                        <span className="error-icon">⚠️</span>
                        <h1>Bir Şeyler Yanlış Gitti</h1>
                        <p className="error-message">
                            Üzgünüz, beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
                        </p>
                        
                        {import.meta.env.DEV && this.state.error && (
                            <details className="error-details">
                                <summary>Hata Detayları (Geliştirici)</summary>
                                <pre>{this.state.error.toString()}</pre>
                                {this.state.errorInfo && (
                                    <pre>{this.state.errorInfo.componentStack}</pre>
                                )}
                            </details>
                        )}
                        
                        <div className="error-actions">
                            <button onClick={this.handleRetry} className="retry-btn">
                                🔄 Tekrar Dene
                            </button>
                            <button onClick={this.handleReload} className="reload-btn">
                                🔃 Sayfayı Yenile
                            </button>
                            <button onClick={this.handleGoHome} className="home-btn">
                                🏠 Ana Sayfaya Git
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
        <div className="error-fallback">
            <span className="fallback-icon">⚠️</span>
            <p>{message}</p>
            {onRetry && (
                <button onClick={onRetry} className="fallback-retry">
                    Tekrar Dene
                </button>
            )}
        </div>
    );
};
