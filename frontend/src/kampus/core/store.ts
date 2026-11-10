/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint @typescript-eslint/no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] -- prototipteki Store imzaları (sid, t) korunur */
// YZ Kampüs veri katmanı: sunucu API'sine (docs/kampus-api.md) bağlı.
//
// Sayfalar prototipteki gibi Store'u çizim sırasında senkron okur. Okumalar bir önbellekten gelir;
// veri henüz yoksa okuma, isteğin promise'ini fırlatır ve en yakın <Suspense> sınırı (KampusLayout)
// veri gelene kadar bekler. Yazmalar async'tir: sunucuya gider, ardından önbellekteki bütün veriler
// yenilenir (eski veri yenisi gelene kadar gösterilir) ve bileşenler yeniden çizilir.
//
// Kurallar (ödül defteri, günlük ⭐ sınırı, kupa grupları, KP harcama, puanlama, yetki) sunucudadır.
// Olay işleyicilerinde, henüz okunmamış bir veriye ihtiyaç varsa `load*` / `prefetch` kullanılır.
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { classroomService } from '../../services/classroom.service';
import { guardianService } from '../../services/guardian.service';
import type { ApiResponse, AuthResponse, User } from '../../types';
import {
    ASSESS_BANK, ASSESS_SKILLS, AVATAR_DEFAULT, CUP_THEMES, GRADES, STOP_TYPES, TOPICS, buildSeed, courseTopics, topicStops,
} from './data';
import './content';  // 3. sınıf Matematik 1. Tema konuları TOPICS'e eklenir

// ---------------------------------------------------------------------------------------------
// Önbellek ve abonelik
// ---------------------------------------------------------------------------------------------
type Entry = { load: () => Promise<any>; data?: any; has: boolean; error?: unknown; promise?: Promise<void> };
const cache = new Map<string, Entry>();
let version = 0, queued = false;
const listeners = new Set<() => void>();
function emit() {
    version++;
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; listeners.forEach((fn) => fn()); });
}
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const getVersion = () => version;

function start(key: string, e: Entry) {
    e.promise = e.load().then(
        (d) => { e.data = d; e.has = true; e.error = undefined; },
        (err) => { if (!e.has) e.error = err; },
    ).finally(() => { e.promise = undefined; if (cache.get(key) === e) emit(); });
    return e.promise;
}
/** Önbellekten okur; veri yoksa isteği başlatır ve (çizim sırasında Suspense için) promise'i fırlatır. */
function read<T = any>(key: string, load: () => Promise<T>): T {
    let e = cache.get(key);
    if (!e) { e = { load, has: false }; cache.set(key, e); start(key, e); }
    if (e.has) return e.data;
    if (e.error) throw e.error;
    throw e.promise ?? start(key, e);
}
/** Önbellekte varsa döner, yoksa undefined (istek başlatmaz). */
function peek<T = any>(key: string): T | undefined { const e = cache.get(key); return e && e.has ? e.data : undefined; }
/** Beklemeden okur: veri yoksa isteği başlatır ve undefined döner; gelince bileşenler yeniden çizilir. */
function soft<T = any>(key: string, load: () => Promise<T>): T | undefined {
    let e = cache.get(key);
    if (!e) { e = { load, has: false }; cache.set(key, e); start(key, e); }
    return e.has ? e.data : undefined;
}
/** Okumadan önce istekleri başlatır (art arda Suspense beklemesini önler). */
function warm(key: string, load: () => Promise<any>) {
    if (!cache.has(key)) { const e: Entry = { load, has: false }; cache.set(key, e); start(key, e); }
}
/** Olay işleyicileri için: veriyi yükler ve döner. */
async function fetchKey<T = any>(key: string, load: () => Promise<T>): Promise<T> {
    let e = cache.get(key);
    if (!e) { e = { load, has: false }; cache.set(key, e); }
    if (!e.has) await (e.promise ?? start(key, e));
    if (e.error && !e.has) throw e.error;
    return e.data;
}
function put(key: string, data: any, load?: () => Promise<any>) {
    const e = cache.get(key) || { load: load || (async () => data), has: false };
    e.data = data; e.has = true; e.error = undefined;
    cache.set(key, e);
    emit();
}
/** Yazmadan sonra: önbellekteki her veriyi yeniden çeker (eski veri yenisi gelene kadar kalır). */
async function refreshAll() {
    const jobs: Promise<void>[] = [];
    cache.forEach((e, key) => {
        if (!e.has && !e.error) return;  // zaten yükleniyor
        if (e.error && !e.has) { cache.delete(key); return; }
        jobs.push(e.load().then((d) => { e.data = d; }, () => { /* eski veri kalır */ }));
    });
    await Promise.all(jobs);
    emit();
}
/** Hatalı (yüklenemeyen) kayıtları siler; "Tekrar dene" için. */
function clearErrors() { cache.forEach((e, k) => { if (e.error && !e.has) cache.delete(k); }); emit(); }

