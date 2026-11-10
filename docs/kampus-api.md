# YZ Kampüs API sözleşmesi

Ön yüzdeki `frontend/src/kampus/core/store.ts` (prototipin `store.js`'i) verileri tarayıcıda (localStorage)
tutuyor ve fonksiyonları "sunucu API'sinin yerini tutuyor". Bu belge, o fonksiyonların yerine çağrılacak
gerçek uçları tanımlar. Kurallar (ödül defteri, günlük ⭐ sınırı, kupa grupları, KP harcama, yetki) artık
**sunucuda** uygulanır; ön yüz yalnızca gösterir.

- Taban adres: gateway (`/api/...`). Bütün `/api/kampus/*` uçları **JWT ister** (gateway'de `Bearer`).
- Zarf: her yanıt `{ success, data, message, errors }` (`ApiResponse<T>`). Hata kodları: `400` geçersiz istek /
  kural ihlali, `401` oturum yok, `403` rol/yetki yok, `404` bulunamadı **ya da görme yetkin yok** (kimlik
  taranamasın diye ikisi aynı), `409` çakışma (takma ad dolu), `429` çok fazla deneme.
- Alan adları camelCase; tarih `DateOnly` → `"2026-11-10"`, zaman → ISO 8601 UTC.
- "Gün" ve "hafta" **Türkiye saatine** göredir (UTC+3): günlük ⭐ sınırı yerel gece yarısı, kupa haftası
  pazartesi 00:00'da yenilenir. İlk kupa haftası 9 Kasım 2026.
- Öğrenci kimliği = hesap kimliği (`Guid`). Konu, durak, kitap, oyun ve avatar parçası kimlikleri ön yüzdeki
  içerik kimlikleridir (`k-dogal-karsilastirma`, `alistirma`, `kayip-kitap`, `roket-gozluk` …).

## Nerede ne var

| Alan | Servis | Not |
|---|---|---|
| T.C. Kimlik No ile giriş, şifre değiştirme | **AuthService** (`/api/auth/*`) | Mevcut e-posta/kullanıcı adı girişinin yanına eklendi |
| Sınıflar, öğrenci listesi | **ClassroomService** (mevcut) | Kampüs "sınıf" = mevcut `Classroom`; öğretmen = sınıfın sahibi |
| Veli–çocuk bağı, sınıf düzeyi | **UserService** (mevcut) | `GuardianLink`, profil `gradeLevel` |
| İlerleme, ödül defteri, Yıldız Kupası, avatar, kitap/oyun, Kampüs ödevleri, değerlendirmeler | **ContentService → Kampüs modülü** (`/api/kampus/*`) | Ayrı `KampusDbContext`, aynı veritabanı (`eduplatform_content`), kendi migration geçmişi (`__kampus_migrations`) |

Neden ContentService ve tek modül: bir durağı bitirmek aynı anda ilerlemeyi yazar, ödülü deftere işler,
günlük görevi ve kupa görevini kontrol eder. Bunlar ayrı servislerde olsaydı her durak bir dağıtık işlem
olurdu; aynı veritabanı işleminde (öğrencinin cüzdan satırı `FOR UPDATE` ile kilitli) tutmak "ödül bir kez",
"günde en fazla 10 ⭐" ve "bakiye eksiye düşmez" kurallarını eşzamanlı isteklerde de garanti eder. Modül kendi
DbContext'inde olduğu için ileride ayrı bir servise taşınabilir.

İçerik (konular, alıştırmalar, mini test havuzu, kitap soruları, beceri bankası, avatar parçaları) şimdilik ön
yüzde kalır; sunucu cevap anahtarlı bir kopyasını gömülü kaynak olarak taşır
(`src/Services/ContentService/ContentService/Kampus/Catalog/kampus-catalog.json`). İçerik değişince:

```bash
node scripts/kampus/export-catalog.mjs
```

---

## 1. Kimlik doğrulama (AuthService)

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `login(role, tc, pw)` | `POST /api/auth/tc-login` | `{ nationalId, password, role? }` — `role`: `ogrenci` \| `ogretmen` \| `veli` | `AuthResponse` `{ accessToken, refreshToken, user, expiresAt }` |
| `changePassword(u, old, new, new2)` | `POST /api/auth/change-password` 🔒 | `{ currentPassword, newPassword, newPasswordConfirm }` | `AuthResponse` (yeni oturum; diğer bütün oturumlar kapanır) |
| `logout()` | `POST /api/auth/logout` 🔒 (mevcut) | `{ refreshToken }` | `true` |
| `me()` | `GET /api/auth/me` 🔒 (mevcut), profil için `GET /api/users/me` | — | kimlik / profil (`gradeLevel` dahil) |
| `validTC(v)` | — (istemcide anlık uyarı için kalabilir) | | sunucu her girişte yeniden doğrular |
| `pwRules(pw)` | — (istemcide gösterim) | | sunucu `KampusPasswordRules` uygular — aşağıya bakın |
| `loginDemo(id)` | **yok** | | bkz. "Bilerek dışarıda bırakılanlar" |

`tc-login` cevapları:

| Durum | Kod | Mesaj |
|---|---|---|
| 11 hane değil / kontrol haneleri tutmuyor | 400 | `Geçerli bir T.C. kimlik numarası gir (11 hane).` |
| Şifre boş | 400 | `Şifreni gir.` |
| Numara kayıtlı değil, şifre yanlış, rol uyuşmuyor ya da hesap kapalı | 401 | `T.C. kimlik numarası veya şifre hatalı.` (hepsi aynı) |
| Bu numara için 5 hatalı deneme | 429 + `Retry-After` | `Çok fazla hatalı deneme. N saniye sonra tekrar dene.` |
| Sunucuda anahtarlar tanımlı değil | 503 | `T.C. kimlik numarasıyla giriş şu anda kullanılamıyor.` |

Sunucu kuralları:

- Kontrol hanesi algoritması sunucuda (`Shared.Security.TurkishNationalId`). Biçim hatası deneme sayılmaz.
- Kilit **numara başına** ve veritabanında tutulur (bütün örnekler görür): 5 ardışık hata → 300 sn kilit
  (`NationalId:MaxFailedAttempts`, `NationalId:LockoutSeconds`). Kayıtlı olmayan numara da aynı şekilde kilitlenir;
  böylece kilit, hangi numaraların kayıtlı olduğunu ele vermez. Başarılı giriş sayacı sıfırlar. Bunun üstünde uçta
  mevcut IP başına `auth-login` sınırı (5 dakikada 10) da geçerlidir.
- Şifre BCrypt ile tutulur (prototipteki SHA-256 değil); bilinmeyen numarada da sahte bir BCrypt doğrulaması
  yapılır, yanıt süresi ipucu vermez.
- **KVKK**: T.C. Kimlik No düz metin olarak hiçbir yerde saklanmaz, loglanmaz, token'a girmez. `national_id_credentials`
  tablosunda yalnızca HMAC-SHA256 arama özeti (`NationalId:LookupKey`) ve AES-256-GCM şifreli metin
  (`NationalId:EncryptionKey`) vardır. Anahtarlar prod'da `NATIONAL_ID_LOOKUP_KEY` / `NATIONAL_ID_ENCRYPTION_KEY`
  (`openssl rand -base64 32`). Anahtar boşsa uç 503 döner. Anahtar değişirse kayıtlı numaralar okunamaz.
- Şifre kuralları: platform `PasswordPolicy` (**en az 10 karakter**, yaygın şifre yasak) + prototipin kuralı
  (en az bir büyük harf, bir küçük harf, bir rakam; Türkçe harfler sayılır). Prototip "en az 8" diyordu;
  ön yüzdeki `pwRules` metni 10 olarak güncellenmeli.
- Numara atama (okul aktarımı / yönetici dizini): `PUT /api/internal/accounts/{userId}/national-id`
  `{ nationalId }` — yalnızca iç ağdan (`X-Internal-Key`), gateway geçirmez. `200` / `400` geçersiz /
  `404` hesap yok / `409` numara başka hesapta.

## 2. Öğrencinin kendi verisi — `/api/kampus/me/*` (yalnızca `Student` rolü)

Veli, öğretmen ya da yönetici bu uçlarla bir öğrenci adına ilerleme, ödül veya satın alma **oluşturamaz** (403).

### Ortak tipler

```ts
type Gain = { kp: number; cup: number; daily: number; bonus: number; repeat?: number; capped?: boolean };
// kp = 💎 Kampüs Puanı, cup = ⭐ Kupa Yıldızı, daily = günlük görev KP'si, bonus = haftalık bonus görev KP'si,
// repeat = yıldız getirmeyen doğru sayısı (daha önce yıldız almış ya da günlük sınır), capped = bugünkü 10 ⭐ doldu
type StopResult = Gain & { first: boolean; allDone: boolean; levelUp: number };
```

### Özet ve ilerleme

| Store | Uç | Yanıt `data` |
|---|---|---|
| `stars(sid)`, `campusLevel`, `starsToday`, `dailyQuest`, `inProgress` | `GET /api/kampus/me/overview` | `{ kp, campusLevel, pendingLevelUp, starsToday, starDailyMax, dailyQuest, inProgress }` |
| `dailyQuest(sid)` | `GET /api/kampus/me/daily-quest` | `{ title, done, target: 2, bonus: 5 }` |
| `stopsDone`, `topicComplete`, `satellitesDone`, `collectionOf`, `campusLevel`, `completedSet`, `progress(sid, courseId)` | `GET /api/kampus/me/progress` | `{ stops: { [topicId]: stopId[] }, collection: [{ topicId, at }], campusLevel, completedTopics: topicId[], miniTestBest: { [topicId]: n }, kp }` — `progress(courseId)` = `courseTopics(courseId)` ∩ `completedTopics` istemcide |
| `inProgress(sid)` | `GET /api/kampus/me/in-progress` | `{ topicId, stopId, at }` \| `null` |
| `startStop(sid, topicId, stopId)` | `POST /api/kampus/me/in-progress` `{ topicId, stopId }` | `true` (zaten bitmişse `false`) |
| `takeLevelUp(sid)` | `POST /api/kampus/me/level-up/take` | `{ level }` (bir kez döner, sonra `0`) |
| `subjectBadge(sid, subject)` | `GET /api/kampus/me/badges/{grade}-{subject}` (ör. `3-matematik`) | `{ courseId, count, target: 3, won }` |
| `starPreview(sid, topicId, stopId)` | `GET /api/kampus/me/star-preview/{topicId}/{stopId}` | `{ max, open, left, kind }` |
| `nextTopic(student)` | `GET /api/kampus/me/next-topic` | `topicId` \| `null` |

### Patika durakları

| Store | Uç | İstek | Yanıt |
|---|---|---|---|
| `saveStop(sid, topicId, stopId, answers)` — anlatım, alıştırma, özet, çalışma kâğıdı | `POST /api/kampus/me/stops/{topicId}/{stopId}` | `{ answers?: { [questionId]: { step, wrong, hints, picks } } }` | `StopResult` |
| `saveStop(..., 'minitest')` + `mtReward(...)` | **birleşti** → `POST /api/kampus/me/minitests/{topicId}/complete` | `{ answers? }` | `StopResult` (durak + set ödülü + yıldızlar) |

Kurallar: durak KP'si yalnızca ilk tamamlamada (anlatım 10, alıştırma 10, özet 5; çalışma kâğıdı 0).
Alıştırmada ilk denemede doğru (`wrong === 0`) her soru 1 ⭐ — bir soru öğrenciye **bir kez** yıldız getirir;
yalnızca o konunun alıştırma kimlikleri kabul edilir, bilinmeyen kimlikler atılır. Mini test durağı
`stops/.../minitest` ile tamamlanamaz (400); test bitince `complete` ile tamamlanır. Dört uydu ilk kez bitince
gezegen koleksiyona eklenir, Kampüs Seviyesi +1 (`levelUp`) ve öğretmen/veli raporları için bir konu kaydı
yazılır (ödülsüz). Her tamamlama günlük göreve (+5 KP, günde bir) ve haftalık bonus göreve (+5 KP, haftada bir)
sayılır.

### Mini test (sunucu soruyu seçer ve puanlar)

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `mtState(sid, topicId)` | `GET /api/kampus/me/minitests/{topicId}` | — | `MiniTest \| null` |
| `mtNew(sid, topicId, poolIds, n)` | `POST /api/kampus/me/minitests/{topicId}/new` | — (havuz ve `n = 5` sunucuda) | `MiniTest` |
| `mtSave(sid, topicId, st)` | `POST /api/kampus/me/minitests/{topicId}/answers` | `{ questionId, given }` | `{ ok, state: MiniTest }` |
| `mtReward(sid, topicId, attempt)` | `POST /api/kampus/me/minitests/{topicId}/complete` | `{ answers? }` | `StopResult` |

```ts
type MiniTest = { topicId; attempt; set: string[]; idx; answers: { [qid]: { given, ok } }; done; prev: string[]; best };
// given: choice → "591", tf → "true"/"false", write → "407", match → { "0": 0, "1": 1, ... }
```

Kurallar: yeni deneme daha önce gösterilmemiş sorulardan kurulur, havuz bitince yeni tur (son set yine dışarıda).
Cevaplanan soru değiştirilemez; set dışı soru 400. `complete` deneme bitmeden 400. Her yeni set bir kez
+10 KP; her doğru cevap 1 ⭐ (aynı soru bir kez, günlük sınır dahilinde).

### Konu oynatıcısı (ödev / örnek ders: İzle → Uygula → Kontrol)

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `saveAttempt(studentId, topicId, answers)` | `POST /api/kampus/me/attempts` | `{ topicId, answers: { [qid]: { step: 'practice'\|'check', wrong, hints, picks } } }` | `{ id, topicId, assignmentId, completedAt, viaStops, daily, bonus }` — bekleyen ödev varsa ona bağlanır |

### E-Kütüphane ve oyunlar

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `bookState(sid, id)`, `bookKp(sid, id)` | `GET /api/kampus/me/books` | — | `[{ bookId, finished, finishedAt, completedAt, answers: { [qid]: { ok, at } }, kp }]` |
| `finishBook(sid, id)` | `POST /api/kampus/me/books/{bookId}/finish` | — | `Gain` (ilk kez +5 KP) |
| `answerBook(sid, id, qid, ok)` | `POST /api/kampus/me/books/{bookId}/answers` | `{ questionId, given }` — **`ok` değil, seçilen şık** (`"a"`/`"b"`/`"c"`) | `{ ok, gain: Gain, state }` — ilk doğru +3 KP ve 1 ⭐; kitap başına en fazla 20 KP |
| `finishGame(sid, gameId, score)` | `POST /api/kampus/me/games/{gameId}/finish` | `{ score }` (0…tur sayısına kırpılır) | `Gain` — oyun başına günde bir kez +5 KP ve doğru başına 1 ⭐ |

### Yıldız Kupası

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `cupSummary(sid)` (+ `cupPoints`, `cupJoined`, `cupTheme`, `starsToday`) | `GET /api/kampus/me/cup` | — | `{ joined, theme: { id, name }, points, rank, total, group, groups, winners, inZone, progress, today, dailyMax, nick }` |
| `cupProgress(sid)`, `cupTasks()` | `GET /api/kampus/me/cup/progress` | — | `{ tasks: [{ id, stops, label, icon, done, target }], bonus, total, doneCount, ready }` |
| `nickChoices(sid)` | `GET /api/kampus/me/cup/nick-choices` | — | `{ taken: string[], last, suggest, adjectives, nouns }` |
| `joinCup(sid, nick)` | `POST /api/kampus/me/cup/join` | `{ nick? }` | `{ week, nick, at, group }` |
| `cupBoard(sid, key)` | `GET /api/kampus/me/cup/board?week=2026-11-09` | — | `{ week, rows: [{ nick, emoji, points, rank, me, winner }], group, groups, winners }` |
| `cupsWon(sid)` | `GET /api/kampus/me/cup/won` | — | `[{ week, cup, theme, rank, size, group, won, stars }]` |

Kurallar (sunucuda):

- Katılım düğmeyle ve haftada bir kez; önce haftanın iki zorunlu görevi (400 `Önce bu haftanın iki görevini tamamla.`).
  Tekrar katılım ilk kaydı döner.
- Gruplar **sınıf düzeyi başına**, katılım sırasıyla 20'şer kişi dolar ve hafta boyunca değişmez
  (eşzamanlı katılımlar `pg_advisory_xact_lock` ile sıraya girer).
- Takma ad yalnızca listelerden (sıfat + isim); grupta benzersiz (409 `Bu ad grubunda başka birinde var. Başka bir birleşim seç.`),
  liste dışı 400. Ad verilmezse hatırlanan ad, o doluysa rastgele boş bir birleşim. Seçilen ad hatırlanır.
- Puan = o haftanın ⭐ toplamı (katılımdan önce kazanılanlar dahil — prototiple aynı).
- Kazananlar: 12+ kişilik grupta ilk 5, 6–11 kişide ilk 3, 1–5 kişide ilk 1; eşit puan aynı sırayı paylaşır,
  sınırdaki eşitlik kazanır. Biten haftalar ilk okumada sonuçlanır (`cupsWon`, `cup`).
- Tabloda diğer çocuklar **yalnızca takma ad ve emoji** ile görünür; kimlik dönmez.
- Prototipteki 106 sanal katılımcı (`demoParticipants`) sunucuda yoktur: gruplar gerçek katılımcılardan oluşur.

### Avatar

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `avatarOf(sid)` | `GET /api/kampus/me/avatar` | — | `{ custom, cfg, owned: itemId[], eq: { outfit, acc, bg }, kp }` |
| `saveAvatar(sid, cfg, eq)` | `PUT /api/kampus/me/avatar` | `{ cfg: { skin, hair, hairColor, shirt, eyes }, eq: { outfit?, acc?, bg? } }` | aynı |
| `buyItem(sid, itemId)` | `POST /api/kampus/me/avatar/items/{itemId}/buy` | — | aynı |

Kurallar: `cfg` değerleri `AVATAR_BASE` listelerinden; `eq` parçası açılmış ve doğru yuvada olmalı (400
`Bu parça henüz açılmadı.`). Satın alma cüzdan kilidi altında: yetersiz bakiye 400 `Bu parça için N KP daha gerekiyor.`,
bakiye asla eksiye düşmez, açılmış parça ikinci kez ücretlendirilmez. KP harcamak ⭐'ı ve kupa sırasını değiştirmez.

### Ödevler ve değerlendirmeler (öğrenci)

| Store | Uç | Yanıt `data` |
|---|---|---|
| `todo(sid)` | `GET /api/kampus/me/todo` | `[{ kind: 'odev'\|'sinav', date, assignment?, exam?, status? }]` (en yakın tarih üstte) |
| `pendingAssignments(sid)` | `GET /api/kampus/me/assignments` | `[Assignment]` |
| `doneAssignments(sid)` | `GET /api/kampus/me/assignments?done=true` | `[Assignment]` |
| `examsOf(sid)`, `examStatus` | `GET /api/kampus/me/exams` | `[{ exam: Exam, status: 'acik'\|'devam'\|'yakinda'\|'sonuc' }]` |
| `exam(id)`, `examState(sid, id)` | `GET /api/kampus/me/exams/{examId}` | `{ exam, questions: [{ id, skill, type, prompt, input, options, pairs }], state, status }` — **cevap anahtarı yok**; açılmamışsa `questions: []` |
| `saveExam(sid, id, st)` | `POST /api/kampus/me/exams/{examId}/answers` `{ questionId, given }` | `{ ok, state }` — soru başına; cevap değiştirilemez; bitince `done` |
| `examReport(sid, id)` | `GET /api/kampus/me/exams/{examId}/report` | `{ examId, skills: [{ skill, name, can, study, topicId, course, right, total }], strong, weak, msg, right, total, review: [{ id, skill, prompt, given, ok, answer }] }` |

```ts
type Assignment = { id; teacherId; classroomId; topicId; title; due /* yyyy-MM-dd */; createdAt };
type Exam = { id; kind: 'tema'|'surec'; title; subject; themeNo; themeTitle; grade; classroomIds; assignedBy; opensAt; closesAt; skills; questionCount; createdAt };
```

Tema değerlendirmeleri öğrencinin **sınıf düzeyine** (UserService profilindeki `gradeLevel`) göre görünür
(`classroomIds` boşsa bütün düzey); süreç değerlendirmeleri yalnızca atandığı sınıfın öğrencilerine.

## 3. Başkasının çocuğu/öğrencisi — `/api/kampus/students/{studentId}/*`

Görebilenler: öğrencinin kendisi, **bağlı veli** (UserService `GuardianLink`), öğrencinin sınıflarından birinin
**öğretmeni** (ClassroomService), yönetici. Diğer herkes **404** alır.

| Store | Uç | Yanıt `data` |
|---|---|---|
| `childSummary(sid)` | `GET /api/kampus/students/{id}/summary` | `{ completed: [{ topicId, title, at }], repeat: [{ skill, topicId }], pending: [Assignment], light: 0–5 }` |
| `stopsDone`, `collectionOf`, `campusLevel` … (veli/öğretmen görünümü) | `GET /api/kampus/students/{id}/progress` | `me/progress` ile aynı |
| `pendingAssignments(sid)` / `doneAssignments(sid)` | `GET /api/kampus/students/{id}/assignments[?done=true]` | `[Assignment]` |
| `examReport(sid, id)` | `GET /api/kampus/students/{id}/exams/{examId}/report` | rapor |
| `subjectBadge(sid, subject)` | `GET /api/kampus/students/{id}/badges/{courseId}` | rozet |
| veli: çocuk listesi | `GET /api/users/me/children` (mevcut) | |

## 4. Öğretmen — `/api/kampus/teacher/*` (`Instructor`, `Admin`, `SuperAdmin`)

Öğretmen yalnızca **sahibi olduğu sınıflara** atama yapar ve onların sonuçlarını görür (başka sınıf: atamada 403,
okumada 404).

| Store | Uç | İstek | Yanıt `data` |
|---|---|---|---|
| `teacherClasses(t)` | `GET /api/classrooms/my-classrooms` (mevcut) | | |
| `studentsOf(classId)` | `GET /api/classrooms/{id}/enrollments` (mevcut) | | |
| `createAssignment(t, { classId, topicId, due })` | `POST /api/kampus/teacher/assignments` | `{ classroomId, topicId, due, title? }` | `Assignment` |
| `assignmentsOfTeacher(t)` | `GET /api/kampus/teacher/assignments` | | `[Assignment]` |
| `assignment(id)` + `assignmentResults(a)` | `GET /api/kampus/teacher/assignments/{id}/results` | | `{ assignment, rows: [{ studentId, name, done, completedAt, wrongQs, hints }], questions: [{ questionId, struggled, total, topWrong }], doneCount, total }` |
| `createProcessCheck(t, {...})` | `POST /api/kampus/teacher/process-checks` | `{ classroomId, grade, skills: string[], perSkill: 1–4, opensAt, closesAt, title? }` | `Exam` (sorular `ASSESS_BANK`'tan sunucuda, karışık sırayla; sınıftaki herkese aynı) |
| `processChecksOf(t)` | `GET /api/kampus/teacher/process-checks` | | `[Exam]` |
| `processCheckResults(e)` | `GET /api/kampus/teacher/process-checks/{id}/results` | | `{ exam, rows: [{ studentId, name, status, report }], doneCount, total, skills: [{ skill, name, mastered: studentId[], repeat: studentId[] }] }` |

`grade` istekte açıkça verilir, çünkü mevcut `Classroom` modelinde sınıf düzeyi yok.

## 5. Yönetici — `/api/kampus/admin/*` (`Admin`, `SuperAdmin`)

| Uç | İstek | Not |
|---|---|---|
| `POST /api/kampus/admin/exams` | `{ grade, title, subject, themeNo?, themeTitle?, opensAt, closesAt, skills, questions: [{ id, skill, type, prompt, input?, options?, answer: string[], pairs? }], classroomIds? }` | Tema / Ünite değerlendirmesini yayımlar (prototipte seed'deki `d-mat-t1`) |

## 6. Store fonksiyonu → durum tablosu

| Store fonksiyonu | Durum |
|---|---|
| `subscribe`, `getVersion` | İstemcide kalır (React yeniden çizim) |
| `prefs`, `setPref` | İstemcide kalır (ses/sesli okuma/menü tercihi, cihaza özel) |
| `reset` | Yok (yalnızca prototip) |
| `login`, `changePassword` | **Yeni** — AuthService |
| `logout`, `me`, `user` | **Mevcut** — AuthService / UserService |
| `loginDemo` | Yok (karar bekliyor, aşağıda) |
| `validTC`, `pwRules` | İstemcide gösterim + **sunucuda zorunlu** |
| `classOf`, `studentsOf`, `teacherClasses` | **Mevcut** — ClassroomService |
| `saveAttempt`, `attemptsOf`, `completedSet`, `light`, `nextTopic` | **Yeni** — Kampüs (`me/attempts`, `progress`, `summary`, `next-topic`) |
| `pendingAssignments`, `doneAssignments`, `createAssignment`, `assignmentsOfTeacher`, `assignment`, `assignmentResults`, `todo` | **Yeni** — Kampüs (HomeworkService'in dosyalı ödevinden ayrı; aşağıda) |
| `childSummary`, `progress` | **Yeni** — Kampüs (`students/{id}/summary`, `progress`) |
| `stars`, `dailyQuest`, `starsToday`, `starPreview` | **Yeni** — Kampüs ödül defteri |
| `league`, `leagueTable` | Dışarıda (prototipte sahte isimlerle doldurulan lig; yerini Yıldız Kupası aldı) |
| `examsOf`, `exam`, `examState`, `examStatus`, `saveExam`, `examReport` | **Yeni** — Kampüs (sunucu puanlar) |
| `createProcessCheck`, `processChecksOf`, `processCheckResults` | **Yeni** — Kampüs (öğretmen) |
| `stopsDone`, `startStop`, `inProgress`, `saveStop` | **Yeni** — Kampüs |
| `mtState`, `mtNew`, `mtSave`, `mtReward` | **Yeni** — Kampüs (`mtSave` → soru başına cevap; `mtReward` → `complete`) |
| `bookState`, `finishBook`, `answerBook`, `bookKp` | **Yeni** — Kampüs (`answerBook` artık `given` alır) |
| `finishGame` | **Yeni** — Kampüs |
| `topicComplete`, `collectionOf`, `satellitesDone`, `campusLevel`, `takeLevelUp`, `subjectBadge` | **Yeni** — Kampüs |
| `cupTasks`, `cupProgress`, `cupPoints`, `cupJoined`, `joinCup`, `cupBoard`, `cupSummary`, `cupTheme`, `cupsWon`, `nickChoices` | **Yeni** — Kampüs Yıldız Kupası |
| `avatarOf`, `saveAvatar`, `buyItem` | **Yeni** — Kampüs avatar |

## 7. Bilerek dışarıda bırakılanlar / bilinen sınırlar

- **Demo hesaplar ve `loginDemo`**: sunucu demo kullanıcı oluşturmaz. `12345678910` gibi kontrol hanesi tutmayan
  numaralar yalnızca `NationalId:AllowDemoNumbers=true` iken (sadece `appsettings.Development.json`) kabul edilir.
- **Lig** (`league`, `leagueTable`): prototipte sahte isimlerle üretiliyor; sunucu karşılığı yok.
- **Kampüs ödevi ≠ HomeworkService ödevi**: Kampüs ödevi "bir konuyu bitir"dir ve tamamlanması Kampüs konu
  kayıtlarından okunur; HomeworkService'in dosya/metin teslimli, notlandırılan ödevine dokunulmadı.
- **Alıştırma deneme sayısı** (`wrong`) istemciden gelir; sunucu yalnızca soru kimliklerini doğrular ve yıldızı
  bir kez / günde 10 ile sınırlar. Mini test, kitap ve değerlendirme cevapları sunucuda puanlanır.
- **Oyun skoru** istemciden gelir; tur sayısına kırpılır, ödül günde bir kez.
- Değerlendirmenin `closesAt` tarihi geçince cevap almayı kesmiyor (prototip de kesmiyordu).
- İçerik ön yüzde; sunucudaki katalog dışa aktarılan kopyadır (içerik CMS'e/soru bankasına taşınınca kaldırılmalı).
- T.C. numarasını hesaba atayacak yönetici ekranı ve okul toplu aktarımı yok; yalnızca iç uç var.

## 8. Ön yüz bağlantısı ve geliştirme verisi

- Ön yüzde `frontend/src/kampus/core/store.ts` bu uçları çağırır. Sayfalar Store'u çizim sırasında senkron okur;
  veri önbellekte yoksa okuma bekler (React Suspense), yazmalardan sonra önbellekteki veriler yenilenir.
  Mini test (`minitests/{topicId}/answers`), değerlendirme (`exams/{examId}/answers`) ve kitap soruları
  (`books/{bookId}/answers`, seçilen şık) soru soru gönderilir; puanlamayı sunucu yapar.
- **Bilinen eksik:** öğretmen sonuçlarında (`assignments/{id}/results`, `process-checks/{id}/results`) `name`
  boş gelir; ClassroomService öğrenci adı tutmuyor. Ön yüz adı sınıf listesinden (UserService) tamamlıyor;
  kalıcı çözüm `KampusDirectory`'nin adları UserService'ten okumasıdır.
- Yerel geliştirme verisi: `node scripts/kampus/seed-dev.mjs` (öğretmen, veli, iki öğrenci, 3-A sınıfı,
  T.C. numaraları, bir ödev, bir süreç değerlendirmesi; hesaplar ve şifre betiğin başında). Giriş uçları IP başına
  5 dakikada 10 istekle sınırlı olduğundan betik art arda çalıştırılırsa birkaç dakika beklemek gerekebilir.
