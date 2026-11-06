import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Modal } from '../../components/ui';
import guardianService from '../../services/guardian.service';
import { toast } from '../../lib/toast';
import type { Child, ExamTarget } from '../../types';
import { EXAM_LABELS, GRADES, examTargetsForGrade, gradeLabel } from '../../utils/roles';
import { PASSWORD_HINT, validatePassword } from '../../utils/passwordPolicy';
import { USERNAME_PATTERN, suggestUsername } from '../../utils/codes';
import './Parent.css';

const emptyChildForm = {
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    gradeLevel: '',
    examTarget: '' as ExamTarget | '',
};

export const ChildrenPage: React.FC = () => {
    const [children, setChildren] = useState<Child[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showCreate, setShowCreate] = useState(false);
    const [childForm, setChildForm] = useState(emptyChildForm);
    const [usernameTouched, setUsernameTouched] = useState(false);

    const [showLink, setShowLink] = useState(false);
    const [linkCode, setLinkCode] = useState('');

    const [resetTarget, setResetTarget] = useState<Child | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const [formError, setFormError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            setChildren(await guardianService.getChildren());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Çocuk hesapları yüklenemedi');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const closeAll = () => {
        setShowCreate(false);
        setShowLink(false);
        setResetTarget(null);
        setFormError('');
        setChildForm(emptyChildForm);
        setUsernameTouched(false);
        setLinkCode('');
        setNewPassword('');
    };

    const updateChildForm = (field: keyof typeof emptyChildForm, value: string) => {
        setChildForm(prev => {
            const next = { ...prev, [field]: value };
            if (!usernameTouched && (field === 'firstName' || field === 'lastName')) {
                next.username = suggestUsername(next.firstName, next.lastName);
            }
            return next;
        });
    };

    const grade = childForm.gradeLevel ? Number(childForm.gradeLevel) : undefined;
    const examChoices = examTargetsForGrade(grade);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const username = childForm.username.trim().toLowerCase();
        if (!USERNAME_PATTERN.test(username)) {
            setFormError('Kullanıcı adı 4–32 karakter olmalı; yalnızca küçük harf, rakam, nokta ve alt çizgi içerebilir.');
            return;
        }
        const passwordError = validatePassword(childForm.password);
        if (passwordError) {
            setFormError(passwordError);
            return;
        }
        if (!grade) {
            setFormError('Lütfen sınıf seçin');
            return;
        }

        setIsSaving(true);
        try {
            const child = await guardianService.createChild({
                firstName: childForm.firstName.trim(),
                lastName: childForm.lastName.trim(),
                username,
                password: childForm.password,
                gradeLevel: grade,
                examTarget: childForm.examTarget && examChoices.includes(childForm.examTarget) ? childForm.examTarget : undefined,
            });
            setChildren(prev => [...prev, child]);
            toast.success(`${child.firstName} için hesap açıldı. Giriş: ${child.username}`);
            closeAll();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Hesap oluşturulamadı');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        setIsSaving(true);
        try {
            const child = await guardianService.linkChild(linkCode);
            setChildren(prev => prev.some(c => c.id === child.id) ? prev : [...prev, child]);
            toast.success(`${child.firstName} hesabınıza bağlandı`);
            closeAll();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Kod geçersiz');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTarget) return;
        setFormError('');
        const passwordError = validatePassword(newPassword);
        if (passwordError) {
            setFormError(passwordError);
            return;
        }
        setIsSaving(true);
        try {
            await guardianService.resetChildPassword(resetTarget.id, newPassword);
            toast.success('Şifre güncellendi');
            closeAll();
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Şifre değiştirilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlink = async (child: Child) => {
        if (!window.confirm(`${child.firstName} ile bağlantınız kaldırılacak. Hesap silinmez. Devam edilsin mi?`)) {
            return;
        }
        try {
            await guardianService.unlinkChild(child.id);
            setChildren(prev => prev.filter(c => c.id !== child.id));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Bağlantı kaldırılamadı');
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">👨‍👩‍👧 Çocuklarım</h1>
                    <p className="page-subtitle">Çocuğunuza hesap açın ya da kendi hesabını bağlantı koduyla ekleyin.</p>
                </div>
                <div className="children-actions">
                    <Button variant="primary" onClick={() => setShowCreate(true)}>+ Çocuk hesabı aç</Button>
                    <Button variant="outline" onClick={() => setShowLink(true)}>Kodla bağla</Button>
                </div>
            </div>

            {isLoading ? (
                <p className="child-muted">Yükleniyor...</p>
            ) : children.length === 0 ? (
                <Card variant="default" padding="lg" className="children-empty">
                    <span style={{ fontSize: '2.5rem' }} aria-hidden="true">👨‍👩‍👧</span>
                    <h3>Henüz bağlı bir çocuk yok</h3>
                    <p className="child-muted">
                        Çocuğunuzun e-postası yoksa ona kullanıcı adıyla giriş yapan bir hesap açın.
                        Kendi hesabı varsa, profil sayfasından bir veli kodu üretip size vermesini isteyin.
                    </p>
                </Card>
            ) : (
                <div className="children-grid">
                    {children.map(child => (
                        <Card key={child.id} variant="default" padding="md" className="child-card">
                            <div className="child-card-header">
                                <div className="child-avatar" aria-hidden="true">{child.firstName.charAt(0)}</div>
                                <div>
                                    <h3 className="child-name">{child.firstName} {child.lastName}</h3>
                                    <span className="child-meta">
                                        {gradeLabel(child.gradeLevel)}
                                        {child.examTarget && child.examTarget !== 'None' ? ` · ${EXAM_LABELS[child.examTarget]}` : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="child-manage-row">
                                <span className="child-muted">
                                    {child.username ? <>Giriş: <strong>{child.username}</strong></> : child.email}
                                </span>
                                <div className="child-manage-actions">
                                    {child.username && !child.email && (
                                        <Button size="sm" variant="secondary" onClick={() => setResetTarget(child)}>Şifre sıfırla</Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => void handleUnlink(child)}>Bağı kaldır</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal isOpen={showCreate} onClose={closeAll} title="Çocuk hesabı aç">
                <form className="form-stack" onSubmit={handleCreate}>
                    {formError && <p className="form-error" role="alert">{formError}</p>}
                    <div className="form-row">
                        <Input label="Ad" value={childForm.firstName} onChange={e => updateChildForm('firstName', e.target.value)} required />
                        <Input label="Soyad" value={childForm.lastName} onChange={e => updateChildForm('lastName', e.target.value)} required />
                    </div>
                    <Input
                        label="Kullanıcı adı"
                        value={childForm.username}
                        onChange={e => {
                            setUsernameTouched(true);
                            updateChildForm('username', e.target.value.toLowerCase());
                        }}
                        helperText="Çocuğunuz bu adla giriş yapacak. Küçük harf, rakam, nokta ve alt çizgi."
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                    />
                    <Input
                        label="Şifre"
                        type="password"
                        autoComplete="new-password"
                        value={childForm.password}
                        onChange={e => updateChildForm('password', e.target.value)}
                        helperText={PASSWORD_HINT}
                        required
                    />
                    <div className="form-row">
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="child-grade">Sınıf</label>
                            <select id="child-grade" className="form-select" value={childForm.gradeLevel}
                                onChange={e => updateChildForm('gradeLevel', e.target.value)} required>
                                <option value="">Seçin</option>
                                {GRADES.map(g => <option key={g} value={g}>{g}. sınıf</option>)}
                            </select>
                        </div>
                        <div className="input-wrapper">
                            <label className="input-label" htmlFor="child-exam">Hedef sınav</label>
                            <select id="child-exam" className="form-select" value={childForm.examTarget}
                                onChange={e => updateChildForm('examTarget', e.target.value)} disabled={examChoices.length === 0}>
                                <option value="">Yok</option>
                                {examChoices.map(t => <option key={t} value={t}>{EXAM_LABELS[t]}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={closeAll}>Vazgeç</Button>
                        <Button type="submit" variant="primary" isLoading={isSaving}>Hesabı aç</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={showLink} onClose={closeAll} title="Kodla bağla" size="sm">
                <form className="form-stack" onSubmit={handleLink}>
                    {formError && <p className="form-error" role="alert">{formError}</p>}
                    <p className="child-muted">
                        Çocuğunuz kendi hesabının Profil sayfasından "Veli kodu üret" ile 8 karakterlik bir kod alır. O kodu buraya yazın.
                    </p>
                    <Input
                        label="Veli kodu"
                        value={linkCode}
                        onChange={e => setLinkCode(e.target.value.toUpperCase())}
                        placeholder="ABCD-EFGH"
                        autoCapitalize="characters"
                        spellCheck={false}
                        required
                    />
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={closeAll}>Vazgeç</Button>
                        <Button type="submit" variant="primary" isLoading={isSaving}>Bağla</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={resetTarget !== null} onClose={closeAll} title={`${resetTarget?.firstName ?? ''} için yeni şifre`} size="sm">
                <form className="form-stack" onSubmit={handleReset}>
                    {formError && <p className="form-error" role="alert">{formError}</p>}
                    <Input
                        label="Yeni şifre"
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        helperText={PASSWORD_HINT}
                        required
                    />
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={closeAll}>Vazgeç</Button>
                        <Button type="submit" variant="primary" isLoading={isSaving}>Kaydet</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ChildrenPage;
