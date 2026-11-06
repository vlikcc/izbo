import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Modal } from '../../components/ui';
import { AssessmentSettingsForm } from './AssessmentSettingsForm';
import assessmentService from '../../services/assessment.service';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../utils/questions';
import type { AssessmentSummary } from '../../types/assessment';
import '../../components/content/Content.css';
import '../../components/test/Test.css';

/** /app/admin/denemeler — every mock exam and placement test; new ones start as drafts. */
export const AssessmentAdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [list, setList] = useState<AssessmentSummary[] | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        assessmentService.listAllAssessments(1, 100)
            .then(r => setList(r.items))
            .catch(e => {
                toast.error(e instanceof Error ? e.message : 'Sınavlar yüklenemedi');
                setList([]);
            });
    }, []);

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">🏆 Deneme sınavları</h1>
                    <p className="page-subtitle">Takvimli denemeler ve seviye belirleme sınavları</p>
                </div>
                <Button variant="primary" onClick={() => setCreating(true)}>Yeni sınav</Button>
            </div>

            {list === null ? <p className="content-muted">Yükleniyor...</p> : list.length === 0 ? (
                <Card variant="default" padding="lg"><p className="content-muted">Henüz sınav yok.</p></Card>
            ) : (
                <Card variant="default" padding="none">
                    <table className="content-table">
                        <thead><tr><th>Sınav</th><th>Seviye</th><th>Zaman</th><th>Soru</th><th>Durum</th><th /></tr></thead>
                        <tbody>
                            {list.map(a => (
                                <tr key={a.id}>
                                    <td><strong>{a.title}</strong><div className="content-muted">{a.kind === 'MockExam' ? 'Deneme' : 'Seviye belirleme'}</div></td>
                                    <td>{a.levelName}</td>
                                    <td>{a.windowStart && a.windowEnd ? <>{formatDateTime(a.windowStart)}<br />{formatDateTime(a.windowEnd)}</> : 'Her zaman'}</td>
                                    <td>{a.questionCount}</td>
                                    <td><span className={`badge badge-${a.status === 'Published' ? 'Published' : 'Draft'}`}>{a.status === 'Published' ? 'Yayında' : 'Taslak'}</span></td>
                                    <td><Link to={`/app/admin/denemeler/${a.id}`}><Button size="sm" variant="secondary">Aç</Button></Link></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal isOpen={creating} onClose={() => setCreating(false)} title="Yeni sınav" size="lg">
                {creating && (
                    <AssessmentSettingsForm initial={null} submitLabel="Oluştur ve soruları seç" onSubmit={async request => {
                        try {
                            const created = await assessmentService.createAssessment(request);
                            navigate(`/app/admin/denemeler/${created.summary.id}`);
                        } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Sınav oluşturulamadı');
                        }
                    }} />
                )}
            </Modal>
        </div>
    );
};

export default AssessmentAdminPage;
