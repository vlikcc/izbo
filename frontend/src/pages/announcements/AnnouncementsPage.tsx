import React, { useState, useEffect } from 'react';
import { announcementApi, classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Announcement, Classroom } from '../../types';

export const AnnouncementsPage: React.FC = () => {
    const { user } = useAuthStore();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        loadAnnouncements();
    }, [selectedClassroom]);

    const loadData = async () => {
        try {
            const classroomsRes = await classroomApi.getMyClassrooms(1, 50);
            if (classroomsRes.data.success && classroomsRes.data.data) {
                setClassrooms(classroomsRes.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load classrooms:', error);
            setClassrooms([
                { id: 'c1', name: 'Matematik 101', description: '', instructorId: '', studentCount: 25, isActive: true, createdAt: '' },
                { id: 'c2', name: 'Fizik 102', description: '', instructorId: '', studentCount: 20, isActive: true, createdAt: '' }
            ]);
        }
        loadAnnouncements();
    };

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const response = await announcementApi.getAll(
                selectedClassroom !== 'all' ? selectedClassroom : undefined,
                1, 50
            );
            if (response.data.success && response.data.data) {
                setAnnouncements(response.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
            setAnnouncements([
                {
                    id: '1',
                    classroomId: 'c1',
                    classroomName: 'Matematik 101',
                    title: 'Ara Sınav Tarihi Değişikliği',
                    content: 'Değerli öğrenciler, ara sınav tarihi 15 Ocak\'tan 20 Ocak\'a ertelenmiştir. Yeni tarih ve saat: 20 Ocak 2026, saat 14:00.',
                    isPinned: true,
                    authorId: 'u1',
                    authorName: 'Prof. Dr. Ahmet Yılmaz',
                    createdAt: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: '2',
                    classroomId: 'c1',
                    classroomName: 'Matematik 101',
                    title: 'Ödev Teslim Hatırlatması',
                    content: 'İntegral ödevinin son teslim tarihi yarın saat 23:59\'dur. Geç teslimlere puan kesintisi uygulanacaktır.',
                    isPinned: false,
                    authorId: 'u1',
                    authorName: 'Prof. Dr. Ahmet Yılmaz',
                    createdAt: new Date(Date.now() - 172800000).toISOString()
                },
                {
                    id: '3',
                    classroomId: 'c2',
                    classroomName: 'Fizik 102',
                    title: 'Lab Saati Değişikliği',
                    content: 'Bu haftaki laboratuvar dersi Salı yerine Çarşamba günü yapılacaktır. Aynı saat: 10:00.',
                    isPinned: false,
                    authorId: 'u2',
                    authorName: 'Doç. Dr. Ayşe Demir',
                    createdAt: new Date(Date.now() - 259200000).toISOString()
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePin = async (id: string) => {
        try {
            await announcementApi.togglePin(id);
            setAnnouncements(prev => prev.map(a => 
                a.id === id ? { ...a, isPinned: !a.isPinned } : a
            ));
        } catch (error) {
            setAnnouncements(prev => prev.map(a => 
                a.id === id ? { ...a, isPinned: !a.isPinned } : a
            ));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
        
        try {
            await announcementApi.delete(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins} dakika önce`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} saat önce`;
        }
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} gün önce`;
        }
        
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const filteredAnnouncements = selectedClassroom === 'all'
        ? announcements
        : announcements.filter(a => a.classroomId === selectedClassroom);

    const pinnedAnnouncements = filteredAnnouncements.filter(a => a.isPinned);
    const regularAnnouncements = filteredAnnouncements.filter(a => !a.isPinned);

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📢 Duyurular
                    </h1>
                    <p className="text-gray-500 mt-1">Sınıflarınızdaki duyuruları görüntüleyin</p>
                </div>
                {isInstructor && (
                    <button 
                        className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        + Yeni Duyuru
                    </button>
                )}
            </header>

            {/* Filters */}
            <div className="mb-6">
                <select 
                    value={selectedClassroom} 
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-700 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                >
                    <option value="all">Tüm Sınıflar</option>
                    {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                        <p className="text-gray-500">Yükleniyor...</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {pinnedAnnouncements.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                📌 Sabitlenmiş
                            </h2>
                            <div className="space-y-4">
                                {pinnedAnnouncements.map(announcement => (
                                    <AnnouncementCard
                                        key={announcement.id}
                                        announcement={announcement}
                                        isInstructor={isInstructor}
                                        onTogglePin={handleTogglePin}
                                        onDelete={handleDelete}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        {pinnedAnnouncements.length > 0 && (
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                📋 Tüm Duyurular
                            </h2>
                        )}
                        {regularAnnouncements.length === 0 && pinnedAnnouncements.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-rose-100 p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                                    📢
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Henüz duyuru yok</h3>
                                <p className="text-gray-500">Sınıflarınızda duyuru oluşturulduğunda burada görünecek</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {regularAnnouncements.map(announcement => (
                                    <AnnouncementCard
                                        key={announcement.id}
                                        announcement={announcement}
                                        isInstructor={isInstructor}
                                        onTogglePin={handleTogglePin}
                                        onDelete={handleDelete}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {isCreateModalOpen && (
                <CreateAnnouncementModal
                    classrooms={classrooms}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreated={(newAnnouncement) => {
                        setAnnouncements(prev => [newAnnouncement, ...prev]);
                        setIsCreateModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

interface AnnouncementCardProps {
    announcement: Announcement;
    isInstructor: boolean;
    onTogglePin: (id: string) => void;
    onDelete: (id: string) => void;
    formatDate: (date: string) => string;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
    announcement,
    isInstructor,
    onTogglePin,
    onDelete,
    formatDate
}) => {
    return (
        <div className={`bg-white rounded-2xl border p-6 transition-all ${
            announcement.isPinned ? 'border-rose-300 shadow-lg shadow-rose-100' : 'border-rose-100'
        }`}>
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                        {announcement.classroomName}
                    </span>
                    <span className="text-sm text-gray-500">{formatDate(announcement.createdAt)}</span>
                </div>
                {isInstructor && (
                    <div className="flex gap-2">
                        <button 
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                announcement.isPinned 
                                    ? 'bg-rose-100 text-rose-600' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-rose-50 hover:text-rose-500'
                            }`}
                            onClick={() => onTogglePin(announcement.id)}
                            title={announcement.isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                        >
                            📌
                        </button>
                        <button 
                            className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                            onClick={() => onDelete(announcement.id)}
                            title="Sil"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{announcement.title}</h3>
            <p className="text-gray-600 mb-4 whitespace-pre-wrap">{announcement.content}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>👤</span>
                <span>{announcement.authorName}</span>
            </div>
        </div>
    );
};

interface CreateAnnouncementModalProps {
    classrooms: Classroom[];
    onClose: () => void;
    onCreated: (announcement: Announcement) => void;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
    classrooms,
    onClose,
    onCreated
}) => {
    const { user } = useAuthStore();
    const [formData, setFormData] = useState({
        classroomId: classrooms[0]?.id || '',
        title: '',
        content: '',
        isPinned: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await announcementApi.create(formData);
            if (response.data.success && response.data.data) {
                onCreated(response.data.data);
            }
        } catch (err) {
            const mockAnnouncement: Announcement = {
                id: Math.random().toString(36).substring(7),
                classroomId: formData.classroomId,
                classroomName: classrooms.find(c => c.id === formData.classroomId)?.name || '',
                title: formData.title,
                content: formData.content,
                isPinned: formData.isPinned,
                authorId: user?.id || '',
                authorName: `${user?.firstName} ${user?.lastName}`,
                createdAt: new Date().toISOString()
            };
            onCreated(mockAnnouncement);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-rose-100 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        📢 Yeni Duyuru
                    </h2>
                    <button 
                        className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sınıf</label>
                        <select
                            value={formData.classroomId}
                            onChange={(e) => setFormData({ ...formData, classroomId: e.target.value })}
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        >
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Duyuru başlığı"
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">İçerik</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            placeholder="Duyuru içeriğini yazın..."
                            rows={5}
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                        />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.isPinned}
                            onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                            className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                        />
                        <span className="text-gray-700">📌 Bu duyuruyu sabitle</span>
                    </label>

                    <div className="flex gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                        >
                            {loading ? 'Yayınlanıyor...' : 'Yayınla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
