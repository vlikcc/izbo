import { describe, expect, it } from 'vitest';
import { buildNavItems } from './navItems';

const t = (key: string) => key;
const paths = (role: Parameters<typeof buildNavItems>[0]) => buildNavItems(role, t).map(i => i.path);

describe('buildNavItems', () => {
    it('gives parents their children and none of the classroom tools', () => {
        const items = paths({ role: 'Parent' });

        expect(items).toContain('/app/children');
        expect(items).not.toContain('/app/exams');
        expect(items).not.toContain('/app/homework');
        expect(items).not.toContain('/app/classrooms');
        expect(items).not.toContain('/app/dersler');
    });

    it('keeps billing away from students, whose parent pays', () => {
        const items = paths({ role: 'Student' });

        expect(items).toContain('/app/classrooms');
        expect(items).toContain('/app/dersler');
        expect(items).toContain('/app/exams');
        expect(items).not.toContain('/app/icerik');
        expect(items).not.toContain('/app/billing');
        expect(items).not.toContain('/app/children');
        expect(items).not.toContain('/app/gradebook');
    });

    it('shows teachers the gradebook but not admin pages', () => {
        const items = paths({ role: 'Instructor' });

        expect(items).toContain('/app/gradebook');
        expect(items).toContain('/app/icerik');
        expect(items).toContain('/app/billing');
        expect(items).not.toContain('/app/admin');
        expect(items).not.toContain('/app/admin/icerik-onay');
    });

    it('shows administrators everything they manage', () => {
        const items = paths({ role: 'SuperAdmin' });

        expect(items).toEqual(expect.arrayContaining([
            '/app/gradebook', '/app/admin', '/app/admin/subscriptions', '/app/admin/mufredat', '/app/admin/icerik-onay',
        ]));
    });
});
