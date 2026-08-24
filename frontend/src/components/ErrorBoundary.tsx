import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = { error: null };

    public static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    public componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('Unhandled UI error', error, info.componentStack);
    }

    public render(): ReactNode {
        if (this.state.error) {
            return (
                <div className="page" role="alert">
                    <h1>Bir şeyler ters gitti</h1>
                    <p>Sayfa yüklenemedi. Yenileyip tekrar deneyin.</p>
                    <button type="button" onClick={() => this.setState({ error: null })}>
                        Tekrar dene
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