// ---------------------------------------------------------------------------------------------
// HTTP yardımcıları
// ---------------------------------------------------------------------------------------------
async function unwrap<T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    const r = await p;
    if (!r.data.success) throw new Error(r.data.message || 'İşlem tamamlanamadı.');
    return r.data.data as T;
}
const get = <T = any>(url: string) => () => unwrap<T>(api.get(url));
/** 404 "yok ya da görme yetkin yok" demektir; sayfa bunu boş sonuç olarak gösterir. */
const getOrNull = <T = any>(url: string) => () => unwrap<T>(api.get(url)).catch((e) => {
    if (e?.response?.status === 404) return null as T;
    throw e;
});
const post = <T = any>(url: string, body?: any) => unwrap<T>(api.post(url, body ?? {}));
const put_ = <T = any>(url: string, body?: any) => unwrap<T>(api.put(url, body ?? {}));
async function mutate<T>(fn: () => Promise<T>, after?: (r: T) => void): Promise<T> {
    const r = await fn();
    after?.(r);
    await refreshAll();
    return r;
}

// ---------------------------------------------------------------------------------------------
// Oturum ve kullanıcı
// ---------------------------------------------------------------------------------------------
const ROLE: Record<string, string> = { Student: 'ogrenci', Parent: 'veli', Instructor: 'ogretmen', Admin: 'ogretmen', SuperAdmin: 'ogretmen' };
const fullName = (u: { firstName?: string; lastName?: string }) => `${u.firstName || ''} ${u.lastName || ''}`.trim();
const directory = new Map<string, any>();   // öğrenci kimliği → { id, name, grade, classId } (sınıf listeleri, çocuklar)

let meSrc: User | null = null, meObj: any = null;
function me(): any {
    const u = useAuthStore.getState().user;
    if (!u) return null;
    if (u === meSrc) return meObj;
    meSrc = u;
    const role = ROLE[u.role] || 'ogrenci';
    meObj = {
        id: u.id, role, name: fullName(u) || u.username || '', firstName: u.firstName, grade: u.gradeLevel ?? null,
        email: u.email, avatar: u.profileImageUrl || null, classId: '',
        // Velinin çocukları (çizim sırasında okunur; ilk okumada yüklenir)
        get children() { return role === 'veli' ? childList().map((c: any) => c.id) : []; },
    };
    return meObj;
}
/** Oturum bilgisi çözüldü mü (sayfa yenilenince profil sunucudan gelene kadar false). */
const ready = () => useAuthStore.getState().isInitialized;
const isMe = (sid: string) => { const m = me(); return !!m && m.id === sid && m.role === 'ogrenci'; };
const user = (id: string) => (me() && me().id === id ? me() : directory.get(id) || null);

// Oturum değişince (giriş, çıkış, başka kullanıcı) önbellek boşaltılır
let lastUserId: string | null | undefined;
useAuthStore.subscribe((s) => {
    const id = s.user ? s.user.id : null;
    if (id !== lastUserId) {
        lastUserId = id; cache.clear(); directory.clear();
        // Öğrencinin hemen her sayfası özet ve ilerlemeyi okur; oturum açılır açılmaz istenir
        if (s.user && s.user.role === 'Student') queueMicrotask(() => {
            warm(`${ME}/overview`, get(`${ME}/overview`));
            warm(`${ME}/progress`, get(`${ME}/progress`));
        });
    }
    emit();
});

