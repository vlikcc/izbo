import React, { useState } from 'react';
import './Notifications.css';

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'homework' | 'exam' | 'live';
    title: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
    link?: string;
}

// Mock notifications - in a real app, these would come from API
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
        <div className="notifications-page">
            <header className="page-header">
                <div>
                    <h1>🔔 Bildirimler</h1>
                    <p>
                        {unreadCount > 0
                            ? `${unreadCount} okunmamış bildirim`
                            : 'Tüm bildirimler okundu'}
                    </p>
                </div>
                <div className="header-actions">
                    {unreadCount > 0 && (
                        <button className="mark-all-btn" onClick={markAllAsRead}>
                            ✓ Tümünü Okundu İşaretle
                        </button>
                    )}
                </div>
            </header>

            {/* Filter Tabs */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    Tümü ({notifications.length})
                </button>
                <button
                    className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
                    onClick={() => setFilter('unread')}
                >
                    Okunmamış ({unreadCount})
                </button>
            </div>

            {/* Notifications List */}
            <div className="notifications-list">
                {filteredNotifications.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <h3>Bildirim yok</h3>
                        <p>
                            {filter === 'unread'
                                ? 'Tüm bildirimler okunmuş'
                                : 'Henüz bildiriminiz bulunmuyor'}
                        </p>
                    </div>
                ) : (
                    filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`notification-item ${notification.isRead ? 'read' : 'unread'} ${notification.type}`}
                            onClick={() => markAsRead(notification.id)}
                        >
                            <div className="notification-icon">
                                {getIcon(notification.type)}
                            </div>
                            <div className="notification-content">
                                <div className="notification-header">
                                    <h3>{notification.title}</h3>
                                    <span className="notification-time">
                                        {formatTime(notification.timestamp)}
                                    </span>
                                </div>
                                <p>{notification.message}</p>
                                {notification.link && (
                                    <a href={notification.link} className="notification-link">
                                        Görüntüle →
                                    </a>
                                )}
                            </div>
                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notification.id);
                                }}
                                title="Sil"
                            >
                                ✕
                            </button>
                            {!notification.isRead && <span className="unread-dot"></span>}
                        </div>
                    ))
                )}
            </div>

            {/* Notification Settings */}
            <section className="settings-section">
                <h2>⚙️ Bildirim Ayarları</h2>
                <div className="settings-grid">
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">📧</span>
                            <span>E-posta Bildirimleri</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">🔔</span>
                            <span>Push Bildirimleri</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">📝</span>
                            <span>Ödev Bildirimleri</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">📋</span>
                            <span>Sınav Hatırlatmaları</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">🎥</span>
                            <span>Canlı Ders Bildirimleri</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                    <label className="setting-item">
                        <span className="setting-info">
                            <span className="setting-icon">📣</span>
                            <span>Duyuru Bildirimleri</span>
                        </span>
                        <input type="checkbox" defaultChecked className="toggle" />
                    </label>
                </div>
            </section>
        </div>
    );
};
