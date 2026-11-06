import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import guardianService from '../../services/guardian.service';
import type { Child } from '../../types';
import { ChildSummaryCard } from './ChildSummaryCard';
import './Parent.css';

/** The parent's home: one card per linked child with their week at a glance. */
export const ParentDashboard: React.FC = () => {
    const [children, setChildren] = useState<Child[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        guardianService.getChildren()
            .then(setChildren)
            .catch((e: unknown) => {
                setError(e instanceof Error ? e.message : 'Çocuk hesapları yüklenemedi');
                setChildren([]);
            });
    }, []);

    if (children === null) {
        return <p className="child-muted">Yükleniyor...</p>;
    }

    if (children.length === 0) {
        return (
            <Card variant="default" padding="lg" className="children-empty">
                <span style={{ fontSize: '2.5rem' }} aria-hidden="true">👨‍👩‍👧</span>
                <h3>Çocuğunuzu ekleyerek başlayın</h3>
                <p className="child-muted">
                    {error || 'Çocuğunuza bir hesap açın ya da kendi hesabını veli koduyla bağlayın; derslerini, ödevlerini ve sınav sonuçlarını buradan takip edin.'}
                </p>
                <Link to="/app/children"><Button variant="primary">Çocuklarım</Button></Link>
            </Card>
        );
    }

    return (
        <div className="children-grid">
            {children.map(child => <ChildSummaryCard key={child.id} child={child} />)}
        </div>
    );
};

export default ParentDashboard;