// ---- Kimlik doğrulama: T.C. kimlik no + şifre (sunucu yeniden doğrular, kilitler) ----
const DEMO_TCS = import.meta.env.DEV ? ['12345678910'] : [];  // geliştirme sunucusu AllowDemoNumbers ile kabul eder
function validTC(v: unknown) {
    const s = String(v || '');
    if (!/^[1-9][0-9]{10}$/.test(s)) return false;
    if (DEMO_TCS.includes(s)) return true;
    const d = [...s].map(Number);
    const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
    const d11 = d.slice(0, 10).reduce((n, x) => n + x, 0) % 10;
    return ((d10 + 10) % 10) === d[9] && d11 === d[10];
}
// Şifre kuralları: platform kuralı en az 10 karakter + büyük/küçük harf + rakam (Türkçe harfler dahil)
function pwRules(pw?: string) {
    pw = pw || '';
    return [
        { ok: pw.length >= 10, text: 'En az 10 karakter' },
        { ok: /[A-ZÇĞİÖŞÜ]/.test(pw), text: 'En az bir büyük harf' },
        { ok: /[a-zçğıöşü]/.test(pw), text: 'En az bir küçük harf' },
        { ok: /[0-9]/.test(pw), text: 'En az bir rakam' },
    ];
}
async function startSession(auth: AuthResponse) {
    localStorage.setItem('accessToken', auth.accessToken);
    localStorage.setItem('refreshToken', auth.refreshToken);
    const profile = await unwrap<User>(api.get('/api/users/me')).catch(() => null);
    useAuthStore.setState({ user: { ...auth.user, ...(profile || {}) }, isAuthenticated: true, isInitialized: true, isLoading: false, error: null });
    useSubscriptionStore.getState().load();
    return me();
}
async function login(role: string, tc: string, pw: string) {
    tc = String(tc || '').replace(/\s/g, '');
    if (!validTC(tc)) throw new Error('Geçerli bir T.C. kimlik numarası gir (11 hane).');
    if (!pw) throw new Error('Şifreni gir.');
    const auth = await unwrap<AuthResponse>(api.post('/api/auth/tc-login', { nationalId: tc, password: pw, role }));
    return startSession(auth);
}
async function changePassword(u: any, oldPw: string, newPw: string, newPw2: string) {
    if (!u) throw new Error('Önce giriş yapmalısın.');
    if (pwRules(newPw).some((r) => !r.ok)) throw new Error('Yeni şifre kuralları karşılamıyor.');
    if (newPw !== newPw2) throw new Error('Yeni şifreler birbiriyle aynı değil.');
    if (newPw === oldPw) throw new Error('Yeni şifre eskisiyle aynı olamaz.');
    const auth = await unwrap<AuthResponse>(api.post('/api/auth/change-password', { currentPassword: oldPw, newPassword: newPw, newPasswordConfirm: newPw2 }));
    localStorage.setItem('accessToken', auth.accessToken);
    localStorage.setItem('refreshToken', auth.refreshToken);
}
function logout() { void useAuthStore.getState().logout(); }

// ---- Tercihler (cihaza özel; sunucuya gitmez) ----
const PREFS_KEY = 'yz-kampus:prefs';
const prefsObj: { sound: boolean; voice: boolean; navCollapsed: boolean } = (() => {
    const base = { sound: true, voice: true, navCollapsed: false };
    try { return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return base; }
})();
const prefs = () => prefsObj;
function setPref(k: string, v: any) {
    (prefsObj as any)[k] = v;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefsObj)); } catch { /* depolama yok */ }
    emit();
}

// ---------------------------------------------------------------------------------------------
// Sınıflar (ClassroomService), çocuklar (UserService)
// ---------------------------------------------------------------------------------------------
/** Sınıf düzeyi sınıf adının başındaki rakamdan okunur ("3-A", "3/B", "3. Sınıf A"); sınıf modelinde düzey alanı yok. */
const gradeFromName = (name: string): number | null => { const m = /^\s*([1-4])\b/.exec(name || ''); return m ? Number(m[1]) : null; };
const loadClasses = async () => {
    const page = await classroomService.getMyClassrooms(1, 100);
    return page.items.map((c) => ({ id: c.id, name: c.name, grade: gradeFromName(c.name), studentCount: c.studentCount }));
};
const teacherClasses = (_t?: any) => read('classes', loadClasses);
const classOf = (id: string) => teacherClasses().find((c: any) => c.id === id) || null;
const className = (id: string) => (peek<any[]>('classes') || []).find((c) => c.id === id)?.name || '';
function studentsOf(classId: string) {
    const grade = classOf(classId)?.grade ?? null, name = className(classId);
    return read(`class:${classId}:students`, async () => {
        const list = await classroomService.getEnrollments(classId);
        return list.filter((e) => e.isActive).map((e) => {
            const s = { id: e.studentId, role: 'ogrenci', name: e.studentName || 'Öğrenci', grade, classId: name };
            directory.set(s.id, s);
            return s;
        });
    });
}
function childList(): any[] {
    return read('children', async () => {
        const kids = await guardianService.getChildren();
        return kids.map((k) => {
            const c = { id: k.id, role: 'ogrenci', name: fullName(k), grade: k.gradeLevel ?? null, classId: '' };
            directory.set(c.id, c);
            return c;
        });
    });
}

