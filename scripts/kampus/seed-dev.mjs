#!/usr/bin/env node
// YZ Kampüs geliştirme verisi: öğretmen, veli, iki öğrenci (velinin açtığı çocuk hesapları), "3-A" sınıfı,
// T.C. kimlik numaraları, bir ödev, bir süreç değerlendirmesi ve (yönetici bilgisi verilirse) bir tema
// değerlendirmesi kurar. Yalnızca yerel geliştirme içindir; tekrar çalıştırılabilir (var olanı yeniden kurmaz).
//
// Gerekenler: docker compose ile çalışan backend (gateway :5050). T.C. numarası AuthService'in iç ucuyla
// atanır; compose bu servisi dışarı açmaz, bu yüzden betik gateway konteynerinin içinden çağırır
// (`docker compose exec apigateway curl ...`). Başka bir yol için AUTH_INTERNAL_URL verin.
//
//   node scripts/kampus/seed-dev.mjs
//
// Ortam değişkenleri (hepsi isteğe bağlı):
//   API_URL              gateway (varsayılan http://localhost:5050)
//   AUTH_INTERNAL_URL    AuthService'e doğrudan erişim (ör. http://localhost:5101); yoksa docker exec kullanılır
//   COMPOSE_PROJECT      docker compose proje adı (docker exec için; varsayılan klasör adı)
//   INTERNAL_API_KEY     AuthService iç anahtarı (varsayılan dev-internal-key)
//   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   tema değerlendirmesini yayımlamak için yönetici (yoksa atlanır)
//
// Test hesapları (şifre hepsinde aynı, yalnızca geliştirme):
//   Öğretmen  T.C. 10000001822  ·  Veli T.C. 10000001990  ·  Öğrenci Deniz T.C. 10000001440  ·  Öğrenci Ada T.C. 10000001754
//   Şifre: Kampus2026!   (T.C. numaraları test amaçlıdır, kontrol hanesine uygundur, gerçek kişilere ait değildir)
import { execFileSync } from 'node:child_process';

const API = (process.env.API_URL || 'http://localhost:5050').replace(/\/+$/, '');
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';
const PASSWORD = 'Kampus2026!';

const TEACHER = { email: 'ogretmen@kampus.test', firstName: 'Ayşe', lastName: 'Yılmaz', role: 'Instructor', tc: '10000001822' };
const PARENT = { email: 'veli@kampus.test', firstName: 'Selin', lastName: 'Kaya', role: 'Parent', tc: '10000001990' };
const KIDS = [
    { username: 'deniz.kaya', firstName: 'Deniz', lastName: 'Kaya', gradeLevel: 3, tc: '10000001440' },
    { username: 'ada.kaya', firstName: 'Ada', lastName: 'Kaya', gradeLevel: 3, tc: '10000001754' },
];
const CLASS_NAME = '3-A';

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function call(method, path, { token, body } = {}) {
    const res = await fetch(API + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* düz metin */ }
    return { status: res.status, ok: res.ok && (!json || json.success !== false), data: json?.data, message: json?.message || json?.title || text.slice(0, 200) };
}
function must(r, what) {
    if (!r.ok) throw new Error(`${what}: ${r.status} ${r.message}`);
    return r.data;
}

async function login(identifier, password) {
    const body = identifier.includes('@') ? { email: identifier, password } : { username: identifier, password };
    return must(await call('POST', '/api/auth/login', { body }), `giriş (${identifier})`);
}
async function ensureAdult(u) {
    let r = await call('POST', '/api/auth/login', { body: { email: u.email, password: PASSWORD } });
    if (r.status === 429) throw new Error('Giriş sınırına takıldı (5 dakikada 10 deneme). Birkaç dakika sonra tekrar çalıştırın.');
    if (!r.ok) {
        must(await call('POST', '/api/auth/register', { body: { email: u.email, password: PASSWORD, firstName: u.firstName, lastName: u.lastName, role: u.role } }), `kayıt (${u.email})`);
        r = await call('POST', '/api/auth/login', { body: { email: u.email, password: PASSWORD } });
    }
    return must(r, `giriş (${u.email})`);
}

