import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Card } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { PASSWORD_HINT, validatePassword } from '../../utils/passwordPolicy';
import { EXAM_LABELS, GRADES, examTargetsForGrade } from '../../utils/roles';
import type { ExamTarget, RegisterRequest } from '../../types';
import './Auth.css';

type SelfServiceRole = NonNullable<RegisterRequest['role']>;

const ROLE_CHOICES: { role: SelfServiceRole; icon: string; title: string; text: string }[] = [
    { role: 'Parent', icon: '👨‍👩‍👧', title: 'Veliyim', text: 'Çocuğumun hesabını açıp gelişimini takip edeceğim' },
    { role: 'Student', icon: '🎒', title: 'Öğrenciyim', text: 'Kendi e-postamla kayıt olup ders çalışacağım' },
    { role: 'Instructor', icon: '🧑‍🏫', title: 'Öğretmenim', text: 'Sınıf açıp ders, sınav ve ödev vereceğim' },
];

/** Links on the public pages say which kind of account the visitor came for: /register?rol=ogrenci. */
const ROLE_FROM_QUERY: Record<string, SelfServiceRole> = {
    veli: 'Parent',
    ogrenci: 'Student',
    ogretmen: 'Instructor',
};

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { register, isLoading, error, clearError } = useAuthStore();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: (ROLE_FROM_QUERY[searchParams.get('rol') ?? ''] ?? 'Parent') as SelfServiceRole,
        gradeLevel: '',
        examTarget: '' as ExamTarget | '',
    });
    const [validationError, setValidationError] = useState('');
    const isStudentSignup = formData.role === 'Student';
    const grade = formData.gradeLevel ? Number(formData.gradeLevel) : undefined;
    const examChoices = examTargetsForGrade(grade);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setValidationError('');

        if (formData.password !== formData.confirmPassword) {
            setValidationError('Parolalar eşleşmiyor');
            return;
        }

        const passwordError = validatePassword(formData.password);
        if (passwordError) {
            setValidationError(passwordError);
            return;
        }

        if (isStudentSignup && !grade) {
            setValidationError('Lütfen sınıfını seç');
            return;
        }

        try {
            const message = await register({
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                role: formData.role,
                ...(isStudentSignup && {
                    gradeLevel: grade,
                    examTarget: formData.examTarget && examChoices.includes(formData.examTarget)
                        ? formData.examTarget
                        : undefined,
                }),
            });

            // Registration issues no session, so the next step is signing in.
            navigate('/login', { state: { notice: message } });
        } catch {
            // Error handled by store
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <div className="auth-page">
            <div className="auth-background">
                <div className="auth-gradient-orb auth-gradient-orb-1" />
                <div className="auth-gradient-orb auth-gradient-orb-2" />
            </div>

            <div className="auth-container animate-slideUp">
                <Card variant="glass" padding="lg" className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <span className="auth-logo-icon">📚</span>
                            <span className="auth-logo-text">EduPlatform</span>
                        </div>
                        <h1 className="auth-title">Hesap Oluştur</h1>
                        <p className="auth-subtitle">Kim olarak katılıyorsunuz?</p>
                    </div>

                    <form onSubmit={handleSubmit} className="auth-form">
                        {(error || validationError) && (
                            <div className="auth-error">
                                {error || validationError}
                            </div>
                        )}

                        <div className="role-choices" role="radiogroup" aria-label="Hesap türü">
                            {ROLE_CHOICES.map(choice => (
                                <button
                                    key={choice.role}
                                    type="button"
                                    role="radio"
                                    aria-checked={formData.role === choice.role}
                                    className={`role-choice${formData.role === choice.role ? ' role-choice-active' : ''}`}
                                    onClick={() => setFormData(prev => ({ ...prev, role: choice.role }))}
                                >
                                    <span className="role-choice-icon" aria-hidden="true">{choice.icon}</span>
                                    <span className="role-choice-title">{choice.title}</span>
                                    <span className="role-choice-text">{choice.text}</span>
                                </button>
                            ))}
                        </div>

                        {formData.role === 'Parent' && (
                            <p className="auth-hint">
                                E-postası olmayan çocuğunuz için kayıttan sonra panelinizden kullanıcı adıyla giriş yapan bir hesap açabilirsiniz.
                            </p>
                        )}

                        <div className="auth-row">
                            <Input
                                label="Ad"
                                type="text"
                                name="firstName"
                                placeholder="Adınız"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                            />
                            <Input
                                label="Soyad"
                                type="text"
                                name="lastName"
                                placeholder="Soyadınız"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <Input
                            label="E-posta"
                            type="email"
                            name="email"
                            placeholder="ornek@email.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />

                        {isStudentSignup && (
                            <div className="auth-row">
                                <div className="input-wrapper">
                                    <label className="input-label" htmlFor="register-grade">Sınıf</label>
                                    <select
                                        id="register-grade"
                                        name="gradeLevel"
                                        value={formData.gradeLevel}
                                        onChange={handleChange}
                                        className="auth-select"
                                        required
                                    >
                                        <option value="">Seçin</option>
                                        {GRADES.map(g => <option key={g} value={g}>{g}. sınıf</option>)}
                                    </select>
                                </div>
                                <div className="input-wrapper">
                                    <label className="input-label" htmlFor="register-exam">Hedef sınav</label>
                                    <select
                                        id="register-exam"
                                        name="examTarget"
                                        value={formData.examTarget}
                                        onChange={handleChange}
                                        className="auth-select"
                                        disabled={examChoices.length === 0}
                                    >
                                        <option value="">Yok</option>
                                        {examChoices.map(t => <option key={t} value={t}>{EXAM_LABELS[t]}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <Input
                            label="Şifre"
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={handleChange}
                            helperText={PASSWORD_HINT}
                            required
                        />

                        <Input
                            label="Şifre Tekrar"
                            type="password"
                            name="confirmPassword"
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                        >
                            Kayıt Ol
                        </Button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Zaten hesabınız var mı?{' '}
                            <Link to="/login">Giriş Yapın</Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default RegisterPage;