// ---------------------------------------------------------------------------------------------
// Eşleme yardımcıları (sunucu yanıtı → prototipteki nesne biçimi)
// ---------------------------------------------------------------------------------------------
const ME = '/api/kampus/me';
const base = (sid: string) => (isMe(sid) ? ME : `/api/kampus/students/${sid}`);
const mapAssignment = (a: any) => a && ({ ...a, classroomId: a.classroomId, classId: className(a.classroomId), title: a.title || null });
// Değerlendirme soruları: içerik ön yüzde (ASSESS_BANK ve tema değerlendirmesi); sunucu yalnızca kimlik, tip ve metni yollar.
let seedExamQs: Map<string, any> | null = null;
function localQuestion(id: string) {
    if (!seedExamQs) {
        seedExamQs = new Map();
        for (const e of buildSeed().exams || []) for (const q of e.questions || []) seedExamQs.set(q.id, q);
    }
    return ASSESS_BANK.find((q: any) => q.id === id) || seedExamQs.get(id) || null;
}
function mapQuestion(q: any) {
    const local = localQuestion(q.id);
    if (local) return { ...local, skill: q.skill || local.skill };
    return { id: q.id, skill: q.skill, type: q.type, prompt: q.prompt, input: q.input || undefined, options: q.options || [], pairs: [] };
}
function mapExam(x: any, questions?: any[]) {
    if (!x) return null;
    return {
        id: x.id, kind: x.kind, title: x.title, subject: x.subject, grade: x.grade,
        theme: x.themeNo ? { no: x.themeNo, title: x.themeTitle } : null,
        classroomIds: x.classroomIds || [], classIds: (x.classroomIds || []).map((id: string) => className(id) || 'Sınıf'),
        assignedBy: x.assignedBy, opensAt: x.opensAt, closesAt: x.closesAt, skills: x.skills || [], createdAt: x.createdAt,
        // Listelerde yalnızca soru sayısı gelir; ekranlar `questions.length` okur
        questions: questions || Array.from({ length: x.questionCount || 0 }, () => null),
    };
}
const skillObj = (s: any) => ({ ...(ASSESS_SKILLS[s.skill] || {}), ...s, skill: s.skill });
function mapReport(r: any, e: any) {
    if (!r) return null;
    const skills = (r.skills || []).map(skillObj);
    const answers: Record<string, any> = {};
    (r.review || []).forEach((x: any) => { answers[x.id] = { given: x.given, ok: x.ok }; });
    return {
        e, st: { answers, done: true }, skills,
        strong: skills.filter((s: any) => (r.strong || []).includes(s.skill)),
        weak: skills.filter((s: any) => (r.weak || []).includes(s.skill)),
        msg: r.msg, right: r.right, total: r.total, review: r.review || [],
    };
}
const themeOf = (t: any) => (t ? CUP_THEMES.find((x: any) => x.id === t.id) || { ...CUP_THEMES[0], ...t } : CUP_THEMES[0]);

// ---------------------------------------------------------------------------------------------
// Öğrencinin özeti ve ilerlemesi
// ---------------------------------------------------------------------------------------------
const overview = () => read(`${ME}/overview`, get(`${ME}/overview`));
const progressOf = (sid: string) => read(`${base(sid)}/progress`, get(`${base(sid)}/progress`));

const stars = (sid: string) => (isMe(sid) ? overview().kp : progressOf(sid).kp) || 0;  // 💎 KP bakiyesi
const dailyQuest = (_sid: string) => overview().dailyQuest;
const starsToday = (_sid: string) => overview().starsToday;
function inProgress(_sid: string) {
    const ip = overview().inProgress;
    return ip && STOP_TYPES[ip.stopId] && TOPICS[ip.topicId] ? ip : null;
}
const stopsDone = (sid: string, topicId: string): string[] => (progressOf(sid).stops || {})[topicId] || [];
const completedSet = (sid: string) => new Set<string>(progressOf(sid).completedTopics || []);
const collectionOf = (sid: string) => progressOf(sid).collection || [];
const campusLevel = (sid: string) => progressOf(sid).campusLevel || 0;
function satellitesDone(sid: string, topicId: string) {
    const t = TOPICS[topicId]; if (!t) return false;
    const d = stopsDone(sid, topicId);
    return topicStops(t).every((x: any) => d.includes(x.id));
}
function topicComplete(sid: string, topicId: string) {
    const t = TOPICS[topicId]; if (!t) return false;
    const st = topicStops(t).map((x: any) => x.id), done = stopsDone(sid, topicId);
    return (st.length > 0 && st.every((id: string) => done.includes(id))) || completedSet(sid).has(topicId);
}
function progress(sid: string, courseId: string) {
    const ids = courseTopics(courseId), done = completedSet(sid);
    return { done: ids.filter((id: string) => done.has(id)).length, total: ids.length };
}
const subjectBadge = (sid: string, subject: string) => {
    const s = user(sid) || me(); const cid = `${s.grade}-${subject}`;
    return read(`${base(sid)}/badges/${cid}`, get(`${base(sid)}/badges/${cid}`));
};
/** Uydu kartı önizlemesi; kart açılınca istenir, gelene kadar null döner (sayfa beklemez). */
const starPreview = (_sid: string, topicId: string, stopId: string) =>
    soft(`${ME}/star-preview/${topicId}/${stopId}`, get(`${ME}/star-preview/${topicId}/${stopId}`)) || null;
