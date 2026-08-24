import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';

export const TermsPage: React.FC = () => (
    <div className="page animate-fadeIn" style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        <Card variant="default" padding="lg">
            <p><Link to="/">← Ana sayfa</Link></p>
            <h1>Kullanım Koşulları</h1>
            <p>
                EduPlatform eğitim kurumları ve eğitmenler için bir öğrenme yönetim hizmetidir.
                Hesap oluşturarak bu koşulları kabul etmiş olursunuz.
            </p>
            <h2>Hesap ve güvenlik</h2>
            <ul>
                <li>Giriş bilgilerinizi başkasıyla paylaşmayın.</li>
                <li>Sınav ve ödev içeriklerini izinsiz kopyalamayın.</li>
                <li>Platformu taciz, hile veya yetkisiz erişim için kullanmayın.</li>
            </ul>
            <h2>İçerik</h2>
            <p>
                Yüklediğiniz dosyalar ve yazdığınız metinler sizin sorumluluğunuzdadır. Eğitmenler
                sınıf içi materyali öğrencilerle paylaşabilir.
            </p>
            <h2>Hizmetin durdurulması</h2>
            <p>
                Koşulların ihlali hesabın askıya alınmasına yol açabilir. Kişisel verilerinizin
                işlenmesi gizlilik politikasına tabidir.
            </p>
        </Card>
    </div>
);

export default TermsPage;
