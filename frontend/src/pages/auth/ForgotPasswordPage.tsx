import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { authService } from '../../services/auth.service';
import { toast } from '../../lib/toast';
import './Auth.css';

export const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        try {
            await authService.forgotPassword(email);
            setSent(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'İstek gönderilemedi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <Card variant="glass" padding="lg" className="auth-card">
                    <h1 className="auth-title">Parolamı unuttum</h1>
                    {sent ? (
                        <p>Adres kayıtlıysa sıfırlama bağlantısı gönderildi.</p>
                    ) : (
                        <form onSubmit={(event) => void handleSubmit(event)} className="auth-form">
                            <Input label="E-posta" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                            <Button type="submit" variant="primary" fullWidth isLoading={loading}>Gönder</Button>
                        </form>
                    )}
                    <p className="auth-footer"><Link to="/login">Girişe dön</Link></p>
                </Card>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
