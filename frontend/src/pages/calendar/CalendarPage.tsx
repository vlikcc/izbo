import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { classroomApi, examApi, homeworkApi } from '../../services/api';
import type { ClassSession, Exam, Homework } from '../../types';

interface CalendarEvent {
    id: string;
    title: string;
    type: 'session' | 'exam' | 'homework' | 'personal';
    date: Date;
    endDate?: Date;
    classroomName?: string;
    link?: string;
    color: string;
}

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export const CalendarPage: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

    useEffect(() => {
        loadEvents();
    }, [currentDate]);

    const loadEvents = async () => {
        setLoading(true);
        const allEvents: CalendarEvent[] = [];

        try {
            const [sessionsRes, upcomingRes] = await Promise.all([
                classroomApi.getLiveSessions(),
                classroomApi.getUpcomingSessions()
            ]);

            if (sessionsRes.data.success && sessionsRes.data.data) {
                sessionsRes.data.data.forEach((session: ClassSession) => {
                    allEvents.push({
                        id: `session-${session.id}`,
                        title: session.title,
                        type: 'session',
                        date: new Date(session.scheduledStartTime),
                        endDate: new Date(session.scheduledEndTime),
                        link: `/live/${session.id}`,
                        color: '#ef4444'
                    });
                });
            }

            if (upcomingRes.data.success && upcomingRes.data.data) {
                upcomingRes.data.data.forEach((session: ClassSession) => {
                    if (!allEvents.find(e => e.id === `session-${session.id}`)) {
                        allEvents.push({
                            id: `session-${session.id}`,
                            title: session.title,
                            type: 'session',
                            date: new Date(session.scheduledStartTime),
                            endDate: new Date(session.scheduledEndTime),
                            link: `/live/${session.id}`,
                            color: '#10b981'
                        });
                    }
                });
            }

            const examsRes = await examApi.getAll();
            if (examsRes.data.success && examsRes.data.data) {
                examsRes.data.data.items.forEach((exam: Exam) => {
                    allEvents.push({
                        id: `exam-${exam.id}`,
                        title: exam.title,
                        type: 'exam',
                        date: new Date(exam.startTime),
                        endDate: new Date(exam.endTime),
                        classroomName: exam.classroomName,
                        link: `/exams/${exam.id}`,
                        color: '#8b5cf6'
                    });
                });
            }

            const homeworkRes = await homeworkApi.getAll();
            if (homeworkRes.data.success && homeworkRes.data.data) {
                homeworkRes.data.data.items.forEach((hw: Homework) => {
                    allEvents.push({
                        id: `homework-${hw.id}`,
                        title: hw.title,
                        type: 'homework',
                        date: new Date(hw.dueDate),
                        classroomName: hw.classroomName,
                        link: `/homework/${hw.id}`,
                        color: '#f59e0b'
                    });
                });
            }

            setEvents(allEvents);
        } catch (error) {
            const now = new Date();
            setEvents([
                {
                    id: '1',
                    title: 'Matematik Canlı Ders',
                    type: 'session',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 30),
                    classroomName: 'Matematik 101',
                    link: '/live/1',
                    color: '#10b981'
                },
                {
                    id: '2',
                    title: 'Fizik Ara Sınavı',
                    type: 'exam',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 0),
                    classroomName: 'Fizik 102',
                    link: '/exams/1',
                    color: '#8b5cf6'
                },
                {
                    id: '3',
                    title: 'Türev Ödevi',
                    type: 'homework',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 23, 59),
                    classroomName: 'Matematik 101',
                    link: '/homework/1',
                    color: '#f59e0b'
                },
                {
                    id: '4',
                    title: 'Laboratuvar Dersi',
                    type: 'session',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 10, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12, 0),
                    classroomName: 'Fizik 102',
                    link: '/live/2',
                    color: '#10b981'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days: (Date | null)[] = [];

        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const getEventsForDate = (date: Date) => {
        return events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.getDate() === date.getDate() &&
                eventDate.getMonth() === date.getMonth() &&
                eventDate.getFullYear() === date.getFullYear();
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const navigateMonth = (direction: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    const goToToday = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    };

    const getTypeIcon = (type: CalendarEvent['type']) => {
        switch (type) {
            case 'session': return '🎥';
            case 'exam': return '📋';
            case 'homework': return '📝';
            case 'personal': return '📌';
            default: return '📅';
        }
    };

    const days = getDaysInMonth(currentDate);
    const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

    const upcomingEvents = events
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 10);

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📅 Takvim
                    </h1>
                    <p className="text-gray-500 mt-1">Derslerinizi, sınavlarınızı ve ödevlerinizi takip edin</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            viewMode === 'month' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setViewMode('month')}
                    >
                        Ay
                    </button>
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            viewMode === 'agenda' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setViewMode('agenda')}
                    >
                        Ajanda
                    </button>
                </div>
            </header>

            {viewMode === 'month' ? (
                <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                    {/* Calendar Main */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <button 
                                className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                                onClick={() => navigateMonth(-1)}
                            >
                                ←
                            </button>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {MONTHS_TR[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </h2>
                            <div className="flex gap-2">
                                <button 
                                    className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors"
                                    onClick={() => navigateMonth(1)}
                                >
                                    →
                                </button>
                                <button 
                                    className="px-4 py-2 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors"
                                    onClick={goToToday}
                                >
                                    Bugün
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {DAYS_TR.map(day => (
                                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                                    {day.slice(0, 3)}
                                </div>
                            ))}
                            {days.map((date, index) => (
                                <div
                                    key={index}
                                    className={`min-h-[80px] p-2 rounded-xl cursor-pointer transition-all ${
                                        !date ? 'bg-transparent' : 
                                        isToday(date) ? 'bg-rose-100 border-2 border-rose-400' :
                                        selectedDate && date.toDateString() === selectedDate.toDateString() ? 'bg-rose-50 border-2 border-rose-300' :
                                        'bg-gray-50 hover:bg-rose-50'
                                    }`}
                                    onClick={() => date && setSelectedDate(date)}
                                >
                                    {date && (
                                        <>
                                            <span className={`text-sm font-medium ${isToday(date) ? 'text-rose-600' : 'text-gray-700'}`}>
                                                {date.getDate()}
                                            </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {getEventsForDate(date).slice(0, 3).map(event => (
                                                    <div
                                                        key={event.id}
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: event.color }}
                                                        title={event.title}
                                                    ></div>
                                                ))}
                                                {getEventsForDate(date).length > 3 && (
                                                    <span className="text-xs text-gray-500">
                                                        +{getEventsForDate(date).length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        {selectedDate ? (
                            <>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                    {selectedDate.getDate()} {MONTHS_TR[selectedDate.getMonth()]}
                                </h3>
                                <p className="text-gray-500 text-sm mb-4">{DAYS_TR[selectedDate.getDay()]}</p>
                                {selectedDateEvents.length === 0 ? (
                                    <p className="text-gray-400 text-center py-8">Bu tarihte etkinlik yok</p>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedDateEvents.map(event => (
                                            <Link
                                                key={event.id}
                                                to={event.link || '#'}
                                                className="block p-3 rounded-xl border-l-4 bg-gray-50 hover:bg-rose-50 transition-colors"
                                                style={{ borderLeftColor: event.color }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg">{getTypeIcon(event.type)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-gray-900 block truncate">{event.title}</span>
                                                        <span className="text-sm text-gray-500">{formatTime(event.date)}</span>
                                                        {event.classroomName && (
                                                            <span className="text-sm text-gray-400 block">{event.classroomName}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-center py-12">
                                <span className="text-4xl mb-4 block">📅</span>
                                <p className="text-gray-500">Etkinlikleri görmek için bir tarih seçin</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-rose-100 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        📋 Yaklaşan Etkinlikler
                    </h2>
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                        </div>
                    ) : upcomingEvents.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="text-4xl mb-4 block">🎉</span>
                            <p className="text-gray-500">Yaklaşan etkinlik yok</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {upcomingEvents.map(event => {
                                const eventDate = new Date(event.date);
                                const now = new Date();
                                const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <Link
                                        key={event.id}
                                        to={event.link || '#'}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-rose-50 transition-colors"
                                    >
                                        <div className="text-center flex-shrink-0">
                                            <span className="text-2xl font-bold text-gray-900 block">{eventDate.getDate()}</span>
                                            <span className="text-xs text-gray-500">{MONTHS_TR[eventDate.getMonth()].slice(0, 3)}</span>
                                        </div>
                                        <div className="w-1 h-12 rounded-full" style={{ backgroundColor: event.color }}></div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-medium text-gray-900 flex items-center gap-2">
                                                {getTypeIcon(event.type)} {event.title}
                                            </span>
                                            <span className="text-sm text-gray-500 block">
                                                {formatTime(eventDate)}
                                                {event.endDate && ` - ${formatTime(event.endDate)}`}
                                            </span>
                                            {event.classroomName && (
                                                <span className="text-sm text-gray-400">{event.classroomName}</span>
                                            )}
                                        </div>
                                        <div className="flex-shrink-0">
                                            {diffDays === 0 ? (
                                                <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-medium rounded-full">Bugün</span>
                                            ) : diffDays === 1 ? (
                                                <span className="px-3 py-1 bg-orange-100 text-orange-600 text-sm font-medium rounded-full">Yarın</span>
                                            ) : (
                                                <span className="text-gray-500">{diffDays} gün</span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-6 mt-6 justify-center">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-sm text-gray-600">Canlı Ders</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-violet-500"></span>
                    <span className="text-sm text-gray-600">Sınav</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-sm text-gray-600">Ödev</span>
                </div>
            </div>
        </div>
    );
};
