import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Card } from '../components/ui';

export const NotFoundPage: React.FC = () => (
    <div className="page animate-fadeIn" style={{ display: 'flex', justifyContent: 'center', paddingTop: '10vh' }}>
        <Card variant="default" padding="lg">
            <h1>Sayfa bulunamadı</h1>
            <p>Aradığınız adres taşınmış veya hiç var olmamış olabilir.</p>
            <Link to="/">
                <Button variant="primary">Ana sayfaya dön</Button>
            </Link>
        </Card>
    </div>
);

export default NotFoundPage;