const nextTopic = (_student: any) => read(`${ME}/next-topic`, get(`${ME}/next-topic`));
/** Gösterilmemiş seviye kutlaması var mı (özet daha önce okunduysa). */
const pendingLevelUp = () => peek<any>(`${ME}/overview`)?.pendingLevelUp || 0;
/** Olay işleyicileri için öğrencinin ilerlemesi. */
const loadProgress = () => fetchKey(`${ME}/progress`, get(`${ME}/progress`));
/** Seviye kutlaması bir kez gösterilir (sunucu bir kez döner). */
const takeLevelUp = async (_sid: string): Promise<number> => (await post<any>(`${ME}/level-up/take`)).level || 0;

// ---- Patika durakları ----
const starting = new Set<string>();   // StrictMode durağı iki kez açar; aynı istek bir kez gider
function startStop(sid: string, topicId: string, stopId: string) {
    const k = `${topicId}:${stopId}`;
    if (!isMe(sid) || starting.has(k) || (peek<any>(`${ME}/progress`)?.stops?.[topicId] || []).includes(stopId)) return;
    starting.add(k);
    post(`${ME}/in-progress`, { topicId, stopId }).then(() => {
        const e = cache.get(`${ME}/overview`); if (e && e.has) start(`${ME}/overview`, e);
    }, () => { /* "devam et" bilgisi kritik değil */ }).finally(() => starting.delete(k));
}
const saveStop = (_sid: string, topicId: string, stopId: string, answers?: any) =>
    mutate(() => post<any>(`${ME}/stops/${topicId}/${stopId}`, { answers: answers || {} }));
const saveAttempt = (_sid: string, topicId: string, answers: any) =>
    mutate(() => post<any>(`${ME}/attempts`, { topicId, answers: answers || {} }));

// ---- Mini test: sunucu soruyu seçer ve puanlar; cevaplar soru soru gönderilir ----
const mtKey = (topicId: string) => `${ME}/minitests/${topicId}`;
const mtState = (_sid: string, topicId: string) => read(mtKey(topicId), get(mtKey(topicId)));
const pendingAnswers = new Map<string, Promise<any>>();   // konu → sıradaki cevap isteği
async function mtNew(_sid: string, topicId: string) {
    await (pendingAnswers.get(topicId) || Promise.resolve());
    const st = await post<any>(`${mtKey(topicId)}/new`);
    put(mtKey(topicId), st, get(mtKey(topicId)));
    return st;
}
/**
 * Bir mini test cevabını gönderir. Ekran beklemesin diye önbellekteki deneme hemen ilerletilir;
 * sunucunun puanladığı durum gelince onunla değiştirilir. İstekler konu başına sırayla gider.
 */
function mtAnswer(_sid: string, topicId: string, questionId: string, given: any, okGuess = false) {
    const cur = peek<any>(mtKey(topicId));
    if (cur && !cur.answers[questionId]) {
        const idx = cur.idx + 1;
        put(mtKey(topicId), { ...cur, answers: { ...cur.answers, [questionId]: { given, ok: okGuess } }, idx, done: idx >= cur.set.length });
    }
    const prev = pendingAnswers.get(topicId) || Promise.resolve();
    const p = prev.catch(() => null).then(() => post<any>(`${mtKey(topicId)}/answers`, { questionId, given }))
        .then((r) => { put(mtKey(topicId), r.state); return r; });
    pendingAnswers.set(topicId, p);
    p.finally(() => { if (pendingAnswers.get(topicId) === p) pendingAnswers.delete(topicId); }).catch(() => null);
    return p;
}
/** Mini test bitti: durak + set ödülü + yıldızlar tek istekte. Önce bekleyen cevaplar gönderilir. */
async function mtComplete(_sid: string, topicId: string, answers?: any) {
    await (pendingAnswers.get(topicId) || Promise.resolve());
    return mutate(() => post<any>(`${mtKey(topicId)}/complete`, { answers: answers || {} }));
}

