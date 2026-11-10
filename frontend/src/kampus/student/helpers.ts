// Öğrenci paneli ortak yardımcıları (prototipte pages-student.js başı).
import { COURSES, TOPICS, TOPIC_PLANETS } from '../core';

export const NAV: [key: string, to: string, icon: string, label: string][] = [
    ['ana', '/ogrenci', '🏠', 'Ana Sayfa'],
    ['dersler', '/ogrenci/derslerim', '📚', 'Derslerim'],
    ['odevler', '/ogrenci/odevlerim', '📋', 'Ödevlerim'],
    ['sinavlar', '/ogrenci/sinavlar', '📝', 'Sınavlar'],
    ['kutuphane', '/ogrenci/kutuphane', '📖', 'E-Kütüphane'],
    ['oyunlar', '/ogrenci/oyunlar', '🎮', 'Oyunlar'],
    ['kupa', '/ogrenci/kupa', '🏆', 'Yıldız Kupası'],
    ['profil', '/ogrenci/profilim', '👤', 'Profilim'],
];
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export function dateLabel(ymd: string) {
    const d = new Date(ymd + 'T12:00:00');
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 864e5);
    if (diff === 0) return 'Bugün';
    if (diff === 1) return 'Yarın';
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const longDate = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
export const subjectOfTopic = (id: string): string => { const t = TOPICS[id]; return t.meeting ? 'matematik' : COURSES[t.course].subject; };
export const badgeName = (id: string): string => (TOPIC_PLANETS[id] && TOPIC_PLANETS[id].badge) || ((TOPICS[id] && TOPICS[id].title) || 'Konu') + ' Rozeti';

// Her konunun patikası farklı renkte: konunun dersteki sırasına göre bu paletten renk alır
export const TOPIC_COLORS = ['#58B947', '#1E88E5', '#8E5CF7', '#FF8A3D', '#E25A86', '#1AA6B7', '#E0A100', '#E5533D', '#4C5FD5', '#2BA37E'];
export const topicColor = (i: number) => TOPIC_COLORS[i % TOPIC_COLORS.length];
