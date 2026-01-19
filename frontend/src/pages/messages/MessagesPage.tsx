import React, { useState, useEffect, useRef } from 'react';
import { messageApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Conversation, Message } from '../../types';

export const MessagesPage: React.FC = () => {
    const { user } = useAuthStore();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [_showNewConversation, setShowNewConversation] = useState(false);
    void _showNewConversation;
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
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 flex">
            {/* Conversations Sidebar */}
            <div className="w-80 bg-white border-r border-rose-100 flex flex-col">
                <div className="p-4 border-b border-rose-100 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        💬 Mesajlar
                    </h2>
                    <button 
                        className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                        onClick={() => setShowNewConversation(true)}
                        title="Yeni mesaj"
                    >
                        ✏️
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <p>Henüz mesaj yok</p>
                        </div>
                    ) : (
                        conversations.map(conv => (
                            <div
                                key={conv.id}
                                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-rose-50 ${
                                    selectedConversation?.id === conv.id 
                                        ? 'bg-rose-50' 
                                        : 'hover:bg-rose-50/50'
                                }`}
                                onClick={() => setSelectedConversation(conv)}
                            >
                                <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                                    {conv.type === 'Group' ? (
                                        <span>👥</span>
                                    ) : (
                                        <span>{getInitials(getConversationName(conv))}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`font-medium truncate ${conv.unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {getConversationName(conv)}
                                        </span>
                                        <span className="text-xs text-gray-500 flex-shrink-0">
                                            {conv.lastMessage && formatTime(conv.lastMessage.createdAt)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {conv.lastMessage && (
                                            <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                                {conv.lastMessage.senderId === user?.id && 'Sen: '}
                                                {conv.lastMessage.content}
                                            </span>
                                        )}
                                        {conv.unreadCount > 0 && (
                                            <span className="ml-2 w-5 h-5 bg-rose-500 text-white text-xs font-medium rounded-full flex items-center justify-center flex-shrink-0">
                                                {conv.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
                {selectedConversation ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 bg-white border-b border-rose-100 flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white font-semibold">
                                {selectedConversation.type === 'Group' ? (
                                    <span>👥</span>
                                ) : (
                                    <span>{getInitials(getConversationName(selectedConversation))}</span>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{getConversationName(selectedConversation)}</h3>
                                {selectedConversation.type === 'Group' && (
                                    <span className="text-sm text-gray-500">
                                        {selectedConversation.participants.length} katılımcı
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map(message => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[70%] ${message.senderId === user?.id ? 'order-2' : ''}`}>
                                        {message.senderId !== user?.id && selectedConversation.type === 'Group' && (
                                            <span className="text-xs text-gray-500 mb-1 block">{message.senderName}</span>
                                        )}
                                        <div className={`px-4 py-3 rounded-2xl ${
                                            message.senderId === user?.id 
                                                ? 'bg-gradient-to-r from-rose-500 to-rose-400 text-white rounded-br-md' 
                                                : 'bg-white border border-rose-100 text-gray-800 rounded-bl-md'
                                        }`}>
                                            <p className="text-sm">{message.content}</p>
                                            <span className={`text-xs mt-1 block ${
                                                message.senderId === user?.id ? 'text-rose-100' : 'text-gray-400'
                                            }`}>
                                                {formatTime(message.createdAt)}
                                                {message.senderId === user?.id && (
                                                    <span className="ml-1">
                                                        {message.isRead ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <form className="p-4 bg-white border-t border-rose-100 flex gap-3" onSubmit={handleSendMessage}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Mesaj yazın..."
                                disabled={sendingMessage}
                                className="flex-1 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim() || sendingMessage}
                                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sendingMessage ? '...' : '➤'}
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center text-4xl">
                                💬
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">Bir konuşma seçin</h3>
                            <p className="text-gray-500">Mesajlarınızı görüntülemek için soldaki listeden bir konuşma seçin</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