// ---- E-Kütüphane ve oyunlar ----
const books = () => read<any[]>(`${ME}/books`, get(`${ME}/books`));
const bookState = (_sid: string, id: string) => books().find((b) => b.bookId === id) || { finished: false, answers: {}, kp: 0 };
const bookKp = (sid: string, id: string) => bookState(sid, id).kp || 0;
const finishBook = (_sid: string, id: string) => mutate(() => post<any>(`${ME}/books/${id}/finish`));
/** Kitap sorusu: seçilen şık gönderilir, sunucu doğruluğu ve ödülü döner ({ ok, gain, state }). */
const answerBook = (_sid: string, id: string, questionId: string, given: string) =>
    mutate(() => post<any>(`${ME}/books/${id}/answers`, { questionId, given }));
const finishGame = (_sid: string, gameId: string, score: number) => mutate(() => post<any>(`${ME}/games/${gameId}/finish`, { score }));

// ---- Yıldız Kupası ----
function cupSummary(_sid: string) {
    const c = read(`${ME}/cup`, get(`${ME}/cup`));
    return { ...c, theme: themeOf(c.theme) };
}
const cupProgress = (_sid: string) => read(`${ME}/cup/progress`, get(`${ME}/cup/progress`));
const cupTasks = () => { const p = cupProgress(''); return { required: p.tasks, bonus: p.bonus }; };
const cupPoints = (sid: string) => cupSummary(sid).points;
const cupJoined = (sid: string) => cupSummary(sid).joined;
const cupTheme = () => cupSummary('').theme;
function cupBoard(_sid: string, week?: string) {
    const url = `${ME}/cup/board${week ? `?week=${week}` : ''}`;
    const b = read(url, get(url));
    return { ...b, rows: (b.rows || []).map((r: any, i: number) => ({ ...r, id: r.me ? me()?.id : `r${i}` })) };
}
const nickKey = `${ME}/cup/nick-choices`;
const nickChoices = (_sid: string) => read(nickKey, get(nickKey));
/** Olay işleyicilerinde takma ad seçeneklerini yükler (her açılışta tazedir). */
async function loadNickChoices() { const d = await get(nickKey)(); put(nickKey, d, get(nickKey)); return d; }
const joinCup = (_sid: string, nick?: string) => mutate(() => post<any>(`${ME}/cup/join`, { nick: nick || null }));
const cupsWon = (_sid: string) => (read<any[]>(`${ME}/cup/won`, get(`${ME}/cup/won`)) || []).map((w) => ({ ...w, theme: themeOf(w.theme || { id: w.cup }) }));

// ---- Avatar ----
const mapAvatar = (a: any) => ({
    custom: !!a.custom, cfg: { ...AVATAR_DEFAULT, ...(a.cfg || {}) }, owned: a.owned || [],
    eq: { outfit: null, acc: null, bg: null, ...(a.eq || {}) },
});
function avatarOf(sid: string) {
    if (!isMe(sid)) return mapAvatar({});
    return mapAvatar(read(`${ME}/avatar`, get(`${ME}/avatar`)));
}
const saveAvatar = (_sid: string, cfg: any, eq: any) =>
    mutate(() => put_<any>(`${ME}/avatar`, { cfg, eq }), (a) => put(`${ME}/avatar`, a)).then(mapAvatar);
const buyItem = (_sid: string, itemId: string) =>
    mutate(() => post<any>(`${ME}/avatar/items/${itemId}/buy`), (a) => put(`${ME}/avatar`, a)).then(mapAvatar);

// ---------------------------------------------------------------------------------------------
// Ödevler ve değerlendirmeler (öğrenci)
// ---------------------------------------------------------------------------------------------
function todo(_sid: string) {
    return read<any[]>(`${ME}/todo`, get(`${ME}/todo`)).map((x) => (x.kind === 'odev'
        ? { kind: 'odev', date: x.date, a: mapAssignment(x.assignment) }
        : { kind: 'sinav', date: x.date, e: mapExam(x.exam), status: x.status }));
}
const pendingAssignments = (sid: string) =>
    read<any[]>(`${base(sid)}/assignments`, get(`${base(sid)}/assignments`)).map(mapAssignment);
const doneAssignments = (sid: string) =>
    read<any[]>(`${base(sid)}/assignments?done=true`, get(`${base(sid)}/assignments?done=true`)).map(mapAssignment);
