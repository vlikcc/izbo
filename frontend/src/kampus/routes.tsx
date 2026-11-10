// YZ Kampüs yolları (prototipte js/app.js ROUTES; hash yerine gerçek adresler).
// Sayfalar ayrı parçalarda yüklenir; eski uygulama /app altında aynen çalışmaya devam eder.
/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react';
import { Navigate, Route, useParams } from 'react-router-dom';

const KampusSiteLayout = lazy(() => import('./KampusLayout').then((m) => ({ default: m.KampusSiteLayout })));
const KampusBareLayout = lazy(() => import('./KampusLayout').then((m) => ({ default: m.KampusBareLayout })));
const Titled = lazy(() => import('./KampusLayout').then((m) => ({ default: m.Titled })));
const RequireRole = lazy(() => import('./KampusLayout').then((m) => ({ default: m.RequireRole })));

const pub = () => import('./pages/public');
const adult = () => import('./pages/adult');
const stu = () => import('./pages/student');
const stu2 = () => import('./pages/student/more');

const HomePage = lazy(() => pub().then((m) => ({ default: m.HomePage })));
const GradePage = lazy(() => pub().then((m) => ({ default: m.GradePage })));
const SampleListPage = lazy(() => pub().then((m) => ({ default: m.SampleListPage })));
const SamplePlayPage = lazy(() => pub().then((m) => ({ default: m.SamplePlayPage })));
const ParentsPage = lazy(() => pub().then((m) => ({ default: m.ParentsPage })));
const TeachersPage = lazy(() => pub().then((m) => ({ default: m.TeachersPage })));
const SchoolsPage = lazy(() => pub().then((m) => ({ default: m.SchoolsPage })));
const PackagesPage = lazy(() => pub().then((m) => ({ default: m.PackagesPage })));
const CharactersPage = lazy(() => pub().then((m) => ({ default: m.CharactersPage })));
const StubPage = lazy(() => pub().then((m) => ({ default: m.StubPage })));
const LoginPage = lazy(() => pub().then((m) => ({ default: m.LoginPage })));
const ForgotPage = lazy(() => pub().then((m) => ({ default: m.ForgotPage })));
const AccountPage = lazy(() => pub().then((m) => ({ default: m.AccountPage })));

const TeacherHomePage = lazy(() => adult().then((m) => ({ default: m.TeacherHomePage })));
const AssignFormPage = lazy(() => adult().then((m) => ({ default: m.AssignFormPage })));
const AssignmentResultsPage = lazy(() => adult().then((m) => ({ default: m.AssignmentResultsPage })));
const ProcessFormPage = lazy(() => adult().then((m) => ({ default: m.ProcessFormPage })));
const ProcessResultsPage = lazy(() => adult().then((m) => ({ default: m.ProcessResultsPage })));
const ParentHomePage = lazy(() => adult().then((m) => ({ default: m.ParentHomePage })));

const StudentHomePage = lazy(() => stu().then((m) => ({ default: m.StudentHomePage })));
const LessonsPage = lazy(() => stu().then((m) => ({ default: m.LessonsPage })));
const CoursePage = lazy(() => stu().then((m) => ({ default: m.CoursePage })));
const PlayPage = lazy(() => stu().then((m) => ({ default: m.PlayPage })));
const HomeworkPage = lazy(() => stu().then((m) => ({ default: m.HomeworkPage })));
const ExamsPage = lazy(() => stu().then((m) => ({ default: m.ExamsPage })));
const ExamDetailPage = lazy(() => stu().then((m) => ({ default: m.ExamDetailPage })));
const AssessPlayPage = lazy(() => stu().then((m) => ({ default: m.AssessPlayPage })));
const LibraryPage = lazy(() => stu2().then((m) => ({ default: m.LibraryPage })));
const GamesPage = lazy(() => stu2().then((m) => ({ default: m.GamesPage })));
const KupaPage = lazy(() => stu2().then((m) => ({ default: m.KupaPage })));
const ProfilePage = lazy(() => stu2().then((m) => ({ default: m.ProfilePage })));
const AvatarEditPage = lazy(() => stu2().then((m) => ({ default: m.AvatarEditPage })));

/** /sinif/1–4 YZ Kampüs sınıf sayfasıdır; eski seviye adresleri (/sinif/5-sinif) /seviye/… altına taşındı. */
function GradeRoute() {
    const { n = '' } = useParams();
    if (!/^[1-4]$/.test(n)) return <Navigate to={`/seviye/${n}`} replace />;
    return <Titled title="Sınıf"><GradePage /></Titled>;
}

