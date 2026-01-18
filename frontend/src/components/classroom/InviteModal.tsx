import React, { useState, useEffect } from 'react';
import { classroomApi } from '../../services/api';
import './ClassroomModals.css';

interface InviteModalProps {
    classroomId: string;
    classroomName: string;
    onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ classroomId, classroomName, onClose }) => {
    const [inviteCode, setInviteCode] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [email, setEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');
    const [activeTab, setActiveTab] = useState<'code' | 'email' | 'bulk'>('code');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        generateCode();
    }, []);

    const generateCode = async () => {
        setLoading(true);
        try {
            const response = await classroomApi.generateInviteCode(classroomId);
            if (response.data.success && response.data.data) {
                setInviteCode(response.data.data.inviteCode);
            }
        } catch (error) {
            console.error('Failed to generate invite code:', error);
            // Mock code for development
            setInviteCode(Math.random().toString(36).substring(2, 8).toUpperCase());
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const getInviteLink = () => {
        return `${window.location.origin}/join/${inviteCode}`;
    };

    const handleAddByEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setLoading(true);
        setMessage(null);
        try {
            const response = await classroomApi.addStudentByEmail(classroomId, email);
            if (response.data.success) {
                setMessage({ type: 'success', text: `${email} başarıyla eklendi!` });
                setEmail('');
            } else {
                setMessage({ type: 'error', text: response.data.message || 'Öğrenci eklenemedi' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Öğrenci eklenemedi' });
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkEmails.trim()) return;

        const emails = bulkEmails
            .split(/[\n,;]+/)
            .map(email => email.trim())
            .filter(email => email.includes('@'));

        if (emails.length === 0) {
            setMessage({ type: 'error', text: 'Geçerli e-posta adresi bulunamadı' });
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const response = await classroomApi.addStudentsBulk(classroomId, emails);
            if (response.data.success && response.data.data) {
                const { added, failed } = response.data.data;
                if (failed.length > 0) {
                    setMessage({ 
                        type: 'success', 
                        text: `${added} öğrenci eklendi. ${failed.length} e-posta eklenemedi.` 
                    });
                } else {
                    setMessage({ type: 'success', text: `${added} öğrenci başarıyla eklendi!` });
                    setBulkEmails('');
                }
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.response?.data?.message || 'Öğrenciler eklenemedi' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setBulkEmails(text);
        };
        reader.readAsText(file);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content invite-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🔗 Öğrenci Davet Et</h2>
                    <p className="modal-subtitle">{classroomName}</p>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="invite-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                        onClick={() => setActiveTab('code')}
                    >
                        📋 Davet Kodu
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
                        onClick={() => setActiveTab('email')}
                    >
                        ✉️ E-posta
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bulk')}
                    >
                        📄 Toplu Ekle
                    </button>
                </div>

                <div className="modal-body">
                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'code' && (
                        <div className="invite-code-section">
                            <div className="invite-code-box">
                                <label>Davet Kodu</label>
                                <div className="code-display">
                                    {loading ? (
                                        <span className="loading-text">Yükleniyor...</span>
                                    ) : (
                                        <span className="code">{inviteCode}</span>
                                    )}
                                    <button 
                                        className="copy-btn" 
                                        onClick={() => copyToClipboard(inviteCode)}
                                        disabled={loading}
                                    >
                                        {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
                                    </button>
                                </div>
                            </div>

                            <div className="invite-link-box">
                                <label>Davet Linki</label>
                                <div className="link-display">
                                    <input 
                                        type="text" 
                                        value={getInviteLink()} 
                                        readOnly 
                                    />
                                    <button 
                                        className="copy-btn" 
                                        onClick={() => copyToClipboard(getInviteLink())}
                                        disabled={loading}
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                            </div>

                            <button 
                                className="regenerate-btn" 
                                onClick={generateCode}
                                disabled={loading}
                            >
                                🔄 Yeni Kod Oluştur
                            </button>

                            <p className="invite-note">
                                Öğrenciler bu kodu kullanarak sınıfa katılabilir.
                            </p>
                        </div>
                    )}

                    {activeTab === 'email' && (
                        <form className="email-invite-section" onSubmit={handleAddByEmail}>
                            <div className="form-group">
                                <label>Öğrenci E-posta Adresi</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@email.com"
                                    required
                                />
                            </div>
                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? 'Ekleniyor...' : 'Öğrenci Ekle'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'bulk' && (
                        <form className="bulk-invite-section" onSubmit={handleBulkAdd}>
                            <div className="form-group">
                                <label>E-posta Adresleri (her satıra bir tane veya virgülle ayırın)</label>
                                <textarea
                                    value={bulkEmails}
                                    onChange={(e) => setBulkEmails(e.target.value)}
                                    placeholder="ogrenci1@email.com&#10;ogrenci2@email.com&#10;ogrenci3@email.com"
                                    rows={6}
                                />
                            </div>

                            <div className="file-upload-section">
                                <label htmlFor="csv-upload" className="file-upload-btn">
                                    📁 CSV Dosyası Yükle
                                </label>
                                <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    hidden
                                />
                                <span className="file-hint">CSV veya TXT dosyası yükleyebilirsiniz</span>
                            </div>

                            <button type="submit" className="submit-btn" disabled={loading}>
                                {loading ? 'Ekleniyor...' : 'Toplu Ekle'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
