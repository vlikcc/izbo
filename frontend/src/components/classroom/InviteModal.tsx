import React, { useState, useEffect } from 'react';
import { classroomApi } from '../../services/api';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-rose-100 relative">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        🔗 Öğrenci Davet Et
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">{classroomName}</p>
                    <button 
                        className="absolute top-4 right-4 w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-rose-100">
                    <button 
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'code' 
                                ? 'text-rose-600 border-b-2 border-rose-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('code')}
                    >
                        📋 Davet Kodu
                    </button>
                    <button 
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'email' 
                                ? 'text-rose-600 border-b-2 border-rose-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('email')}
                    >
                        ✉️ E-posta
                    </button>
                    <button 
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === 'bulk' 
                                ? 'text-rose-600 border-b-2 border-rose-500' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('bulk')}
                    >
                        📄 Toplu Ekle
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {message && (
                        <div className={`mb-4 p-3 rounded-xl text-sm ${
                            message.type === 'success' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    {activeTab === 'code' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Davet Kodu</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 px-4 py-3 bg-rose-50 rounded-xl text-center">
                                        {loading ? (
                                            <span className="text-gray-500">Yükleniyor...</span>
                                        ) : (
                                            <span className="text-2xl font-bold text-rose-600 tracking-widest">{inviteCode}</span>
                                        )}
                                    </div>
                                    <button 
                                        className="px-4 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50"
                                        onClick={() => copyToClipboard(inviteCode)}
                                        disabled={loading}
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Davet Linki</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={getInviteLink()} 
                                        readOnly 
                                        className="flex-1 px-4 py-3 bg-gray-50 border border-rose-100 rounded-xl text-gray-600 text-sm"
                                    />
                                    <button 
                                        className="px-4 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50"
                                        onClick={() => copyToClipboard(getInviteLink())}
                                        disabled={loading}
                                    >
                                        {copied ? '✓' : '📋'}
                                    </button>
                                </div>
                            </div>

                            <button 
                                className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                                onClick={generateCode}
                                disabled={loading}
                            >
                                🔄 Yeni Kod Oluştur
                            </button>

                            <p className="text-sm text-gray-500 text-center">
                                Öğrenciler bu kodu kullanarak sınıfa katılabilir.
                            </p>
                        </div>
                    )}

                    {activeTab === 'email' && (
                        <form className="space-y-4" onSubmit={handleAddByEmail}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Öğrenci E-posta Adresi</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@email.com"
                                    required
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                            <button 
                                type="submit" 
                                className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Ekleniyor...' : 'Öğrenci Ekle'}
                            </button>
                        </form>
                    )}

                    {activeTab === 'bulk' && (
                        <form className="space-y-4" onSubmit={handleBulkAdd}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    E-posta Adresleri (her satıra bir tane veya virgülle ayırın)
                                </label>
                                <textarea
                                    value={bulkEmails}
                                    onChange={(e) => setBulkEmails(e.target.value)}
                                    placeholder="ogrenci1@email.com&#10;ogrenci2@email.com&#10;ogrenci3@email.com"
                                    rows={6}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <label htmlFor="csv-upload" className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors cursor-pointer text-center">
                                    📁 CSV Dosyası Yükle
                                </label>
                                <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileUpload}
                                    hidden
                                />
                            </div>
                            <p className="text-xs text-gray-500 text-center">CSV veya TXT dosyası yükleyebilirsiniz</p>

                            <button 
                                type="submit" 
                                className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Ekleniyor...' : 'Toplu Ekle'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
