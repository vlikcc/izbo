import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { classroomApi, examApi, homeworkApi } from '../../services/api';
import type { ClassSession, Exam, Homework } from '../../types';
import './Calendar.css';

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
    const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

    useEffect(() => {
        loadEvents();
    }, [currentDate]);

    const loadEvents = async () => {
        setLoading(true);
        const allEvents: CalendarEvent[] = [];

        try {
            // Load sessions
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

            // Load exams
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

            // Load homework
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
            // Mock events
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

        // Add empty slots for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add all days of the month
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

    // Agenda view: upcoming events
    const upcomingEvents = events
        .filter(e => new Date(e.date) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 10);

    return (
        <div className="calendar-page">
            <header className="page-header">
                <div>
                    <h1>📅 Takvim</h1>
                    <p>Derslerinizi, sınavlarınızı ve ödevlerinizi takip edin</p>
                </div>
                <div className="view-toggles">
                    <button
                        className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
                        onClick={() => setViewMode('month')}
                    >
                        Ay
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'agenda' ? 'active' : ''}`}
                        onClick={() => setViewMode('agenda')}
                    >
                        Ajanda
                    </button>
                </div>
            </header>

            {viewMode === 'month' ? (
                <div className="calendar-container">
                    <div className="calendar-main">
                        <div className="calendar-header">
                            <button className="nav-btn" onClick={() => navigateMonth(-1)}>
                                ←
                            </button>
                            <h2>
                                {MONTHS_TR[currentDate.getMonth()]} {currentDate.getFullYear()}
                            </h2>
                            <button className="nav-btn" onClick={() => navigateMonth(1)}>
                                →
                            </button>
                            <button className="today-btn" onClick={goToToday}>
                                Bugün
                            </button>
                        </div>

                        <div className="calendar-grid">
                            {DAYS_TR.map(day => (
                                <div key={day} className="day-header">
                                    {day.slice(0, 3)}
                                </div>
                            ))}
                            {days.map((date, index) => (
                                <div
                                    key={index}
                                    className={`day-cell ${!date ? 'empty' : ''} ${date && isToday(date) ? 'today' : ''} ${date && selectedDate && date.toDateString() === selectedDate.toDateString() ? 'selected' : ''}`}
                                    onClick={() => date && setSelectedDate(date)}
                                >
                                    {date && (
                                        <>
                                            <span className="day-number">{date.getDate()}</span>
                                            <div className="day-events">
                                                {getEventsForDate(date).slice(0, 3).map(event => (
                                                    <div
                                                        key={event.id}
                                                        className="event-dot"
                                                        style={{ backgroundColor: event.color }}
                                                        title={event.title}
                                                    ></div>
                                                ))}
                                                {getEventsForDate(date).length > 3 && (
                                                    <span className="more-events">
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

                    <div className="calendar-sidebar">
                        {selectedDate ? (
                            <>
                                <h3>
                                    {selectedDate.getDate()} {MONTHS_TR[selectedDate.getMonth()]}
                                    <span className="day-name">{DAYS_TR[selectedDate.getDay()]}</span>
                                </h3>
                                {selectedDateEvents.length === 0 ? (
                                    <p className="no-events">Bu tarihte etkinlik yok</p>
                                ) : (
                                    <div className="event-list">
                                        {selectedDateEvents.map(event => (
                                            <Link
                                                key={event.id}
                                                to={event.link || '#'}
                                                className="event-item"
                                                style={{ borderLeftColor: event.color }}
                                            >
                                                <span className="event-icon">{getTypeIcon(event.type)}</span>
                                                <div className="event-info">
                                                    <span className="event-title">{event.title}</span>
                                                    <span className="event-time">{formatTime(event.date)}</span>
                                                    {event.classroomName && (
                                                        <span className="event-classroom">{event.classroomName}</span>
                                                    )}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="select-date-hint">
                                <span>📅</span>
                                <p>Etkinlikleri görmek için bir tarih seçin</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="agenda-view">
                    <h2>📋 Yaklaşan Etkinlikler</h2>
                    {loading ? (
                        <div className="loading">
                            <div className="spinner"></div>
                        </div>
                    ) : upcomingEvents.length === 0 ? (
                        <div className="empty-agenda">
                            <span>🎉</span>
                            <p>Yaklaşan etkinlik yok</p>
                        </div>
                    ) : (
                        <div className="agenda-list">
                            {upcomingEvents.map(event => {
                                const eventDate = new Date(event.date);
                                const now = new Date();
                                const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                                return (
                                    <Link
                                        key={event.id}
                                        to={event.link || '#'}
                                        className="agenda-item"
                                    >
                                        <div className="agenda-date">
                                            <span className="agenda-day">{eventDate.getDate()}</span>
                                            <span className="agenda-month">{MONTHS_TR[eventDate.getMonth()].slice(0, 3)}</span>
                                        </div>
                                        <div
                                            className="agenda-indicator"
                                            style={{ backgroundColor: event.color }}
                                        ></div>
                                        <div className="agenda-content">
                                            <span className="agenda-title">
                                                {getTypeIcon(event.type)} {event.title}
                                            </span>
                                            <span className="agenda-time">
                                                {formatTime(eventDate)}
                                                {event.endDate && ` - ${formatTime(event.endDate)}`}
                                            </span>
                                            {event.classroomName && (
                                                <span className="agenda-classroom">{event.classroomName}</span>
                                            )}
                                        </div>
                                        <div className="agenda-countdown">
                                            {diffDays === 0 ? (
                                                <span className="today-badge">Bugün</span>
                                            ) : diffDays === 1 ? (
                                                <span className="tomorrow-badge">Yarın</span>
                                            ) : (
                                                <span>{diffDays} gün</span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <div className="legend">
                <div className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: '#10b981' }}></span>
                    Canlı Ders
                </div>
                <div className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: '#8b5cf6' }}></span>
                    Sınav
                </div>
                <div className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
                    Ödev
                </div>
            </div>
        </div>
    );
};
