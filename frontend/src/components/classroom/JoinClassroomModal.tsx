import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal } from '../ui';
import { classroomService } from '../../services/classroom.service';
import { toast } from '../../lib/toast';

interface JoinClassroomModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialCode?: string;
}

/** A student types the code their teacher shared and lands in the classroom. */
export const JoinClassroomModal: React.FC<JoinClassroomModalProps> = ({ isOpen, onClose, initialCode = '' }) => {
    const navigate = useNavigate();
    const [code, setCode] = useState(initialCode);
    const [error, setError] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const handleClose = () => {
        setError('');
        setCode(initialCode);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsJoining(true);
        try {
            const classroom = await classroomService.joinByCode(code);
            toast.success(`${classroom.name} sınıfına katıldın`);
            onClose();
            navigate(`/app/classrooms/${classroom.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sınıfa katılınamadı');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Kodla sınıfa katıl" size="sm">
            <form onSubmit={handleSubmit} className="modal-form">
                {error && <div className="auth-error" role="alert">{error}</div>}
                <Input
                    label="Sınıf kodu"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-EFGH"
                    helperText="Öğretmenin paylaştığı 8 karakterlik kod"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                />
                <div className="modal-actions">
                    <Button type="button" variant="ghost" onClick={handleClose}>Vazgeç</Button>
                    <Button type="submit" variant="primary" isLoading={isJoining}>Katıl</Button>
                </div>
            </form>
        </Modal>
    );
};

export default JoinClassroomModal;
