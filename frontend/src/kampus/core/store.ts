/* eslint-disable */
// @ts-nocheck — ilkokul-platformu prototipinden (js/store.js) olduğu gibi taşındı.
// Mantık bilerek değiştirilmedi; tipler dışa açılan adlarda gevşek (any) tutuldu.
import {
  GRADES, TOPICS, STOP_TYPES, MINITEST_SIZE, ASSESS_SKILLS, ASSESS_BANK, KP_RULES, CUP_WINNERS, CUP_GROUP_SIZE, STAR_DAILY_MAX, NICK_ADJ, NICK_NOUN, CUP_THEMES, CUP_TASK_POOL, CUP_WEEKLY_TASKS, CUP_BONUS_TASKS, BOOKS, AVATAR_DEFAULT, AVATAR_ITEMS, courseTopics, topicStops, stopContent, buildSeed
} from './data';
import './content';  // 3. sınıf Matematik 1. Tema konuları TOPICS'e eklenir (store yüklenmeden önce)

// Veri katmanı. Prototipte veriler tarayıcıda (localStorage) tutulur; fonksiyonlar sunucu
// API'sinin yerini tutar. Gerçek sistemde kimlik doğrulama ve yetki kontrolleri sunucuda yapılmalıdır.

export const STORE_KEY = 'yz-kampus:v13';

