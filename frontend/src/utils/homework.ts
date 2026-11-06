import type { StudentHomework } from '../services/guardian.service';

/** Homework that is still open: not handed in yet and not past its due date. */
export function pendingHomework(items: StudentHomework[], now = new Date()): StudentHomework[] {
    return items.filter(i => !i.submission && new Date(i.homework.dueDate) >= now);
}

/** Homework past its due date with nothing handed in. */
export function missedHomework(items: StudentHomework[], now = new Date()): StudentHomework[] {
    return items.filter(i => !i.submission && new Date(i.homework.dueDate) < now);
}
