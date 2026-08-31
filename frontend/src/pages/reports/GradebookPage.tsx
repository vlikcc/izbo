import React, { useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { classroomService } from '../../services/classroom.service';
import { examService } from '../../services/exam.service';
import { homeworkService } from '../../services/homework.service';
import { toast } from '../../lib/toast';
import type { Classroom, Exam, Homework, Submission, ExamSession } from '../../types';

interface GradeRow {
    studentId: string;
    studentName: string;
    scores: Record<string, string>;
}

function csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
}

export const GradebookPage: React.FC = () => {
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [classroomId, setClassroomId] = useState('');
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [rows, setRows] = useState<GradeRow[]>([]);

    useEffect(() => {
        void classroomService.getMyClassrooms(1, 100)
            .then((result) => setClassrooms(result.items))
            .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Sınıflar yüklenemedi'));
    }, []);

    useEffect(() => {
        if (!classroomId) {
            return;
        }

        let cancelled = false;
        const load = async () => {
            try {
                const [hw, ex] = await Promise.all([
                    homeworkService.getHomeworks(classroomId, 1, 100),
                    examService.getExams(classroomId, 1, 100),
                ]);
                if (cancelled) return;
                setHomeworks(hw.items);
                setExams(ex.items);

                const [hwSubs, examSessions] = await Promise.all([
                    Promise.all(hw.items.map(async (item) => {
                        const submissions = await homeworkService.getSubmissions(item.id).catch(() => [] as Submission[]);
                        return { homeworkId: item.id, submissions };
                    })),
                    Promise.all(ex.items.map(async (item) => {
                        const sessions = await examService.getExamSessions(item.id).catch(() => [] as ExamSession[]);
                        return { examId: item.id, sessions };
                    })),
                ]);

                const byStudent = new Map<string, GradeRow>();
                const ensure = (studentId: string, studentName: string) => {
                    const existing = byStudent.get(studentId);
                    if (existing) return existing;
                    const created: GradeRow = { studentId, studentName, scores: {} };
                    byStudent.set(studentId, created);
                    return created;
                };

                for (const group of hwSubs) {
                    for (const submission of group.submissions) {
                        const row = ensure(submission.studentId, submission.studentName || submission.studentId);
                        row.scores[`hw:${group.homeworkId}`] = submission.score?.toString() ?? submission.status;
                    }
                }
                for (const group of examSessions) {
                    for (const session of group.sessions) {
                        const row = ensure(session.studentId, session.studentName || session.studentId);
                        row.scores[`ex:${group.examId}`] = session.totalScore?.toString() ?? session.status;
                    }
                }

                if (!cancelled) setRows([...byStudent.values()]);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Not defteri yüklenemedi');
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [classroomId]);

    const columns = [
        ...homeworks.map((item) => ({ key: `hw:${item.id}`, label: item.title })),
        ...exams.map((item) => ({ key: `ex:${item.id}`, label: item.title })),
    ];

    const exportCsv = () => {
        const header = ['Öğrenci', ...columns.map((column) => column.label)];
        const body = rows.map((row) => [
            row.studentName,
            ...columns.map((column) => row.scores[column.key] ?? ''),
        ]);
        const csv = [header, ...body].map((line) => line.map((cell) => csvEscape(cell)).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'not-defteri.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">Not defteri</h1>
                    <p className="page-subtitle">Sınıf bazlı ödev ve sınav notları</p>
                </div>
                <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>CSV indir</Button>
            </div>

            <label htmlFor="gradebook-classroom">Sınıf</label>
            <select
                id="gradebook-classroom"
                value={classroomId}
                onChange={(event) => setClassroomId(event.target.value)}
            >
                <option value="">Seçin</option>
                {classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
                ))}
            </select>

            {classroomId && (
                <Card variant="default" padding="md" style={{ overflowX: 'auto', marginTop: 16 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Öğrenci</th>
                                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.studentId}>
                                    <td>{row.studentName}</td>
                                    {columns.map((column) => <td key={column.key}>{row.scores[column.key] ?? '—'}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 && <p>Bu sınıfta henüz not yok.</p>}
                </Card>
            )}
        </div>
    );
};

export default GradebookPage;
