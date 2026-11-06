import type { StudentHomework } from '../services/guardian.service';
import type { HomeworkLinkKind } from '../types';

/** A homework's optional pointer to a lesson or a topic test. */
export interface HomeworkLink {
    kind: HomeworkLinkKind;
    targetId: string | null;
    title: string | null;
}

export const NO_LINK: HomeworkLink = { kind: 'None', targetId: null, title: null };

/** Homework that is still open: not handed in yet and not past its due date. */
export function pendingHomework(items: StudentHomework[], now = new Date()): StudentHomework[] {
    return items.filter(i => !i.submission && new Date(i.homework.dueDate) >= now);
}

/** Homework past its due date with nothing handed in. */
export function missedHomework(items: StudentHomework[], now = new Date()): StudentHomework[] {
    return items.filter(i => !i.submission && new Date(i.homework.dueDate) < now);
}