const examsOf = (_sid: string) =>
    read<any[]>(`${ME}/exams`, get(`${ME}/exams`)).map((x) => ({ e: mapExam(x.exam), status: x.status }));

const examPlay = (id: string) => read(`${ME}/exams/${id}`, getOrNull(`${ME}/exams/${id}`));
/** Değerlendirme (öğrenci: soruları ve durumu ile; öğretmen: süreç değerlendirmesi listesinden). */
function exam(id: string) {
    const m = me();
    if (m && m.role === 'ogrenci') {
        const p = examPlay(id);
        return p ? mapExam(p.exam, (p.questions || []).map(mapQuestion)) : null;
    }
    return processChecksOf(m).find((e: any) => e.id === id) || null;
}
const examState = (_sid: string, id: string) => examPlay(id)?.state || null;
const examStatus = (_sid: string, e: any) => (e ? examPlay(e.id)?.status : null);
/** Değerlendirme cevabı soru başına gönderilir; sunucu puanlar ve durumu döner ({ ok, state }). */
const examQueues = new Map<string, Promise<any>>();
function answerExam(_sid: string, examId: string, questionId: string, given: any) {
    const prev = examQueues.get(examId) || Promise.resolve();
    const p = prev.catch(() => null).then(() => post<any>(`${ME}/exams/${examId}/answers`, { questionId, given }));
    examQueues.set(examId, p);
    return p;
}
/** Son cevap gönderilince durum ve sonuçlar tazelenir. */
async function finishExam(_sid: string, examId: string) {
    await (examQueues.get(examId) || Promise.resolve());
    await refreshAll();
}
function examReport(sid: string, id: string) {
    const url = `${base(sid)}/exams/${id}/report`;
    return mapReport(read(url, getOrNull(url)), exam(id));
}

// ---------------------------------------------------------------------------------------------
// Öğretmen
// ---------------------------------------------------------------------------------------------
const T = '/api/kampus/teacher';
const assignmentsOfTeacher = (_t: any) => { teacherClasses(); return read<any[]>(`${T}/assignments`, get(`${T}/assignments`)).map(mapAssignment); };
const assignment = (id: string) => assignmentsOfTeacher(me()).find((a: any) => a.id === id) || null;
function findTopicQuestion(topic: any, qid: string) {
    return [...(topic.practice || []), ...(topic.check || []), ...(topic.exercises || []), ...(topic.testPool || [])].find((q: any) => q.id === qid);
}
/** Sunucu adları ClassroomService'ten alır, o servis ad tutmuyor; adlar sınıf listesinden (UserService) tamamlanır. */
function nameOf(classroomIds: string[], studentId: string, name?: string) {
    if (name) return name;
    for (const id of classroomIds) { try { studentsOf(id); } catch (p) { if (p instanceof Promise) throw p; } }
    return directory.get(studentId)?.name || 'Öğrenci';
}
function assignmentResults(a: any) {
    const r = read(`${T}/assignments/${a.id}/results`, getOrNull(`${T}/assignments/${a.id}/results`)) || { rows: [], questions: [], doneCount: 0, total: 0 };
    const topic = TOPICS[a.topicId];
    return {
        topic,
        rows: (r.rows || []).map((x: any) => ({ student: { id: x.studentId, name: nameOf([a.classroomId], x.studentId, x.name) }, done: x.done, completedAt: x.completedAt, wrongQs: x.wrongQs || 0, hints: x.hints || 0 })),
        questions: (r.questions || []).map((x: any) => ({ q: findTopicQuestion(topic, x.questionId) || { id: x.questionId, prompt: x.questionId }, struggled: x.struggled, total: x.total, topWrong: x.topWrong }))
            .sort((x: any, y: any) => y.struggled - x.struggled),
        doneCount: r.doneCount, total: r.total,
    };
}
const createAssignment = (_t: any, { classId, topicId, due }: { classId: string; topicId: string; due: string }) => {
    if (!TOPICS[topicId]) return Promise.reject(new Error('Konu bulunamadı.'));
    return mutate(() => post<any>(`${T}/assignments`, { classroomId: classId, topicId, due })).then(mapAssignment);
};
function createProcessCheck(_t: any, { classId, skills, perSkill, opensAt, closesAt, title }: any) {
    const grade = classOf(classId)?.grade;
    if (!grade) return Promise.reject(new Error('Sınıf düzeyi sınıf adından okunamadı. Sınıf adı rakamla başlamalı (ör. 3-A).'));
    if (!skills || !skills.length) return Promise.reject(new Error('En az bir beceri seçin.'));
    if (!opensAt || !closesAt) return Promise.reject(new Error('Açılış ve son günü seçin.'));
    if (closesAt < opensAt) return Promise.reject(new Error('Son gün, açılış gününden önce olamaz.'));
    return mutate(() => post<any>(`${T}/process-checks`, { classroomId: classId, grade, skills, perSkill, opensAt, closesAt, title: title || null }))
        .then((e) => mapExam(e));
}
const processChecksOf = (_t: any) => {
    teacherClasses();
    return read<any[]>(`${T}/process-checks`, get(`${T}/process-checks`)).map((e) => mapExam(e))
        .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};
