import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui';
import { authService } from '../../services/auth.service';
import './Auth.css';

export const VerifyEmailPage: React.FC = () => {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [message, setMessage] = useState(token ? 'Doğrulanıyor...' : 'Doğrulama bağlantısı eksik.');

    useEffect(() => {
        if (!token) {
            return;
        }
        let cancelled = false;
        void authService.verifyEmail(token)
            .then(() => {
                if (!cancelled) setMessage('E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.');
            })
            .catch((error: unknown) => {
                if (!cancelled) setMessage(error instanceof Error ? error.message : 'Doğrulama başarısız');
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <div className="auth-page">
            <div className="auth-container">
                <Card variant="glass" padding="lg" className="auth-card">
                    <h1 className="auth-title">E-posta doğrulama</h1>
                    <p>{message}</p>
                    <p className="auth-footer"><Link to="/login">Girişe git</Link></p>
                </Card>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
