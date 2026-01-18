import React, { useState, useEffect, useRef } from 'react';
import { messageApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Conversation, Message } from '../../types';
import './Messages.css';

export const MessagesPage: React.FC = () => {
    const { user } = useAuthStore();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [_showNewConversation, setShowNewConversation] = useState(false);
    void _showNewConversation; // Reserved for future use
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            loadMessages(selectedConversation.id);
        }
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async () => {
        try {
            const response = await messageApi.getConversations();
            if (response.data.success && response.data.data) {
                setConversations(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            // Mock data
            setConversations([
                {
                    id: 'conv1',
                    type: 'Direct',
                    participants: [
                        { userId: 'u1', userName: 'Prof. Dr. Ahmet Yılmaz', profileImageUrl: undefined },
                        { userId: user?.id || '', userName: `${user?.firstName} ${user?.lastName}` }
                    ],
                    lastMessage: {
                        id: 'm1',
                        conversationId: 'conv1',
                        senderId: 'u1',
                        senderName: 'Prof. Dr. Ahmet Yılmaz',
                        content: 'Ödeviniz hakkında bir sorum var.',
                        isRead: false,
                        createdAt: new Date(Date.now() - 3600000).toISOString()
                    },
                    unreadCount: 2,
                    updatedAt: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 'conv2',
                    type: 'Group',
                    name: 'Matematik 101 - Grup',
                    participants: [
                        { userId: 'u1', userName: 'Prof. Dr. Ahmet Yılmaz' },
                        { userId: 'u2', userName: 'Ayşe Demir' },
                        { userId: 'u3', userName: 'Mehmet Kaya' }
                    ],
                    lastMessage: {
                        id: 'm2',
                        conversationId: 'conv2',
                        senderId: 'u2',
                        senderName: 'Ayşe Demir',
                        content: 'Yarınki ders hakkında bilgi var mı?',
                        isRead: true,
                        createdAt: new Date(Date.now() - 86400000).toISOString()
                    },
                    unreadCount: 0,
                    updatedAt: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: 'conv3',
                    type: 'Direct',
                    participants: [
                        { userId: 'u3', userName: 'Mehmet Kaya' },
                        { userId: user?.id || '', userName: `${user?.firstName} ${user?.lastName}` }
                    ],
                    lastMessage: {
                        id: 'm3',
                        conversationId: 'conv3',
                        senderId: user?.id || '',
                        senderName: `${user?.firstName} ${user?.lastName}`,
                        content: 'Tamam, yarın görüşürüz.',
                        isRead: true,
                        createdAt: new Date(Date.now() - 172800000).toISOString()
                    },
                    unreadCount: 0,
                    updatedAt: new Date(Date.now() - 172800000).toISOString()
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (conversationId: string) => {
        try {
            const response = await messageApi.getMessages(conversationId);
            if (response.data.success && response.data.data) {
                setMessages(response.data.data.items);
            }
        } catch (error) {
            // Mock messages
            setMessages([
                {
                    id: 'm1',
                    conversationId,
                    senderId: 'u1',
                    senderName: 'Prof. Dr. Ahmet Yılmaz',
                    content: 'Merhaba, nasılsınız?',
                    isRead: true,
                    createdAt: new Date(Date.now() - 7200000).toISOString()
                },
                {
                    id: 'm2',
                    conversationId,
                    senderId: user?.id || '',
                    senderName: `${user?.firstName} ${user?.lastName}`,
                    content: 'İyiyim hocam, teşekkür ederim. Siz nasılsınız?',
                    isRead: true,
                    createdAt: new Date(Date.now() - 6800000).toISOString()
                },
                {
                    id: 'm3',
                    conversationId,
                    senderId: 'u1',
                    senderName: 'Prof. Dr. Ahmet Yılmaz',
                    content: 'Ben de iyiyim. Ödeviniz hakkında bir sorum var. Türev hesaplamasında kullandığınız yöntemi açıklar mısınız?',
                    isRead: true,
                    createdAt: new Date(Date.now() - 3600000).toISOString()
                }
            ]);
            
            // Mark as read
            messageApi.markAsRead(conversationId).catch(() => {});
            setConversations(prev => prev.map(c => 
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ));
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        setSendingMessage(true);
        try {
            const response = await messageApi.sendMessage(selectedConversation.id, newMessage);
            if (response.data.success && response.data.data) {
                setMessages(prev => [...prev, response.data.data!]);
            }
        } catch {
            // Mock send
            const mockMessage: Message = {
                id: Math.random().toString(36).substring(7),
                conversationId: selectedConversation.id,
                senderId: user?.id || '',
                senderName: `${user?.firstName} ${user?.lastName}`,
                content: newMessage,
                isRead: false,
                createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, mockMessage]);
            
            // Update conversation
            setConversations(prev => prev.map(c => 
                c.id === selectedConversation.id 
                    ? { ...c, lastMessage: mockMessage, updatedAt: new Date().toISOString() }
                    : c
            ));
        } finally {
            setNewMessage('');
            setSendingMessage(false);
        }
    };

    const getConversationName = (conversation: Conversation): string => {
        if (conversation.name) return conversation.name;
        const otherParticipant = conversation.participants.find(p => p.userId !== user?.id);
        return otherParticipant?.userName || 'Bilinmeyen';
    };

    const getInitials = (name: string): string => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const formatTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 86400000) {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }
        if (diff < 604800000) {
            const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
            return days[date.getDay()];
        }
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="messages-page">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-page">
            <div className="messages-container">
                {/* Conversations List */}
                <div className="conversations-sidebar">
                    <div className="sidebar-header">
                        <h2>💬 Mesajlar</h2>
                        <button 
                            className="new-message-btn"
                            onClick={() => setShowNewConversation(true)}
                            title="Yeni mesaj"
                        >
                            ✏️
                        </button>
                    </div>

                    <div className="conversations-list">
                        {conversations.length === 0 ? (
                            <div className="empty-conversations">
                                <p>Henüz mesaj yok</p>
                            </div>
                        ) : (
                            conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={`conversation-item ${selectedConversation?.id === conv.id ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                                    onClick={() => setSelectedConversation(conv)}
                                >
                                    <div className="conversation-avatar">
                                        {conv.type === 'Group' ? (
                                            <span className="group-icon">👥</span>
                                        ) : (
                                            <span className="initials">
                                                {getInitials(getConversationName(conv))}
                                            </span>
                                        )}
                                    </div>
                                    <div className="conversation-info">
                                        <div className="conversation-header">
                                            <span className="conversation-name">
                                                {getConversationName(conv)}
                                            </span>
                                            <span className="conversation-time">
                                                {conv.lastMessage && formatTime(conv.lastMessage.createdAt)}
                                            </span>
                                        </div>
                                        <div className="conversation-preview">
                                            {conv.lastMessage && (
                                                <span className={conv.unreadCount > 0 ? 'unread' : ''}>
                                                    {conv.lastMessage.senderId === user?.id && 'Sen: '}
                                                    {conv.lastMessage.content}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {conv.unreadCount > 0 && (
                                        <span className="unread-badge">{conv.unreadCount}</span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="chat-area">
                    {selectedConversation ? (
                        <>
                            <div className="chat-header">
                                <div className="chat-user">
                                    <div className="user-avatar">
                                        {selectedConversation.type === 'Group' ? (
                                            <span className="group-icon">👥</span>
                                        ) : (
                                            <span className="initials">
                                                {getInitials(getConversationName(selectedConversation))}
                                            </span>
                                        )}
                                    </div>
                                    <div className="user-info">
                                        <h3>{getConversationName(selectedConversation)}</h3>
                                        {selectedConversation.type === 'Group' && (
                                            <span className="participants-count">
                                                {selectedConversation.participants.length} katılımcı
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="messages-area">
                                {messages.map(message => (
                                    <div
                                        key={message.id}
                                        className={`message ${message.senderId === user?.id ? 'sent' : 'received'}`}
                                    >
                                        {message.senderId !== user?.id && selectedConversation.type === 'Group' && (
                                            <span className="message-sender">{message.senderName}</span>
                                        )}
                                        <div className="message-bubble">
                                            <p>{message.content}</p>
                                            <span className="message-time">
                                                {formatTime(message.createdAt)}
                                                {message.senderId === user?.id && (
                                                    <span className="read-status">
                                                        {message.isRead ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            <form className="message-input" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Mesaj yazın..."
                                    disabled={sendingMessage}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newMessage.trim() || sendingMessage}
                                >
                                    {sendingMessage ? '...' : '➤'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="no-conversation-selected">
                            <span className="empty-icon">💬</span>
                            <h3>Bir konuşma seçin</h3>
                            <p>Mesajlarınızı görüntülemek için soldaki listeden bir konuşma seçin</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
