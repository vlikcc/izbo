import type { User } from '../../types';
import { isAdmin, isParent, isStaff, isStudent } from '../../utils/roles';

export interface NavItem {
    path: string;
    icon: string;
    label: string;
}

type Translate = (key: string) => string;

/**
 * The sidebar for each kind of account. Parents follow their children rather than take lessons, so they
 * get none of the classroom tools; children do not see billing, which their parent handles.
 */
export function buildNavItems(user: Pick<User, 'role'> | null | undefined, t: Translate): NavItem[] {
    const home = { path: '/app/dashboard', icon: '🏠', label: t('nav.home') };
    const profile = { path: '/app/profile', icon: '👤', label: t('nav.profile') };
    const billing = { path: '/app/billing', icon: '💳', label: 'Planım' };

    if (isParent(user)) {
        return [
            home,
            { path: '/app/children', icon: '👨‍👩‍👧', label: 'Çocuklarım' },
            { path: '/app/paketler', icon: '⭐', label: 'Paketler' },
            profile,
        ];
    }

    const lessons = { path: '/app/dersler', icon: '🎓', label: 'Derslerim' };
    const learning = [
        { path: '/app/classrooms', icon: '📚', label: t('nav.classrooms') },
        { path: '/app/exams', icon: '📝', label: t('nav.exams') },
        { path: '/app/homework', icon: '📖', label: t('nav.homework') },
        { path: '/app/live', icon: '🎥', label: t('nav.live') },
        { path: '/app/calendar', icon: '📅', label: t('nav.calendar') },
    ];

    if (isStudent(user)) {
        return [
            home,
            lessons,
            { path: '/app/denemeler', icon: '🏆', label: 'Denemeler' },
            ...learning,
            { path: '/app/paketler', icon: '⭐', label: 'Paketim' },
            profile,
        ];
    }

    return [
        home,
        lessons,
        ...learning,
        ...(isStaff(user)
            ? [
                { path: '/app/icerik', icon: '🎬', label: 'İçeriklerim' },
                { path: '/app/sorular', icon: '❓', label: 'Soru bankası' },
            ]
            : []),
        billing,
        ...(isStaff(user) ? [{ path: '/app/gradebook', icon: '📊', label: t('nav.gradebook') }] : []),
        ...(isAdmin(user)
            ? [
                { path: '/app/admin', icon: '🛡️', label: t('nav.admin') },
                { path: '/app/admin/mufredat', icon: '🗂️', label: 'Müfredat' },
                { path: '/app/admin/denemeler', icon: '🏆', label: 'Deneme sınavları' },
                { path: '/app/admin/icerik-onay', icon: '✅', label: 'Onay kuyruğu' },
                { path: '/app/admin/subscriptions', icon: '⚙️', label: 'Abonelikler' },
                { path: '/app/admin/odemeler', icon: '💸', label: 'Ödemeler' },
                { path: '/app/admin/paketler', icon: '⭐', label: 'Öğrenci paketleri' },
            ]
            : []),
        profile,
    ];
}
