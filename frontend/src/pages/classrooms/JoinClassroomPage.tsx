import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import { classroomService } from '../../services/classroom.service';
import { useAuthStore } from '../../stores/authStore';
import { isStudent } from '../../utils/roles';
import { toast } from '../../lib/toast';

/**
 * Target of the link and QR code a teacher shares (`/join/ABCD2345`). A signed-in student is enrolled
 * straight away; anyone else is told why not.
 */
export const JoinClassroomPage: React.FC = () => {
    const { code = '' } = useParams();
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const attempted = useRef(false);

    useEffect(() => {
        if (!user || !isStudent(user) || !code || attempted.current) return;
        attempted.current = true;

        classroomService.joinByCode(code)
            .then(classroom => {
                toast.success(`${classroom.name} sınıfına katıldın`);
                navigate(`/app/classrooms/${classroom.id}`, { replace: true });
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Sınıfa katılınamadı'));
    }, [code, navigate, user]);

    const message = !code
        ? 'Bağlantıda sınıf kodu yok.'
        : user && !isStudent(user)
            ? 'Sınıflara kodla yalnızca öğrenci hesapları katılabilir.'
            : error;

    return (
        <div className="page" style={{ maxWidth: 480, margin: '10vh auto', padding: '0 16px' }}>
            <Card variant="default" padding="lg">
                {message ? (
                    <>
                        <h2>Sınıfa katılınamadı</h2>
                        <p>{message}</p>
                        <Link to="/app/dashboard"><Button variant="primary">Panele dön</Button></Link>
                    </>
                ) : (
                    <p>Sınıfa katılıyorsun…</p>
                )}
            </Card>
        </div>
    );
};

export default JoinClassroomPage;