const t = (title: string, el: React.ReactNode) => <Titled title={title}>{el}</Titled>;
const ogrenci = (title: string, el: React.ReactNode) => <RequireRole role="ogrenci">{t(title, el)}</RequireRole>;
const ogretmen = (title: string, el: React.ReactNode) => <RequireRole role="ogretmen">{t(title, el)}</RequireRole>;

const STUBS: [string, string][] = [
    ['hakkimizda', 'Hakkımızda'], ['iletisim', 'İletişim'], ['sss', 'Sıkça Sorulan Sorular'],
    ['kvkk', 'KVKK Aydınlatma Metni'], ['gizlilik', 'Gizlilik Politikası'], ['cerezler', 'Çerez Politikası'],
];

export function kampusRoutes() {
    return (
        <>
            <Route element={<KampusSiteLayout />}>
                <Route path="/" element={t('Anasayfa', <HomePage />)} />
                <Route path="/sinif/:n" element={<GradeRoute />} />
                <Route path="/ornek-ders" element={t('Örnek Ders', <SampleListPage />)} />
                <Route path="/veliler" element={t('Veliler İçin', <ParentsPage />)} />
                <Route path="/ogretmenler" element={t('Öğretmenler İçin', <TeachersPage />)} />
                <Route path="/okullar" element={t('Okullar İçin', <SchoolsPage />)} />
                <Route path="/paketler" element={t('Paketler', <PackagesPage />)} />
                <Route path="/karakterler" element={t('Karakterler', <CharactersPage />)} />
                {STUBS.map(([p, title]) => <Route key={p} path={`/${p}`} element={t(title, <StubPage title={title} />)} />)}
                <Route path="/giris" element={t('Giriş', <LoginPage />)} />
                <Route path="/sifremi-unuttum" element={t('Şifremi unuttum', <ForgotPage />)} />
                <Route path="/hesabim" element={t('Hesabım', <AccountPage />)} />
                <Route path="/ogretmen" element={ogretmen('Öğretmen Panosu', <TeacherHomePage />)} />
                <Route path="/ogretmen/odev-ver" element={ogretmen('Ödev ver', <AssignFormPage />)} />
                <Route path="/ogretmen/odev/:id" element={ogretmen('Ödev Sonuçları', <AssignmentResultsPage />)} />
                <Route path="/ogretmen/degerlendirme-ata" element={ogretmen('Süreç değerlendirmesi ata', <ProcessFormPage />)} />
                <Route path="/ogretmen/degerlendirme/:id" element={ogretmen('Süreç Değerlendirme Sonuçları', <ProcessResultsPage />)} />
                <Route path="/veli" element={<RequireRole role="veli">{t('Veli Özeti', <ParentHomePage />)}</RequireRole>} />
            </Route>
            <Route element={<KampusBareLayout />}>
                <Route path="/ornek-ders/:id" element={t('Örnek Ders', <SamplePlayPage />)} />
                <Route path="/ogrenci" element={ogrenci('Ana Sayfa', <StudentHomePage />)} />
                <Route path="/ogrenci/derslerim" element={ogrenci('Derslerim', <LessonsPage />)} />
                <Route path="/ogrenci/ders/:id" element={ogrenci('Ders', <CoursePage />)} />
                <Route path="/ogrenci/konu/:id" element={ogrenci('Konu', <PlayPage />)} />
                <Route path="/ogrenci/odevlerim" element={ogrenci('Ödevlerim', <HomeworkPage />)} />
                <Route path="/ogrenci/sinavlar" element={ogrenci('Sınavlar', <ExamsPage />)} />
                <Route path="/ogrenci/sinav/:id" element={ogrenci('Değerlendirme', <ExamDetailPage />)} />
                <Route path="/ogrenci/degerlendirme/:id" element={ogrenci('Değerlendirme', <AssessPlayPage />)} />
                <Route path="/ogrenci/kutuphane" element={ogrenci('E-Kütüphane', <LibraryPage />)} />
                <Route path="/ogrenci/oyunlar" element={ogrenci('Oyunlar', <GamesPage />)} />
                <Route path="/ogrenci/kupa" element={ogrenci('Yıldız Kupası', <KupaPage />)} />
                <Route path="/ogrenci/panom" element={<Navigate to="/ogrenci/kupa" replace />} />
                <Route path="/ogrenci/ligim" element={<Navigate to="/ogrenci/kupa" replace />} />
                <Route path="/ogrenci/avatar" element={ogrenci('Avatarımı Düzenle', <AvatarEditPage />)} />
                <Route path="/ogrenci/profilim" element={ogrenci('Profilim', <ProfilePage />)} />
            </Route>
        </>
    );
}
