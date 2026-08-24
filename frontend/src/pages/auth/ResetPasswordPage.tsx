import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { authService } from '../../services/auth.service';
import { PASSWORD_HINT, validatePassword } from '../../utils/passwordPolicy';
import { toast } from '../../lib/toast';
import './Auth.css';

export const ResetPasswordPage: React.FC = () => {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const error = validatePassword(password);
        if (error) {
            toast.error(error);
            return;
        }
        setLoading(true);
        try {
            await authService.resetPassword(token, password);
            setDone(true);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Sıfırlama başarısız');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <Card variant="glass" padding="lg" className="auth-card">
                    <h1 className="auth-title">Yeni parola</h1>
                    {done ? (
                        <p>Parolanız güncellendi. <Link to="/login">Giriş yapın</Link>.</p>
                    ) : (
                        <form onSubmit={(event) => void handleSubmit(event)} className="auth-form">
                            <Input
                                label="Yeni parola"
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                helperText={PASSWORD_HINT}
                                required
                            />
                            <Button type="submit" variant="primary" fullWidth isLoading={loading} disabled={!token}>
                                Kaydet
                            </Button>
                        </form>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
