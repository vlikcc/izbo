import React, { useEffect, useState } from 'react';
import { Button, Card, Input } from '../ui';
import { classroomService, type Announcement, type ClassroomComment } from '../../services/classroom.service';
import { toast } from '../../lib/toast';

interface AnnouncementBoardProps {
    classroomId: string;
    canManage: boolean;
}

export const AnnouncementBoard: React.FC<AnnouncementBoardProps> = ({ classroomId, canManage }) => {
    const [items, setItems] = useState<Announcement[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [comments, setComments] = useState<Record<string, ClassroomComment[]>>({});
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const reload = async () => {
        const list = await classroomService.getAnnouncements(classroomId);
        setItems(list);
        const entries = await Promise.all(list.map(async (item) => {
            const thread = await classroomService.getComments(classroomId, 'Announcement', item.id);
            return [item.id, thread] as const;
        }));
        setComments(Object.fromEntries(entries));
    };

    useEffect(() => {
        void reload().catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : 'Duyurular yüklenemedi');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [classroomId]);

    const publish = async (event: React.FormEvent) => {
        event.preventDefault();
        try {
            await classroomService.createAnnouncement(classroomId, { title, body });
            setTitle('');
            setBody('');
            await reload();
            toast.success('Duyuru yayınlandı');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Duyuru oluşturulamadı');
        }
    };

    const remove = async (id: string) => {
        try {
            await classroomService.deleteAnnouncement(classroomId, id);
            await reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Silinemedi');
        }
    };

    const comment = async (announcementId: string) => {
        const text = drafts[announcementId]?.trim();
        if (!text) return;
        try {
            await classroomService.addComment(classroomId, {
                targetType: 'Announcement',
                targetId: announcementId,
                body: text,
            });
            setDrafts((prev) => ({ ...prev, [announcementId]: '' }));
            await reload();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Yorum eklenemedi');
        }
    };

    return (
        <section className="section-block">
            <h3 className="section-title">📢 Duyurular</h3>
            {canManage && (
                <form onSubmit={(event) => void publish(event)} style={{ marginBottom: 16 }}>
                    <Input label="Başlık" value={title} onChange={(event) => setTitle(event.target.value)} required />
                    <label htmlFor="announcement-body">Metin</label>
                    <textarea
                        id="announcement-body"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        required
                        rows={3}
                        style={{ width: '100%' }}
                    />
                    <Button type="submit" variant="primary" size="sm">Yayınla</Button>
                </form>
            )}
            {items.length === 0 ? (
                <Card variant="default" padding="md" className="empty-state-card">
                    <p>Henüz duyuru yok.</p>
                </Card>
            ) : items.map((item) => (
                <Card key={item.id} variant="default" padding="md">
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                    <p>{new Date(item.createdAt).toLocaleString('tr-TR')}</p>
                    {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => void remove(item.id)}>Sil</Button>
                    )}
                    <div>
                        {(comments[item.id] ?? []).map((entry) => (
                            <p key={entry.id}>{entry.body}</p>
                        ))}
                        <Input
                            label="Yorum"
                            value={drafts[item.id] ?? ''}
                            onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))}
                        />
                        <Button variant="outline" size="sm" onClick={() => void comment(item.id)}>Gönder</Button>
                    </div>
                </Card>
            ))}
        </section>
    );
};