export const Store: any = (() => {
  let db;
  let memoryOnly = false;
  const DAY = 864e5;

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      db = raw ? JSON.parse(raw) : buildSeed();
      db.stops = db.stops || {}; db.stopAnswers = db.stopAnswers || {}; db.stopLog = db.stopLog || []; db.inprogress = db.inprogress || {}; db.minitest = db.minitest || {}; db.examResults = db.examResults || {}; db.collection = db.collection || {}; db.cup = db.cup || {}; db.avatars = db.avatars || {}; db.rewards = db.rewards || []; db.cupResults = db.cupResults || {}; db.books = db.books || {}; db.bookLog = db.bookLog || []; db.gameLog = db.gameLog || []; db.levelUp = db.levelUp || {};
    } catch (e) { memoryOnly = true; db = buildSeed(); }
    save();
  }
  // React tarafı (useKampus) her kayıttan sonra yeniden çizilir. Haber, çizim sırasında yapılan
  // kayıtlar (ör. settleCups) başka bir bileşeni çizim içinde güncellemesin diye mikro görevde verilir.
  let version = 0, queued = false;
  const listeners = new Set();
  function emit() {
    version++;
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; listeners.forEach(fn => fn()); });
  }
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
  const getVersion = () => version;
  function save() {
    emit();
    if (memoryOnly) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* depolama yok */ }
  }
  function reset() { db = buildSeed(); save(); }
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---- Oturum ----
  const user = id => db.users.find(u => u.id === id) || null;
  function me() { return db.session ? user(db.session.userId) : null; }
  // ---- Kimlik doğrulama: T.C. kimlik no + şifre (büyük/küçük harfe duyarlı) ----
  // T.C. kimlik no: 11 hane, ilk hane 0 olamaz, 10. ve 11. haneler kontrol hanesidir.
  const DEMO_TCS = ['12345678910']; // örnek öğrenci; gerçek sistemde kaldırılmalı
  function validTC(v) {
    const s = String(v || '');
    if (!/^[1-9][0-9]{10}$/.test(s)) return false;
    if (DEMO_TCS.includes(s)) return true;
    const d = [...s].map(Number);
    const d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
    const d11 = d.slice(0, 10).reduce((n, x) => n + x, 0) % 10;
    return ((d10 + 10) % 10) === d[9] && d11 === d[10];
  }
  // Şifre kuralları (Türkçe harfler dahil)
  function pwRules(pw) {
    pw = pw || '';
    return [
      { ok: pw.length >= 8, text: 'En az 8 karakter' },
      { ok: /[A-ZÇĞİÖŞÜ]/.test(pw), text: 'En az bir büyük harf' },
      { ok: /[a-zçğıöşü]/.test(pw), text: 'En az bir küçük harf' },
      { ok: /[0-9]/.test(pw), text: 'En az bir rakam' }
    ];
  }
  async function hashPw(tc, pw) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tc + ':' + pw));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  let failCount = 0, lockUntil = 0;
  async function login(role, tc, pw) {
    if (Date.now() < lockUntil) throw new Error(`Çok fazla hatalı deneme. ${Math.ceil((lockUntil - Date.now()) / 1000)} saniye sonra tekrar dene.`);
    tc = String(tc || '').replace(/\s/g, '');
    if (!validTC(tc)) throw new Error('Geçerli bir T.C. kimlik numarası gir (11 hane).');
    if (!pw) throw new Error('Şifreni gir.');
    const u = db.users.find(x => x.role === role && x.tc === tc);
    const ok = u && (await hashPw(tc, pw)) === u.passHash;
    if (!ok) {
      failCount++;
      if (failCount >= 5) { lockUntil = Date.now() + 30000; failCount = 0; }
      // Hangi alanın yanlış olduğu söylenmez.
      throw new Error('T.C. kimlik numarası veya şifre hatalı.');
    }
    failCount = 0;
    db.session = { userId: u.id }; save(); return u;
  }
  async function changePassword(u, oldPw, newPw, newPw2) {
    if (!u) throw new Error('Önce giriş yapmalısın.');
    if ((await hashPw(u.tc, oldPw)) !== u.passHash) throw new Error('Mevcut şifre hatalı.');
    if (pwRules(newPw).some(r => !r.ok)) throw new Error('Yeni şifre kuralları karşılamıyor.');
    if (newPw !== newPw2) throw new Error('Yeni şifreler birbiriyle aynı değil.');
    if (newPw === oldPw) throw new Error('Yeni şifre eskisiyle aynı olamaz.');
    u.passHash = await hashPw(u.tc, newPw); save();
  }
  function loginDemo(id) { db.session = { userId: id }; save(); return user(id); }
  function logout() { db.session = null; save(); }

  // ---- Tercihler ----
  const prefs = () => db.prefs;
  function setPref(k, v) { db.prefs[k] = v; save(); }

  // ---- Sınıflar ----
  const classOf = id => db.classes.find(c => c.id === id);
  const studentsOf = classId => db.users.filter(u => u.role === 'ogrenci' && u.classId === classId);
  const teacherClasses = t => db.classes.filter(c => (t.classes || []).includes(c.id));

  // ---- Denemeler ----
  const attemptsOf = sid => db.attempts.filter(a => a.studentId === sid);
  function saveAttempt(studentId, topicId, answers, award = true, viaStops = false) {
    const pending = pendingAssignments(studentId).find(a => a.topicId === topicId);
    const rec = { id: uid('t'), studentId, topicId, assignmentId: pending ? pending.id : null, completedAt: new Date().toISOString(), answers, viaStops };
    db.attempts.push(rec);
    checkDaily(studentId);
    save(); return rec;
  }

  // ---- Ödül defteri: 💎 KP (harcanabilir, birikir) ve ⭐ Kupa Yıldızı (haftalık, kupa sıralaması) ----
  // Her ödül bir kez yazılır (aynı tür + aynı kaynak).
  // 💎 KP: çalışmayı tamamlamanın ödülü (avatar için harcanır). ⭐ Kupa Yıldızı: doğru cevap başına 1 (alıştırma, mini test,
  // kitap soruları, oyun turu); bir soru bir sette yalnızca bir kez yıldız getirir. KP bakiyesi kullanıcının `stars` alanındadır.
  const addGain = (a, b) => ({ kp: a.kp + b.kp, cup: a.cup + b.cup, daily: (a.daily || 0) + (b.daily || 0), bonus: (a.bonus || 0) + (b.bonus || 0) });
  const rewarded = (sid, kind, ref) => db.rewards.some(r => r.sid === sid && r.kind === kind && r.ref === ref);
  // ⭐ günlük sınırı: bugün kazanılan yıldızlar
  const starsToday = sid => db.rewards.filter(r => r.sid === sid && new Date(r.at).toDateString() === new Date().toDateString()).reduce((n, r) => n + (r.star || 0), 0);
  const starsLeftToday = sid => Math.max(0, STAR_DAILY_MAX - starsToday(sid));
  function award(sid, kind, ref, { kp = 0, star = 0 } = {}) {
    const s = user(sid);
    star = Math.min(star, starsLeftToday(sid));  // günde en fazla 10 ⭐; KP sınırsız
    if (!s || (!kp && !star) || rewarded(sid, kind, ref)) return { kp: 0, cup: 0 };
    db.rewards.push({ sid, kind, ref, kp, star, at: new Date().toISOString() });
    s.stars = (s.stars || 0) + kp;
    return { kp, cup: star };
  }
  // Doğru cevaplanan her soru için 1 ⭐ (aynı set içinde bir kez)
  // Doğru cevaplanan her soru 1 ⭐ — bir soru öğrenciye yalnızca bir kez yıldız getirir (tekrar ⭐ vermez).
  // Günlük sınır dolduysa soru yıldızsız kalır; başka bir gün yeniden çözülünce yıldız getirebilir.
  const starredQ = (sid, topicId, qid) => rewarded(sid, 'yildiz', `${topicId}:${qid}`);
  function starForCorrect(sid, topicId, okIds) {
    const g = okIds.reduce((acc, qid) => addGain(acc, award(sid, 'yildiz', `${topicId}:${qid}`, { star: 1 })), { kp: 0, cup: 0 });
    g.repeat = okIds.length - g.cup;  // yıldız getirmeyen doğru sayısı (daha önce yıldız almış ya da günlük sınır)
    g.capped = starsLeftToday(sid) === 0;
    return g;
  }
    // Günlük görev tamamlanınca +5 KP (günde bir kez, kupa yıldızı vermez)
  function checkDaily(sid) {
    const q = dailyQuest(sid);
    // Günlük görev bonusu sonuç ekranında ayrı gösterilir (daily)
    let daily = 0, bonus = 0;
    if (q.done >= q.target) daily = award(sid, 'gunluk', new Date().toDateString(), { kp: KP_RULES.gunluk }).kp;
    // Haftanın bonus görevi tamamlanınca +5 💎 KP (haftada bir kez; kupa katılımı için gerekmez)
    if (cupProgress(sid).bonus.done) bonus = award(sid, 'bonus', weekKey(), { kp: KP_RULES.bonus }).kp;
    return { kp: 0, cup: 0, daily, bonus };
  }

  // ---- Patika durakları ----
  // db.stops[sid][topicId] = [tamamlanan durak kimlikleri]; öğrenci durakları istediği sırada çalışır.
  function stopsDone(sid, topicId) { return ((db.stops[sid] || {})[topicId]) || []; }
  function startStop(sid, topicId, stopId) {
    if (stopsDone(sid, topicId).includes(stopId)) return;
    db.inprogress[sid] = { topicId, stopId, at: new Date().toISOString() }; save();
  }
  // "Devam et" yalnızca yarım bırakılmış belirli bir etkinlik için gösterilir.
  function inProgress(sid) {
    const ip = db.inprogress[sid];
    return ip && STOP_TYPES[ip.stopId] && TOPICS[ip.topicId] && !stopsDone(sid, ip.topicId).includes(ip.stopId) ? ip : null;
  }
  function saveStop(sid, topicId, stopId, answers) {
    db.stops[sid] = db.stops[sid] || {};
    const list = db.stops[sid][topicId] = db.stops[sid][topicId] || [];
    const first = !list.includes(stopId);
    if (first) list.push(stopId);
    db.stopAnswers[sid] = db.stopAnswers[sid] || {};
    db.stopAnswers[sid][topicId] = { ...(db.stopAnswers[sid][topicId] || {}), ...answers };
    db.stopLog.push({ sid, topicId, stopId, at: new Date().toISOString() });
    if (db.inprogress[sid] && db.inprogress[sid].topicId === topicId && db.inprogress[sid].stopId === stopId) delete db.inprogress[sid];
    // Anlatım, alıştırma ve özet yalnızca ilk tamamlamada ödül verir; mini testte her yeni set ayrıca ödüllenir (mtReward)
    let gain = stopId === 'minitest' || !first ? { kp: 0, cup: 0 } : award(sid, 'durak', `${topicId}:${stopId}`, { kp: (STOP_TYPES[stopId] || {}).kp || 0 });
    // Alıştırmada ilk denemede doğru çözülen her soru 1 ⭐ (aynı soru bir kez)
    let extra = {};
    if (stopId === 'alistirma') { const sg = starForCorrect(sid, topicId, Object.entries(answers || {}).filter(([, a]) => a && a.wrong === 0).map(([id]) => id)); extra = { repeat: sg.repeat, capped: sg.capped }; gain = addGain(gain, sg); }
    const all = topicStops(TOPICS[topicId]).map(x => x.id);
    const allDone = all.every(id => list.includes(id));
    // Bütün duraklar bitince öğretmen ve veli raporları için konu kaydı oluşur (ek ödül vermeden).
    const before = campusLevel(sid);
    checkCollection(sid, topicId);
    if (allDone && first) saveAttempt(sid, topicId, db.stopAnswers[sid][topicId], false, true);
    gain = addGain(gain, checkDaily(sid));
    save();
    const after = campusLevel(sid);
    return { first, allDone, kp: gain.kp, cup: gain.cup, daily: gain.daily || 0, bonus: gain.bonus || 0, ...extra, levelUp: after > before ? after : 0 };
  }

  // ---- Mini test denemeleri ----
  // db.minitest[sid][topicId] = { attempt, set:[soru id], idx, answers:{id:{given, ok}}, done, prev:[önceki set] }
  // Yarım bırakılan deneme aynı sorularla sürer; yeni deneme bir önceki setten farklı sorular seçer.
  function mtState(sid, topicId) { return ((db.minitest[sid] || {})[topicId]) || null; }
  // Yeni deneme daha önce gösterilmemiş sorulardan kurulur; havuz bitince yeni bir tur başlar (son set yine dışarıda kalır).
  function mtNew(sid, topicId, poolIds, n) {
    const old = mtState(sid, topicId);
    const prev = old ? old.set : [];
    let shown = old ? [...new Set([...(old.shown || []), ...prev])] : [];
    const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    let fresh = poolIds.filter(id => !shown.includes(id));
    if (fresh.length < n) { shown = [...prev]; fresh = poolIds.filter(id => !prev.includes(id)); }
    const set = shuffle(fresh).slice(0, n);
    if (set.length < n) set.push(...shuffle(prev).slice(0, n - set.length));
    db.minitest[sid] = db.minitest[sid] || {};
    const st = db.minitest[sid][topicId] = { attempt: (old ? old.attempt : 0) + 1, set, idx: 0, answers: {}, done: false, prev, shown, best: old ? old.best || 0 : 0 };
    save(); return st;
  }
  // Tamamlanan her yeni mini test seti bir kez ödül verir
  function mtReward(sid, topicId, attempt) {
    const st = mtState(sid, topicId);
    const okIds = st ? Object.entries(st.answers).filter(([, a]) => a.ok).map(([id]) => id) : [];
    let g = award(sid, 'minitest', `${topicId}#${attempt}`, { kp: KP_RULES.minitest });
    const sg = starForCorrect(sid, topicId, okIds);
    g = { ...addGain(g, sg), repeat: sg.repeat, capped: sg.capped };
    g = { ...addGain(g, checkDaily(sid)), repeat: g.repeat, capped: g.capped };
    save(); return g;
  }
  function mtSave(sid, topicId, st) {
    db.minitest[sid] = db.minitest[sid] || {};
    db.minitest[sid][topicId] = st;
    if (st.done) st.best = Math.max(st.best || 0, Object.values(st.answers).filter(a => a.ok).length);
    save();
  }

  // ---- Konu tamamlama, Kampüs Seviyesi ----
  // Bir konu, patikadaki bütün durakları bitince (ya da konu baştan sona çözülünce) tamamlanmış sayılır.
  function topicComplete(sid, topicId) {
    const t = TOPICS[topicId]; if (!t) return false;
    const st = topicStops(t).map(x => x.id), done = stopsDone(sid, topicId);
    return (st.length && st.every(id => done.includes(id))) || db.attempts.some(a => a.studentId === sid && a.topicId === topicId);
  }
  // Konu Koleksiyonu ve Kampüs Seviyesi: bir konunun dört uydusu ilk kez tamamlanınca gezegeni koleksiyona eklenir
  // ve ortak Kampüs Seviyesi bir artar (hangi dersten olursa olsun). Haftalık pano yenilense de korunur.
  const collectionOf = sid => db.collection[sid] || [];
  const campusLevel = sid => collectionOf(sid).length;
  function satellitesDone(sid, topicId) {
    const t = TOPICS[topicId]; if (!t) return false;
    const d = stopsDone(sid, topicId);
    return topicStops(t).every(x => d.includes(x.id));
  }
  function checkCollection(sid, topicId) {
    if (!satellitesDone(sid, topicId) || collectionOf(sid).some(c => c.topicId === topicId)) return;
    db.collection[sid] = [...collectionOf(sid), { topicId, at: new Date().toISOString() }];
    db.levelUp[sid] = campusLevel(sid);
  }
  // Seviye atlama mesajı bir kez gösterilir
  function takeLevelUp(sid) { const n = db.levelUp[sid]; if (n) { delete db.levelUp[sid]; save(); } return n || 0; }

  // ---- Yıldız Kupası (haftalık) ----
  // Hafta pazartesi 00:00'da başlar. Her hafta yeni bir karma katılım görevi açılır; yalnızca o hafta yapılan çalışmalar sayılır.
  function weekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const weekKey = (t = Date.now()) => ymd(weekStart(t));
  const keyStart = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
  const inWeek = (iso, key) => { const t = new Date(iso).getTime(), s0 = keyStart(key); return t >= s0 && t < s0 + 7 * DAY; };
  const thisWeek = iso => new Date(iso).getTime() >= weekStart();
  // Bu haftanın görevleri: kullanılabilir görev havuzundan haftaya göre dönen üçlü (kitap ve oyun bölümleri açılınca havuza katılır)
  // Bu haftanın görevleri: 2 zorunlu (katılım için) + 1 bonus (isteğe bağlı). İlk kupa haftası 9 Kasım 2026.
  function cupTasks() {
    const wk = Math.round((weekStart() - new Date(2026, 10, 9).getTime()) / (7 * DAY));
    const pick = (arr, n) => arr[((n % arr.length) + arr.length) % arr.length];
    const second = pick(CUP_WEEKLY_TASKS, wk);
    const bonusPool = CUP_BONUS_TASKS.filter(id => id !== second);
    const byId = id => CUP_TASK_POOL.find(t => t.id === id);
    return { required: [byId('calis'), byId(second)], bonus: byId(pick(bonusPool, wk)) };
  }
  // Bu hafta yapılan çalışmalar (aynı konunun aynı durağı haftada bir kez sayılır)
  function weekWorks(sid) {
    const seen = new Map();
    db.stopLog.filter(x => x.sid === sid && thisWeek(x.at)).forEach(x => { const k = `${x.topicId}:${x.stopId}`; if (!seen.has(k)) seen.set(k, x); });
    return [...seen.values()];
  }
  function cupProgress(sid) {
    const works = weekWorks(sid);
    const wk = arr => (arr || []).filter(x => x.sid === sid && thisWeek(x.at));
    const countStop = st => st === 'kitap' ? wk(db.bookLog).filter(x => x.kind === 'tamam').length
      : st === 'oyun' ? wk(db.gameLog).length : works.filter(w => w.stopId === st).length;
    const prog = t => ({ ...t, done: Math.min(1, t.stops.reduce((n, st) => n + countStop(st), 0)), target: 1 });
    const T = cupTasks(), tasks = T.required.map(prog), bonus = prog(T.bonus);
    return { tasks, bonus, total: tasks.length, doneCount: tasks.filter(t => t.done >= t.target).length, ready: tasks.every(t => t.done >= t.target) };
  }
  // ⭐ Kupa Yıldızı: bu hafta doğru cevaplardan kazanılan yıldızların toplamı. Yeni haftada sıfırlanır.
  const cupPoints = (sid, key = weekKey()) => db.rewards.filter(r => r.sid === sid && inWeek(r.at, key)).reduce((n, r) => n + (r.star || 0), 0);
  const cupJoined = (sid, key = weekKey()) => !!((db.cup[sid] || {})[key]);
  // Haftanın kupası: CUP_THEMES listesinden haftaya göre döner (ilk kupa haftası 9 Kasım 2026)
  function cupTheme(key = weekKey()) {
    const i = Math.round((keyStart(key) - new Date(2026, 10, 9).getTime()) / (7 * DAY));
    return CUP_THEMES[((i % CUP_THEMES.length) + CUP_THEMES.length) % CUP_THEMES.length];
  }
  // Kupaya katıl: düğmeyle (otomatik değil). Öğrenci o an dolmakta olan gruba yerleşir ve grupta benzersiz bir takma ad alır.
  // Kupaya katıl: öğrencinin seçtiği (ya da otomatik) takma adla. Ad grupta benzersiz olmalı; seçilen ad hatırlanır.
  function joinCup(sid, nick) {
    if (!cupProgress(sid).ready) throw new Error('Önce bu haftanın iki görevini tamamla.');
    const key = weekKey();
    db.cup[sid] = db.cup[sid] || {};
    if (db.cup[sid][key]) return db.cup[sid][key];
    const taken = nickChoices(sid).taken;
    if (nick && (!NICK_ADJ.some(([a]) => nick.startsWith(a + ' ')) || !NICK_NOUN.some(([n]) => nick.endsWith(' ' + n)))) throw new Error('Takma ad listeden seçilmeli.');
    if (nick && taken.includes(nick)) throw new Error('Bu ad grubunda başka birinde var. Başka bir birleşim seç.');
    nick = nick || uniqueNick(sid, taken);
    db.cup[sid][key] = { at: new Date().toISOString(), nick };
    user(sid).nick = nick;   // bir sonraki katılımda hatırlanır
    save(); return db.cup[sid][key];
  }
  // ---- Gruplar (katılım sırasıyla dolar, hafta boyunca sabit) ----
  // Kupaya katılan öğrenci o an dolmakta olan gruba yerleşir; grup CUP_GROUP_SIZE (20) kişiye ulaşınca yeni grup açılır.
  // Böylece benzer zamanda katılanlar aynı grupta yarışır. Okul hesabıyla gelenler ve bireysel üyeler aynı grupta olabilir.
  const hashStr = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const prng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // Kazanan sayısı grup büyüklüğüne göre: 12+ kişi → ilk 5, 6–11 → ilk 3, 1–5 → ilk 1 (sıradaki eşitlik dahil)
  const cupWinnersFor = size => size >= 12 ? CUP_WINNERS : size >= 6 ? 3 : 1;
  // Demo katılımcılar: hafta içine yayılmış katılım zamanları ve katıldıkları andan beri topladıkları ⭐ (günde en fazla 10).
  // Aynı hafta için hep aynı liste üretilir; gerçek sistemde sunucudan gelir.
  function demoParticipants(grade, key) {
    const rnd = prng(hashStr(`${key}:${grade}`));
    const s0 = keyStart(key), now = Date.now();
    const classmates = db.users.filter(u => u.role === 'ogrenci' && u.grade === grade && u.cupDemo != null);
    const n = 106;
    return Array.from({ length: n }, (_, i) => {
      const cm = classmates[i];
      const a = Math.floor(rnd() * NICK_ADJ.length), b = Math.floor(rnd() * NICK_NOUN.length);
      const joinAt = s0 + Math.pow(rnd(), 1.6) * 6.5 * DAY;           // çoğu haftanın başında katılır
      const pace = 3 + Math.floor(rnd() * 8);                           // günde 3–10 ⭐
      const days = Math.max(0, (Math.min(now, s0 + 7 * DAY) - joinAt) / DAY);
      return { id: cm ? cm.id : `d${i}`, nick: cm ? cm.nick : `${NICK_ADJ[a][0]} ${NICK_NOUN[b][0]}`, emoji: cm ? (cm.emoji || '🙂') : NICK_NOUN[b][1],
        kind: cm ? 'okul' : (rnd() < 0.45 ? 'bireysel' : 'okul'), joinAt, points: Math.round(Math.min(days * pace, days * 10)) };
    });
  }
  // Haftanın bütün grupları (katılım sırasına göre). Yalnızca şu ana kadar katılmış olanlar görünür.
  function cupGroups(sid, key = weekKey()) {
    const me = user(sid), mine = (db.cup[sid] || {})[key];
    const list = demoParticipants(me.grade, key);
    if (mine) list.push({ id: sid, nick: mine.nick || me.nick || me.name, kind: 'okul', joinAt: new Date(mine.at).getTime(), points: cupPoints(sid, key) });
    list.sort((a, b) => a.joinAt - b.joinAt);
    const groups = [];
    list.forEach((p, i) => { const g = Math.floor(i / CUP_GROUP_SIZE); (groups[g] = groups[g] || []).push(p); });
    const until = Math.min(Date.now(), keyStart(key) + 7 * DAY);
    return groups.map(g => g.filter(p => p.joinAt <= until)).filter(g => g.length);
  }
  // Öğrencinin grubu: yalnızca kendi grubundaki takma adlar, avatarlar ve ⭐ görünür. Eşit puandakiler aynı sırayı paylaşır.
  function cupBoard(sid, key = weekKey()) {
    if (!cupJoined(sid, key)) return { rows: [], group: null, groups: 0, winners: 0 };
    const groups = cupGroups(sid, key);
    const gi = groups.findIndex(g => g.some(r => r.id === sid));
    const rows = groups[gi].map(r => ({ ...r })).sort((a, b) => b.points - a.points || a.nick.localeCompare(b.nick, 'tr'));
    const winners = cupWinnersFor(rows.length);
    rows.forEach((r, i) => { r.rank = i && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1; r.me = r.id === sid; r.winner = r.rank <= winners; });
    return { rows, group: gi + 1, groups: groups.length, winners };
  }
  // Katılırken: grupta kullanılmayan, listelerden oluşan bir takma ad
  function uniqueNick(sid, taken, fresh = false) {
    const me = user(sid);
    if (!fresh && me.nick && !taken.includes(me.nick)) return me.nick;
    const rnd = prng(hashStr(`${sid}:${Date.now()}`));
    for (let t = 0; t < 200; t++) {
      const n = `${NICK_ADJ[Math.floor(rnd() * NICK_ADJ.length)][0]} ${NICK_NOUN[Math.floor(rnd() * NICK_NOUN.length)][0]}`;
      if (!taken.includes(n)) return n;
    }
    return `${NICK_ADJ[0][0]} ${NICK_NOUN[0][0]} ${Math.floor(rnd() * 90) + 10}`;
  }
  // Katılmadan önce takma ad seçimi: öğrencinin şimdi katılırsa gireceği gruptaki adlar, hatırlanan son ad ve bir öneri
  function nickChoices(sid) {
    const key = weekKey(), me = user(sid);
    const list = demoParticipants(me.grade, key).filter(p => p.joinAt <= Date.now()).sort((a, b) => a.joinAt - b.joinAt);
    const gi = Math.floor(list.length / CUP_GROUP_SIZE);              // şimdi katılan bu gruba yerleşir
    const taken = list.slice(gi * CUP_GROUP_SIZE).map(p => p.nick)
      .concat(demoParticipants(me.grade, key).filter(p => p.joinAt > Date.now()).sort((a, b) => a.joinAt - b.joinAt)
        .slice(0, CUP_GROUP_SIZE - (list.length - gi * CUP_GROUP_SIZE) - 1).map(p => p.nick));  // gruba sonradan gelecekler de
    return { taken, last: me.nick, suggest: uniqueNick(sid, taken, true) };
  }
  // Biten haftaların sonucu: grubunda ilk 5'te (5. sıradaki eşitlik dahil) olan öğrenci o haftanın kupasını kazanır
  function settleCups(sid) {
    const joined = Object.keys(db.cup[sid] || {}).filter(k => k < weekKey());
    db.cupResults[sid] = db.cupResults[sid] || {};
    let changed = false;
    joined.forEach(k => {
      if (db.cupResults[sid][k]) return;
      const b = cupBoard(sid, k), mine = b.rows.find(r => r.me);
      db.cupResults[sid][k] = { cup: cupTheme(k).id, rank: mine ? mine.rank : null, size: b.rows.length, group: b.group, won: !!(mine && mine.winner), stars: mine ? mine.points : 0 };
      changed = true;
    });
    if (changed) save();
  }
  const cupsWon = sid => { settleCups(sid); return Object.entries(db.cupResults[sid] || {}).filter(([, r]) => r.won).map(([week, r]) => ({ week, ...r, theme: CUP_THEMES.find(t => t.id === r.cup) })).sort((a, b) => b.week.localeCompare(a.week)); };
  function cupSummary(sid) {
    settleCups(sid);
    const joined = cupJoined(sid), b = cupBoard(sid), mine = b.rows.find(r => r.me);
    return { joined, theme: cupTheme(), points: cupPoints(sid), rank: mine ? mine.rank : null, total: b.rows.length, group: b.group, groups: b.groups, winners: b.winners, inZone: !!(mine && mine.winner), progress: cupProgress(sid), today: starsToday(sid), dailyMax: STAR_DAILY_MAX, nick: joined ? (db.cup[sid][weekKey()].nick || user(sid).nick) : null };
  }

  // ---- Avatar: temel avatar + 💎 KP ile açılan parçalar ----
  // KP harcamak Kupa Yıldızı'nı ve kupa sırasını değiştirmez. Hafta yenilense de KP bakiyesi ve açılmış parçalar korunur.
  function avatarOf(sid) {
    const a = db.avatars[sid] || {};
    return { custom: !!a.custom, cfg: { ...AVATAR_DEFAULT, ...(a.cfg || {}) }, owned: a.owned || [], eq: { outfit: null, acc: null, bg: null, ...(a.eq || {}) } };
  }
  function saveAvatar(sid, cfg, eq) {
    const a = avatarOf(sid);
    Object.values(eq).forEach(id => { if (id && !a.owned.includes(id)) throw new Error('Bu parça henüz açılmadı.'); });
    db.avatars[sid] = { custom: true, cfg, owned: a.owned, eq }; save();
  }
  function buyItem(sid, itemId) {
    const it = AVATAR_ITEMS.find(x => x.id === itemId), s = user(sid), a = avatarOf(sid);
    if (!it) throw new Error('Parça bulunamadı.');
    if (a.owned.includes(itemId)) return a;
    if ((s.stars || 0) < it.price) throw new Error(`Bu parça için ${it.price - (s.stars || 0)} KP daha gerekiyor.`);
    s.stars -= it.price;
    db.avatars[sid] = { ...(db.avatars[sid] || {}), cfg: a.cfg, eq: a.eq, custom: a.custom, owned: [...a.owned, itemId] };
    save(); return avatarOf(sid);
  }

  // ---- Ders rozetleri: bir derste konunun bütün durakları bitince sayaç 1 artar, 3/3'te rozet kazanılır ----
  const BADGE_TARGET = 3;
  function subjectBadge(sid, subject) {
    const s = user(sid);
    const ids = Object.keys(TOPICS).filter(id => TOPICS[id].course === `${s.grade}-${subject}`);
    const n = ids.filter(id => { const st = topicStops(TOPICS[id]).map(x => x.id), d = stopsDone(sid, id); return st.length && st.every(x => d.includes(x)); }).length;
    return { count: Math.min(n, BADGE_TARGET), target: BADGE_TARGET, won: n >= BADGE_TARGET };
  }

  // Uydu kartı önizlemesi: bu çalışma bugün en fazla kaç ⭐ getirebilir?
  function starPreview(sid, topicId, stopId) {
    const t = TOPICS[topicId]; if (!t || (stopId !== 'alistirma' && stopId !== 'minitest')) return { max: 0, left: starsLeftToday(sid), kind: 'none' };
    const c = stopContent(t);
    const open = stopId === 'alistirma' ? c.exercises.filter(q => !starredQ(sid, topicId, q.id)).length
      : Math.min(MINITEST_SIZE, c.testPool.filter(q => !starredQ(sid, topicId, q.id)).length);
    const left = starsLeftToday(sid);
    return { max: Math.min(open, left), open, left, kind: stopId };
  }

  // ---- E-Kütüphane: kitap başına en fazla 20 KP (bitirme 5 + beş sorunun her birinde ilk doğru yanıt 3) ----
  const bookState = (sid, id) => ((db.books[sid] || {})[id]) || { finished: false, answers: {} };
  function finishBook(sid, id) {
    db.books[sid] = db.books[sid] || {};
    const st = db.books[sid][id] = { ...bookState(sid, id), finished: true };
    st.finishedAt = st.finishedAt || new Date().toISOString();
    db.bookLog.push({ sid, book: id, kind: 'bitir', at: new Date().toISOString() });
    const g = addGain(award(sid, 'kitap', id, { kp: KP_RULES.kitapBitir }), checkDaily(sid));
    save(); return g;
  }
  // Doğru yanıt ilk kez ödüllenir; yanlış yanıtta soru açık kalır, öğrenci sonra dönebilir
  function answerBook(sid, id, qid, ok) {
    db.books[sid] = db.books[sid] || {};
    const st = db.books[sid][id] = bookState(sid, id);
    const prev = st.answers[qid];
    st.answers[qid] = { ok: (prev && prev.ok) || ok, at: new Date().toISOString() };
    let g = { kp: 0, cup: 0 };
    if (ok) g = award(sid, 'kitap-soru', `${id}:${qid}`, { kp: KP_RULES.kitapSoru, star: 1 });
    const book = BOOKS.find(b => b.id === id);
    if (book && book.questions.every(q => st.answers[q.id] && st.answers[q.id].ok) && !st.completedAt) {
      st.completedAt = new Date().toISOString(); db.bookLog.push({ sid, book: id, kind: 'tamam', at: st.completedAt });
    } else if (book && book.questions.every(q => st.answers[q.id]) && !(db.bookLog.some(x => x.sid === sid && x.book === id && x.kind === 'tamam' && thisWeek(x.at)))) {
      db.bookLog.push({ sid, book: id, kind: 'tamam', at: new Date().toISOString() });
    }
    g = addGain(g, checkDaily(sid));
    save(); return g;
  }
  const bookKp = (sid, id) => db.rewards.filter(r => r.sid === sid && ((r.kind === 'kitap' && r.ref === id) || (r.kind === 'kitap-soru' && r.ref.startsWith(id + ':')))).reduce((n, r) => n + r.kp, 0);

  // ---- Oyunlar: biten her tur kayıt olur; eğitici oyun ödülü oyun başına günde bir kez ----
  // Günün ilk biten turu: +5 💎 KP ve doğru cevap başına 1 ⭐
  function finishGame(sid, gameId, score) {
    db.gameLog.push({ sid, game: gameId, score, at: new Date().toISOString() });
    const g = addGain(award(sid, 'oyun', `${gameId}:${new Date().toDateString()}`, { kp: KP_RULES.oyun, star: score }), checkDaily(sid));  // ⭐ günlük sınıra tabi
    save(); return g;
  }

  // ---- Yıldız, lig, günlük görev ----
  const stars = sid => (user(sid) || {}).stars || 0;  // 💎 KP bakiyesi
  const league = sid => (user(sid) || {}).league || { name: 'Bronz Lig', rank: 15, points: 0 };
  function dailyQuest(sid) {
    const today = new Date().toDateString();
    const done = attemptsOf(sid).filter(a => !a.viaStops && new Date(a.completedAt).toDateString() === today).length
      + db.stopLog.filter(x => x.sid === sid && new Date(x.at).toDateString() === today).length;
    const extra = (db.bookLog || []).concat(db.gameLog || []).filter(x => x.sid === sid && new Date(x.at).toDateString() === today).length;
    return { title: 'İki etkinlik tamamla', done: Math.min(done + extra, 2), target: 2, bonus: KP_RULES.gunluk };
  }
  function leagueTable(sid) {
    const me = user(sid), lg = league(sid);
    const names = ['Ece', 'Kerem', 'Nil', 'Arda', 'Mina', 'Efe', 'Lina', 'Bora', 'Su', 'Emir', 'Duru', 'Alp', 'İpek', 'Tuna', 'Defne'];
    const rows = [];
    let bot = 0;
    for (let r = 1; r <= Math.max(10, lg.rank + 2); r++) {
      if (r === lg.rank) rows.push({ rank: r, name: me.name, points: lg.points, me: true });
      else rows.push({ rank: r, name: names[bot++ % names.length], points: Math.max(0, lg.points + (lg.rank - r) * 15) });
    }
    return rows;
  }

  // ---- Sınavlar: Tema / Ünite ve Süreç değerlendirmeleri ----
  const today = () => new Date().toISOString().slice(0, 10);
  const exam = id => (db.exams || []).find(e => e.id === id);
  function examState(sid, id) { return ((db.examResults[sid] || {})[id]) || null; }
  function examStatus(sid, e) {
    const st = examState(sid, e.id);
    if (st && st.done) return 'sonuc';
    if (e.opensAt > today() || !e.questions.length) return 'yakinda';
    return st && st.idx > 0 ? 'devam' : 'acik';
  }
  function examsOf(sid) {
    const s = user(sid); if (!s) return [];
    return (db.exams || []).filter(e => e.classIds.includes(s.classId))
      .map(e => ({ e, status: examStatus(sid, e) }))
      .sort((x, y) => x.e.opensAt.localeCompare(y.e.opensAt));
  }
  function saveExam(sid, id, st) {
    db.examResults[sid] = db.examResults[sid] || {};
    db.examResults[sid][id] = st; save();
  }
  // Beceri bazlı sonuç: her beceride doğru/toplam; %75 ve üstü "yapabiliyorsun", altı "tekrar edelim".
  function examReport(sid, id) {
    const e = exam(id), st = examState(sid, id);
    if (!e || !st) return null;
    const by = {};
    e.questions.forEach(q => {
      const r = by[q.skill] = by[q.skill] || { skill: q.skill, ...ASSESS_SKILLS[q.skill], right: 0, total: 0 };
      r.total++; if (st.answers[q.id] && st.answers[q.id].ok) r.right++;
    });
    const skills = Object.values(by);
    const strong = skills.filter(x => x.right / x.total >= 0.75), weak = skills.filter(x => x.right / x.total < 0.75);
    const cap = t => t.charAt(0).toLocaleUpperCase('tr') + t.slice(1);
    let msg = strong.length ? strong.map((x, i) => i ? x.can.charAt(0).toLocaleLowerCase('tr') + x.can.slice(1) : x.can).join(', ') + '. ' : '';
    msg += weak.length ? cap(weak.map(x => x.study).join(' ve ')) + ' bir kez daha çalışalım.' : 'Harika, böyle devam!';
    const right = e.questions.filter(q => st.answers[q.id] && st.answers[q.id].ok).length;
    return { e, st, skills, strong, weak, msg, right, total: e.questions.length };
  }

  // ---- Öğretmen: süreç değerlendirmesi atama ve sonuçlar ----
  function createProcessCheck(teacher, { classId, skills, perSkill, opensAt, closesAt, title }) {
    if (!teacher || teacher.role !== 'ogretmen') throw new Error('Bu işlem için öğretmen girişi gerekir.');
    if (!(teacher.classes || []).includes(classId)) throw new Error('Bu sınıfa değerlendirme atayamazsınız.');
    const grade = classOf(classId).grade;
    if (!skills || !skills.length) throw new Error('En az bir beceri seçin.');
    if (!opensAt || !closesAt) throw new Error('Açılış ve son günü seçin.');
    if (closesAt < opensAt) throw new Error('Son gün, açılış gününden önce olamaz.');
    const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
    const questions = skills.flatMap(sk => shuffle(ASSESS_BANK.filter(q => q.grade === grade && q.skill === sk)).slice(0, perSkill));
    if (!questions.length) throw new Error('Seçilen beceriler için soru bulunamadı.');
    questions.splice(0, questions.length, ...shuffle(questions));  // dersler karışık sırayla gelsin
    const e = { id: uid('d'), kind: 'surec', classIds: [classId], subject: 'karma',
      teacherId: teacher.id, assignedBy: teacher.name, createdAt: new Date().toISOString(),
      title: title || 'Karma kontrol', opensAt, closesAt, skills, questions };
    db.exams.push(e); save(); return e;
  }
  const processChecksOf = t => (db.exams || []).filter(e => e.kind === 'surec' && e.teacherId === t.id).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  // Sınıf sonucu: her öğrencinin beceri raporu ve beceri başına "tekrar etmesi gerekenler"
  function processCheckResults(e) {
    const students = e.classIds.flatMap(studentsOf);
    const rows = students.map(s => ({ student: s, status: examStatus(s.id, e), report: examReport(s.id, e.id) }));
    const doneRows = rows.filter(r => r.status === 'sonuc');
    const skills = (e.skills || []).map(k => {
      const per = doneRows.map(r => ({ student: r.student, x: r.report.skills.find(z => z.skill === k) })).filter(z => z.x);
      return { skill: k, ...ASSESS_SKILLS[k], mastered: per.filter(z => z.x.right / z.x.total >= 0.75).map(z => z.student),
        repeat: per.filter(z => z.x.right / z.x.total < 0.75).map(z => z.student) };
    });
    return { e, rows, doneCount: doneRows.length, total: students.length, skills };
  }

  // ---- Yapılacaklar: ödev + açık ya da yaklaşan değerlendirme, en yakın tarih üstte ----
  function todo(sid) {
    const soon = new Date(Date.now() + 14 * DAY).toISOString().slice(0, 10);
    const items = [
      ...pendingAssignments(sid).map(a => ({ kind: 'odev', date: a.due, a })),
      ...examsOf(sid).filter(x => x.status === 'acik' || x.status === 'devam' || (x.status === 'yakinda' && x.e.opensAt <= soon))
        .map(x => ({ kind: 'sinav', date: x.status === 'yakinda' ? x.e.opensAt : x.e.closesAt, e: x.e, status: x.status }))
    ];
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }
  function doneAssignments(sid) {
    const s = user(sid); if (!s) return [];
    return db.assignments.filter(a => a.classId === s.classId)
      .filter(a => db.attempts.some(t => t.studentId === sid && t.topicId === a.topicId && t.completedAt >= a.createdAt));
  }
  const completedSet = sid => new Set(attemptsOf(sid).map(a => a.topicId));
  const weekly = sid => attemptsOf(sid).filter(a => Date.now() - new Date(a.completedAt) < 7 * DAY);

  // Haftalık çalışma sayısı (veli özeti için)
  function light(sid) { return Math.min(5, weekly(sid).length); }

  // Devam et: atanmış ödev > ilk tamamlanmamış konu
  function nextTopic(student) {
    const pend = pendingAssignments(student.id)[0];
    if (pend) return pend.topicId;
    const done = completedSet(student.id);
    for (const s of GRADES[student.grade]) {
      const ids = courseTopics(`${student.grade}-${s}`);
      const next = ids.find(id => !done.has(id));
      if (next) return next;
    }
    return null;
  }

  // ---- Ödevler ----
  function pendingAssignments(sid) {
    const s = user(sid); if (!s) return [];
    return db.assignments
      .filter(a => a.classId === s.classId)
      .filter(a => !db.attempts.some(t => t.studentId === sid && t.topicId === a.topicId && t.completedAt >= a.createdAt))
      .sort((a, b) => a.due.localeCompare(b.due));
  }
  function createAssignment(teacher, { classId, topicId, due }) {
    if (!teacher || teacher.role !== 'ogretmen') throw new Error('Bu işlem için öğretmen girişi gerekir.');
    if (!(teacher.classes || []).includes(classId)) throw new Error('Bu sınıfa ödev veremezsiniz.');
    if (!TOPICS[topicId]) throw new Error('Konu bulunamadı.');
    const a = { id: uid('a'), teacherId: teacher.id, classId, topicId, due, createdAt: new Date().toISOString() };
    db.assignments.push(a); save(); return a;
  }
  const assignmentsOfTeacher = t => db.assignments.filter(a => a.teacherId === t.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const assignment = id => db.assignments.find(a => a.id === id);

  function assignmentResults(a) {
    const topic = TOPICS[a.topicId];
    const students = studentsOf(a.classId);
    const rows = students.map(s => {
      const t = db.attempts.filter(x => x.studentId === s.id && x.topicId === a.topicId && x.completedAt >= a.createdAt).pop();
      if (!t) return { student: s, done: false };
      const vals = Object.values(t.answers);
      return { student: s, done: true, completedAt: t.completedAt,
        wrongQs: vals.filter(v => v.wrong > 0).length, hints: vals.reduce((n, v) => n + (v.hints || 0), 0), attempt: t };
    });
    const doneRows = rows.filter(r => r.done);
    const questions = [...topic.practice, ...topic.check].map(q => {
      const picks = {};
      let struggled = 0;
      doneRows.forEach(r => {
        const v = r.attempt.answers[q.id]; if (!v) return;
        if (v.wrong > 0) struggled++;
        (v.picks || []).forEach(p => { picks[p] = (picks[p] || 0) + 1; });
      });
      const topWrong = Object.entries(picks).sort((x, y) => y[1] - x[1])[0];
      const label = topWrong ? (q.options.find(o => o.v === topWrong[0]) || {}).label : null;
      return { q, struggled, total: doneRows.length, topWrong: label };
    }).sort((x, y) => y.struggled - x.struggled);
    return { topic, rows, questions, doneCount: doneRows.length, total: students.length };
  }

  // ---- Veli / öğrenci özeti ----
  function childSummary(sid) {
    const list = weekly(sid).slice().sort((a, b) => b.completedAt.localeCompare(a.completedAt));
    const completed = list.map(a => ({ topic: TOPICS[a.topicId], at: a.completedAt }));
    const skills = {};
    attemptsOf(sid).forEach(a => {
      const topic = TOPICS[a.topicId];
      [...(topic.practice || []), ...(topic.check || []), ...(topic.exercises || []), ...(topic.testPool || [])].forEach(q => {
        const v = a.answers[q.id]; if (!v) return;
        const weak = (v.step === 'check' && v.wrong > 0) || v.wrong >= 2;
        if (weak) skills[q.skill] = { skill: q.skill, topic };
      });
    });
    return { completed, repeat: Object.values(skills), pending: pendingAssignments(sid), light: light(sid) };
  }

  function progress(sid, courseId) {
    const ids = courseTopics(courseId), done = completedSet(sid);
    return { done: ids.filter(id => done.has(id)).length, total: ids.length };
  }

  load();
  return {
    subscribe, getVersion,
    reset, me, user, login, loginDemo, logout, validTC, pwRules, changePassword, prefs, setPref,
    classOf, studentsOf, teacherClasses, attemptsOf, saveAttempt, completedSet, light, nextTopic,
    pendingAssignments, createAssignment, assignmentsOfTeacher, assignment, assignmentResults,
    childSummary, progress, stars, league, dailyQuest, leagueTable, examsOf, exam, examState, examStatus, saveExam, examReport, createProcessCheck, processChecksOf, processCheckResults, todo, doneAssignments, stopsDone, startStop, inProgress, saveStop, mtState, mtNew, mtSave, mtReward, bookState, finishBook, answerBook, bookKp, finishGame, topicComplete, collectionOf, satellitesDone, campusLevel, takeLevelUp, cupTasks, cupProgress, cupPoints, cupJoined, joinCup, cupBoard, cupSummary, cupTheme, cupsWon, nickChoices, starPreview, starsToday, avatarOf, saveAvatar, buyItem, subjectBadge
  };
})();
