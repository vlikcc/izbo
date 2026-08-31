import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
    tr: {
        translation: {
            appName: 'EduPlatform',
            nav: {
                home: 'Ana Sayfa',
                classrooms: 'Sınıflar',
                exams: 'Sınavlar',
                homework: 'Ödevler',
                live: 'Canlı Ders',
                calendar: 'Takvim',
                gradebook: 'Not Defteri',
                admin: 'Yönetim',
                profile: 'Profil',
            },
            auth: {
                login: 'Giriş Yap',
                register: 'Ücretsiz Başla',
            },
            legal: {
                privacy: 'Gizlilik',
                terms: 'Kullanım Koşulları',
            },
        },
    },
    en: {
        translation: {
            appName: 'EduPlatform',
            nav: {
                home: 'Home',
                classrooms: 'Classrooms',
                exams: 'Exams',
                homework: 'Homework',
                live: 'Live class',
                calendar: 'Calendar',
                gradebook: 'Gradebook',
                admin: 'Admin',
                profile: 'Profile',
            },
            auth: {
                login: 'Log in',
                register: 'Get started',
            },
            legal: {
                privacy: 'Privacy',
                terms: 'Terms of use',
            },
        },
    },
};

void i18n.use(initReactI18next).init({
    resources,
    lng: 'tr',
    fallbackLng: 'tr',
    interpolation: { escapeValue: false },
});

export default i18n;