function processCheckResults(e: any) {
    const r = read(`${T}/process-checks/${e.id}/results`, getOrNull(`${T}/process-checks/${e.id}/results`)) || { rows: [], skills: [], doneCount: 0, total: 0 };
    const ex = mapExam(r.exam) || e;
    const rows = (r.rows || []).map((x: any) => ({ student: { id: x.studentId, name: nameOf(ex.classroomIds || [], x.studentId, x.name) }, status: x.status, report: mapReport(x.report, ex) }));
    const byId = (ids: string[]) => ids.map((id) => rows.find((x: any) => x.student.id === id)?.student).filter(Boolean);
    return {
        e: ex, rows, doneCount: r.doneCount, total: r.total,
        skills: (r.skills || []).map((s: any) => ({ ...(ASSESS_SKILLS[s.skill] || {}), skill: s.skill, name: s.name, mastered: byId(s.mastered || []), repeat: byId(s.repeat || []) })),
    };
}

// ---------------------------------------------------------------------------------------------
// Veli / öğrenci özeti
// ---------------------------------------------------------------------------------------------
function childSummary(sid: string) {
    const s = read(`/api/kampus/students/${sid}/summary`, getOrNull(`/api/kampus/students/${sid}/summary`)) || {};
    return {
        completed: (s.completed || []).map((c: any) => ({ topic: TOPICS[c.topicId] || { title: c.title }, at: c.at })),
        repeat: (s.repeat || []).map((x: any) => ({ skill: x.skill, topic: TOPICS[x.topicId] || { title: x.topicId } })),
        pending: (s.pending || []).map(mapAssignment),
        light: s.light || 0,
    };
}
const light = (sid: string) => childSummary(sid).light;

/** Bir sayfanın okuyacağı verileri önceden ister (art arda bekleme olmasın). */
function prefetch(keys: { minitests?: string[]; assignmentResults?: string[]; processResults?: string[]; childSummaries?: string[]; classStudents?: string[] }) {
    (keys.classStudents || []).forEach((id) => { try { studentsOf(id); } catch { /* yükleniyor */ } });
    (keys.minitests || []).forEach((t) => warm(mtKey(t), get(mtKey(t))));
    (keys.assignmentResults || []).forEach((id) => warm(`${T}/assignments/${id}/results`, getOrNull(`${T}/assignments/${id}/results`)));
    (keys.processResults || []).forEach((id) => warm(`${T}/process-checks/${id}/results`, getOrNull(`${T}/process-checks/${id}/results`)));
    (keys.childSummaries || []).forEach((id) => warm(`/api/kampus/students/${id}/summary`, getOrNull(`/api/kampus/students/${id}/summary`)));
}

export const STORE_KEY = PREFS_KEY;
export const Store: any = {
    subscribe, getVersion, ready, clearErrors, prefetch, fetchKey,
    me, user, login, logout, validTC, pwRules, changePassword, prefs, setPref,
    classOf, studentsOf, teacherClasses, childList,
    saveAttempt, completedSet, light, nextTopic, progress,
    pendingAssignments, doneAssignments, createAssignment, assignmentsOfTeacher, assignment, assignmentResults, todo,
    childSummary, stars, dailyQuest, starsToday, starPreview,
    examsOf, exam, examState, examStatus, answerExam, finishExam, examReport,
    createProcessCheck, processChecksOf, processCheckResults,
    stopsDone, startStop, inProgress, saveStop,
    mtState, mtNew, mtAnswer, mtComplete,
    bookState, bookKp, finishBook, answerBook, finishGame,
    topicComplete, collectionOf, satellitesDone, campusLevel, takeLevelUp, pendingLevelUp, loadProgress, subjectBadge,
    cupTasks, cupProgress, cupPoints, cupJoined, joinCup, cupBoard, cupSummary, cupTheme, cupsWon, nickChoices, loadNickChoices,
    avatarOf, saveAvatar, buyItem,
    grades: () => GRADES,
};
