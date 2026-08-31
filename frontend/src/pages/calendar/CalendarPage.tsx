import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui';
import { classroomService } from '../../services/classroom.service';
import { examService } from '../../services/exam.service';
import { homeworkService } from '../../services/homework.service';
import { toast } from '../../lib/toast';

interface CalendarItem {
    id: string;
    title: string;
    when: string;
    kind: 'Sınav' | 'Ödev' | 'Canlı ders';
}

export const CalendarPage: React.FC = () => {
    const [items, setItems] = useState<CalendarItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [exams, homeworks, sessions] = await Promise.all([
                    examService.getExams(undefined, 1, 100),
                    homeworkService.getHomeworks(undefined, 1, 100),
                    classroomService.getUpcomingSessions().catch(() => []),
                ]);
                if (cancelled) return;
                const next: CalendarItem[] = [
                    ...exams.items.map((exam) => ({
                        id: `exam-${exam.id}`,
                        title: exam.title,
                        when: exam.startTime,
                        kind: 'Sınav' as const,
                    })),
                    ...homeworks.items.map((homework) => ({
                        id: `hw-${homework.id}`,
                        title: homework.title,
                        when: homework.dueDate,
                        kind: 'Ödev' as const,
                    })),
                    ...sessions.map((session) => ({
                        id: `live-${session.id}`,
                        title: session.title,
                        when: session.scheduledStartTime,
                        kind: 'Canlı ders' as const,
                    })),
                ];
                next.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
                setItems(next);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Takvim yüklenemedi');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const grouped = useMemo(() => {
        const map = new Map<string, CalendarItem[]>();
        for (const item of items) {
            const day = new Date(item.when).toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
            const list = map.get(day) ?? [];
            list.push(item);
            map.set(day, list);
        }
        return [...map.entries()];
    }, [items]);

    if (loading) {
        return <div className="page">Takvim yükleniyor...</div>;
    }

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">Takvim</h1>
                    <p className="page-subtitle">Ödevler, sınavlar ve canlı dersler</p>
                </div>
            </div>

            {grouped.length === 0 ? (
                <Card variant="default" padding="lg"><p>Yaklaşan etkinlik yok.</p></Card>
            ) : grouped.map(([day, dayItems]) => (
                <section key={day} style={{ marginBottom: 24 }}>
                    <h2>{day}</h2>
                    {dayItems.map((item) => (
                        <Card key={item.id} variant="default" padding="sm">
                            <strong>{item.kind}</strong> · {item.title}
                            <div>{new Date(item.when).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </Card>
                    ))}
                </section>
            ))}
        </div>
    );
};

export default CalendarPage;
