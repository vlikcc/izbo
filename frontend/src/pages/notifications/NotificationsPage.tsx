import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'homework' | 'exam' | 'live';
    title: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
    link?: string;
}

const mockNotifications: Notification[] = [
    {
        id: '1',
        type: 'live',
        title: 'Canlı Ders Başladı',
        message: 'Matematik 101 dersi şimdi başladı. Katılmak için tıklayın.',
        timestamp: new Date(Date.now() - 5 * 60000),
        isRead: false,
        link: '/live/123',
    },
    {
        id: '2',
        type: 'homework',
        title: 'Yeni Ödev',
        message: 'Fizik dersi için yeni ödev yayınlandı. Son teslim: 3 gün sonra.',
        timestamp: new Date(Date.now() - 2 * 3600000),
        isRead: false,
        link: '/homework/456',
    },
    {
        id: '3',
        type: 'exam',
        title: 'Sınav Hatırlatması',
        message: 'Yarın saat 10:00\'da Kimya sınavınız var.',
        timestamp: new Date(Date.now() - 24 * 3600000),
        isRead: true,
    },
    {
        id: '4',
        type: 'success',
        title: 'Ödev Notunuz Açıklandı',
        message: 'Matematik ödevi için 85/100 puan aldınız.',
        timestamp: new Date(Date.now() - 48 * 3600000),
        isRead: true,
        link: '/homework/789',
    },
    {
        id: '5',
        type: 'info',
        title: 'Yeni Sınıfa Eklendınız',
        message: 'Biyoloji 102 sınıfına eklendiniz.',
        timestamp: new Date(Date.now() - 72 * 3600000),
        isRead: true,
        link: '/classrooms/abc',
    },
    {
        id: '6',
        type: 'warning',
        title: 'Ödev Teslim Tarihi Yaklaşıyor',
        message: 'Tarih ödevinin son teslim tarihi 2 saat sonra.',
        timestamp: new Date(Date.now() - 96 * 3600000),
        isRead: true,
    },
];

export const NotificationsPage: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'live': return '🔴';
            case 'homework': return '📝';
            case 'exam': return '📋';
            case 'success': return '✅';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    const getTypeStyles = (type: Notification['type']) => {
        switch (type) {
            case 'live': return 'bg-red-50 border-red-200';
            case 'homework': return 'bg-orange-50 border-orange-200';
            case 'exam': return 'bg-blue-50 border-blue-200';
            case 'success': return 'bg-emerald-50 border-emerald-200';
            case 'warning': return 'bg-amber-50 border-amber-200';
            default: return 'bg-gray-50 border-gray-200';
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Şimdi';
        if (diffMins < 60) return `${diffMins} dakika önce`;
        if (diffHours < 24) return `${diffHours} saat önce`;
        if (diffDays === 1) return 'Dün';
        if (diffDays < 7) return `${diffDays} gün önce`;
        return date.toLocaleDateString('tr-TR');
    };

    const markAsRead = (id: string) => {
        setNotifications(notifications.map(n =>
            n.id === id ? { ...n, isRead: true } : n
        ));
    };

    const markAllAsRead = () => {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
    };

    const deleteNotification = (id: string) => {
        setNotifications(notifications.filter(n => n.id !== id));
    };

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        🔔 Bildirimler
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {unreadCount > 0
                            ? `${unreadCount} okunmamış bildirim`
                            : 'Tüm bildirimler okundu'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button 
                        className="px-4 py-2 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors"
                        onClick={markAllAsRead}
                    >
                        ✓ Tümünü Okundu İşaretle
                    </button>
                )}
            </header>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        filter === 'all' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setFilter('all')}
                >
                    Tümü ({notifications.length})
                </button>
                <button
                    className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        filter === 'unread' 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                            : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                    }`}
                    onClick={() => setFilter('unread')}
                >
                    Okunmamış ({unreadCount})
                </button>
            </div>

            {/* Notifications List */}
            <div className="space-y-3 mb-8">
                {filteredNotifications.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-rose-100 p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                            📭
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Bildirim yok</h3>
                        <p className="text-gray-500">
                            {filter === 'unread'
                                ? 'Tüm bildirimler okunmuş'
                                : 'Henüz bildiriminiz bulunmuyor'}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                                notification.isRead 
                                    ? 'bg-white border-rose-100 opacity-75' 
                                    : getTypeStyles(notification.type)
                            }`}
                            onClick={() => markAsRead(notification.id)}
                        >
                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-xl shadow-sm flex-shrink-0">
                                {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                        {formatTime(notification.timestamp)}
                                    </span>
                                </div>
                                <p className="text-gray-600 text-sm">{notification.message}</p>
                                {notification.link && (
                                    <Link 
                                        to={notification.link} 
                                        className="inline-block mt-2 text-rose-500 hover:text-rose-600 text-sm font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Görüntüle →
                                    </Link>
                                )}
                            </div>
                            <button
                                className="w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex items-center justify-center transition-colors flex-shrink-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                }}
                                title="Sil"
                            >
                                ✕
                            </button>
                            {!notification.isRead && (
                                <span className="absolute top-4 right-14 w-2 h-2 bg-rose-500 rounded-full"></span>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Notification Settings */}
            <section className="bg-white rounded-2xl border border-rose-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    ⚙️ Bildirim Ayarları
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: '📧', label: 'E-posta Bildirimleri' },
                        { icon: '🔔', label: 'Push Bildirimleri' },
                        { icon: '📝', label: 'Ödev Bildirimleri' },
                        { icon: '📋', label: 'Sınav Hatırlatmaları' },
                        { icon: '🎥', label: 'Canlı Ders Bildirimleri' },
                        { icon: '📣', label: 'Duyuru Bildirimleri' },
                    ].map((setting, index) => (
                        <label key={index} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-xl cursor-pointer hover:bg-rose-100/50 transition-colors">
                            <span className="flex items-center gap-3">
                                <span className="text-xl">{setting.icon}</span>
                                <span className="text-gray-700 font-medium">{setting.label}</span>
                            </span>
                            <input 
                                type="checkbox" 
                                defaultChecked 
                                className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                            />
                        </label>
                    ))}
                </div>
            </section>
        </div>
    );
};
