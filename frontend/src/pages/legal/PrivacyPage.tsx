import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui';

export const PrivacyPage: React.FC = () => (
    <div className="page animate-fadeIn" style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
        <Card variant="default" padding="lg">
            <p><Link to="/">← Ana sayfa</Link></p>
            <h1>Gizlilik Politikası</h1>
            <p>
                EduPlatform, hesap bilgilerinizi (ad, e-posta, rol) ders, ödev ve sınav kayıtlarını
                işletmek için işler. Veriler sınıf üyeliğiyle sınırlı olarak eğitmenlere gösterilir.
            </p>
            <h2>Toplanan veriler</h2>
            <ul>
                <li>Hesap: ad, e-posta, rol, isteğe bağlı telefon</li>
                <li>Öğrenim: sınıf kayıtları, ödev teslimleri, sınav cevapları ve notlar</li>
                <li>Teknik: oturum belirteçleri, IP ve tarayıcı bilgisi (güvenlik için)</li>
            </ul>
            <h2>Haklarınız</h2>
            <p>
                KVKK ve GDPR kapsamında verilerinizin bir kopyasını indirebilir veya hesabınızın
                silinmesini talep edebilirsiniz. Bu işlemler profil sayfasındaki gizlilik bölümünden yapılır.
            </p>
            <h2>Saklama</h2>
            <p>
                Aktif hesap verileri hizmet süresince tutulur. Silinen hesaplar anonimleştirilir;
                yedekler saklama politikasındaki süre sonunda budanır.
            </p>
        </Card>
    </div>
);

export default PrivacyPage;