function assignNationalId(userId, nationalId) {
    const path = `/api/internal/accounts/${userId}/national-id`;
    const body = JSON.stringify({ nationalId });
    let out;
    if (process.env.AUTH_INTERNAL_URL) {
        out = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'PUT', process.env.AUTH_INTERNAL_URL + path,
            '-H', 'Content-Type: application/json', '-H', `X-Internal-Key: ${INTERNAL_KEY}`, '-d', body]).toString();
    } else {
        const project = process.env.COMPOSE_PROJECT ? ['-p', process.env.COMPOSE_PROJECT] : [];
        out = execFileSync('docker', ['compose', ...project, 'exec', '-T', 'apigateway', 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
            '-X', 'PUT', 'http://authservice' + path, '-H', 'Content-Type: application/json', '-H', `X-Internal-Key: ${INTERNAL_KEY}`, '-d', body]).toString();
    }
    // 200 atandı, 409 numara zaten bu ya da başka hesapta (tekrar çalıştırmada beklenir)
    if (!['200', '409'].includes(out.trim())) throw new Error(`T.C. ataması (${userId}): HTTP ${out.trim()}`);
}

async function main() {
    console.log(`YZ Kampüs geliştirme verisi → ${API}`);

    const teacher = await ensureAdult(TEACHER);
    const parent = await ensureAdult(PARENT);
    assignNationalId(teacher.user.id, TEACHER.tc);
    assignNationalId(parent.user.id, PARENT.tc);

    // Çocuk hesapları velinin altında açılır (kullanıcı adı + şifre); sınıf düzeyi profilde tutulur
    const existing = must(await call('GET', '/api/users/me/children', { token: parent.accessToken }), 'çocuk listesi');
    const kids = [];
    for (const k of KIDS) {
        let child = existing.find((c) => c.username === k.username);
        if (!child) {
            child = must(await call('POST', '/api/users/me/children', { token: parent.accessToken,
                body: { firstName: k.firstName, lastName: k.lastName, username: k.username, password: PASSWORD, gradeLevel: k.gradeLevel } }), `çocuk hesabı (${k.username})`);
        }
        assignNationalId(child.id, k.tc);
        kids.push({ ...k, id: child.id });
    }

    // Öğretmenin "3-A" sınıfı; öğrenciler davet koduyla katılır
    const mine = must(await call('GET', '/api/classrooms/my-classrooms?page=1&pageSize=100', { token: teacher.accessToken }), 'sınıflar');
    let cls = (mine.items || []).find((c) => c.name === CLASS_NAME);
    if (!cls) cls = must(await call('POST', '/api/classrooms', { token: teacher.accessToken, body: { name: CLASS_NAME, description: 'YZ Kampüs örnek sınıfı' } }), 'sınıf');
    const code = cls.inviteCode || must(await call('GET', `/api/classrooms/${cls.id}`, { token: teacher.accessToken }), 'sınıf').inviteCode;
    // Girişler IP başına sınırlı (5 dakikada 10); yalnızca sınıfta olmayan öğrenciler giriş yapıp katılır
    const enrolled = new Set((must(await call('GET', `/api/classrooms/${cls.id}/enrollments`, { token: teacher.accessToken }), 'sınıf listesi') || []).map((e) => e.studentId));
    for (const k of kids.filter((x) => !enrolled.has(x.id))) {
        const s = await login(k.username, PASSWORD);
        must(await call('POST', '/api/classrooms/join', { token: s.accessToken, body: { code } }), `sınıfa katılım (${k.username})`);
    }

    // Ödev ve süreç değerlendirmesi (yalnızca yoksa)
    const asg = must(await call('GET', '/api/kampus/teacher/assignments', { token: teacher.accessToken }), 'ödevler');
    if (!asg.some((a) => a.topicId === 'k-eldeli-toplama')) {
        must(await call('POST', '/api/kampus/teacher/assignments', { token: teacher.accessToken, body: { classroomId: cls.id, topicId: 'k-eldeli-toplama', due: day(1) } }), 'ödev');
    }
    const checks = must(await call('GET', '/api/kampus/teacher/process-checks', { token: teacher.accessToken }), 'süreç değerlendirmeleri');
    if (!checks.length) {
        must(await call('POST', '/api/kampus/teacher/process-checks', { token: teacher.accessToken,
            body: { classroomId: cls.id, grade: 3, skills: ['ritmik', 'kelime', 'guvenlik'], perSkill: 2, opensAt: day(0), closesAt: day(4), title: 'Karma kontrol 1' } }), 'süreç değerlendirmesi');
    }

    // Tema değerlendirmesi yönetici yayımlar (prototipteki d-mat-t1)
    if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
        const a = await call('POST', '/api/auth/login', { body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD } });
        if (!a.ok) { console.log(`! tema değerlendirmesi atlandı: yönetici girişi ${a.status} ${a.message}`); return finish(code, kids); }
        const admin = a.data;
        const o = (...xs) => xs.map((x) => ({ v: String(x), label: String(x) }));
        const r = await call('POST', '/api/kampus/admin/exams', { token: admin.accessToken, body: {
            grade: 3, title: 'Sayılar ve Nicelikler (1)', subject: 'matematik', themeNo: 1, themeTitle: 'Sayılar ve Nicelikler (1)',
            opensAt: day(-1), closesAt: day(7), skills: ['karsilastirma', 'basamak', 'ritmik', 'tekcift'],
            questions: [
                { id: 'dt1', skill: 'karsilastirma', type: 'choice', prompt: 'Hangisi en büyük?', options: o(489, 498, 948), answer: ['948'] },
                { id: 'dt2', skill: 'karsilastirma', type: 'write', input: 'sign', prompt: 'Boşluğa <, > ya da = yaz:  726 ☐ 762', answer: ['<'] },
                { id: 'dt3', skill: 'basamak', type: 'choice', prompt: '583 sayısında 8 rakamının basamak değeri kaçtır?', options: o(8, 80, 800), answer: ['80'] },
                { id: 'dt4', skill: 'basamak', type: 'write', input: 'number', prompt: '4 yüzlük, 0 onluk ve 7 birlikten oluşan sayıyı yaz.', answer: ['407'] },
                { id: 'dt5', skill: 'ritmik', type: 'choice', prompt: '30, 36, 42, 48, ☐  Sıradaki sayı hangisi?', options: o(52, 54, 56), answer: ['54'] },
                { id: 'dt6', skill: 'ritmik', type: 'tf', prompt: '700, 600, 500, 400 dizisinde yüzer geriye sayılmıştır.', answer: ['true'] },
                { id: 'dt7', skill: 'tekcift', type: 'choice', prompt: 'Hangisi çift sayıdır?', options: o(35, 47, 58), answer: ['58'] },
                { id: 'dt8', skill: 'tekcift', type: 'tf', prompt: 'İki tek sayının toplamı çift sayıdır.', answer: ['true'] },
            ],
        } });
        console.log(r.ok ? '✓ tema değerlendirmesi yayımlandı' : `! tema değerlendirmesi: ${r.status} ${r.message}`);
    } else {
        console.log('· tema değerlendirmesi atlandı (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD verilmedi)');
    }

    finish(code, kids);
}

function finish(code, kids) {
    console.log(`✓ hazır — sınıf ${CLASS_NAME} (davet kodu ${code}), şifre ${PASSWORD}`);
    console.log(`  öğretmen T.C. ${TEACHER.tc} · veli T.C. ${PARENT.tc} · ${kids.map((k) => `${k.firstName} T.C. ${k.tc}`).join(' · ')}`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
