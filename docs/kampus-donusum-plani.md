# Kampüs Dönüşüm Planı (Morpa Kampüs benzeri sistem)

> Kaynak: morpakampus.com (ana sayfa, /kesfet, /uyelik, /5-sinif, /lgs, /online-canli-dersler,
> /online-ozel-dersler, /online-minisinif-dersler) — 6 Kasım 2026'da incelendi.
> Hedef: platformu "öğretmenin sınıf yönettiği araç"tan, **öğrenci ve velinin satın alıp kullandığı,
> öğretmen ve okulun da içinde yer aldığı** bir eğitim kampüsüne dönüştürmek.

## 0. Alınan kararlar (6 Kasım 2026)

| Konu | Karar |
|---|---|
| İş modeli | Veli/öğrenci paketi + okul kurumsal lisansı **ve** öğretmen pazaryeri (bağımsız öğretmenler özel ders, mini sınıf ve kendi içeriklerini satar; platform komisyon alır) |
| İçerik kaynağı | İkisi birden: merkezi (admin) MEB içerikleri + öğretmenlerin ürettiği içerik (onay akışıyla) |
| Kapsam | 1–12. sınıf, LGS ve YKS (TYT/AYT/YDT) |
| İlk adım | Faz 0 (rol ve hedef kitle dönüşümü) + Faz 1 (müfredat ve içerik kataloğu) |
| Soru bankası yeri (Faz 2) | ContentService içinde: kazanıma doğrudan bağ, aynı onay akışı ve MinIO; öğretmen sınıf sınavları ExamService'te kalır ve bankadan soru kopyalar |
| Soru biçimi (Faz 2) | Metin + `$...$` LaTeX formül (KaTeX) + isteğe bağlı görsel; çoktan seçmeli (A–E) ve doğru/yanlış |
| Deneme sınavları (Faz 2) | Takvimli pencere + Türkiye geneli sıralama; net, sıra ve yüzdelik pencere kapanınca açıklanır, geç girenler sıralamaya girmez |

Pazaryeri kararının getirdikleri: öğretmen vitrin profili (branş, seviye, puan, yorum), öğretmen onay/doğrulama
süreci, içerik moderasyonu, öğretmen kazanç ve ödeme (hakediş) defteri, komisyon oranı. Bunlar Faz 3–4'e eklenir;
Faz 0'da yalnızca öğretmen profilinin temel alanları açılır.

## 1. Morpa Kampüs'te neler var?

### Kullanıcı tipleri
| Rol | Ne yapıyor |
|---|---|
| Öğrenci (1–8. sınıf + LGS) | İçerik izler, test/deneme çözer, canlı derse katılır, jetonla özel/mini ders alır, ligde yarışır |
| Veli | Hesabı açar ve öder, çocuğun çalışmasını/katılımını/raporlarını izler, haftalık bilgilendirme alır, seminerlere katılır |
| Öğretmen | Ücretsiz üye olur (öğretmen belgesiyle), öğrencilere ödev/test gönderir, rapor izler |
| Okul / kurum | Kurumsal üyelik; yönetici öğretmen ve öğrenci başarısını izler |

### İçerik (sınıf seviyesi × ders × konu)
- Sınıf seviyesi seçimi: 1–8. sınıf ve LGS; her seviyede MEB derslerinin listesi
- Animasyonlu konu anlatımları (ör. 5. sınıfta 2.290 dakika)
- Beceri temelli / yeni nesil sorular, çözümlü soru videoları
- İnteraktif çalışmalar, yazdırılabilir etkinlikler, ders araçları
- E-kütüphane, eğitici oyunlar, ek modüller (kodlama, BİLSEM hazırlık, Denematik)
- Yazılı provaları, kazanım testleri, ara/genel değerlendirme sınavları
- LGS: çıkmış sorular + çözümler, deneme sınavları, konu tarama testleri

### Ölçme ve kişiselleştirme
- 20 dakikalık seviye belirleme sınavı
- Online deneme sınavları + "mini test cevaplarını gir" (kâğıt sınavın cevaplarını sisteme girme)
- Morpa AI: öğrenciye seviyesine göre içerik/soru önerisi, "sınırsız yapay zekâ desteği"
- Başarı Asistanı: haftalık kişisel çalışma planı
- Detaylı raporlama: çalışma süresi, performans, sınav sonuçları, ödev takibi

### Canlı ders ürünleri
- **Canlı grup dersleri**: 2–8. sınıf, 35 haftalık sabit program (sınıf seviyesine göre haftalık takvim), ~180 ders, tekrar izleme, kamp programları, ders içi chat (öğrenciler birbirini görmez/duymaz)
- **Mini sınıf**: 4 kişilik, 40 dakikalık dersler; derse önceden kayıt, ders başına 5 MorJeton
- **Birebir özel ders**: öğretmen seçimi ve süreklilik, ders planlarken "konu anlatımı / soru çözümü" ağırlığı ve öğretmene not, ders öncesi/sonrası ödev, öğrenci yorumları/puanı
- **Koçluk ve rehberlik**: birebir koçluk görüşmesi, velilere online seminer

### Motivasyon
- MorLig (puanla lig), avatar özelleştirme

### Üyelik ve ödeme
- Paketler (5. sınıf örneği): **Temel** 7.200 TL/yıl · **Plus** 8.700 TL (aylık deneme sınavları) · **Premium** 15.000 TL (175 canlı grup dersi + 2 birebir + 1 koçluk + haftalık veli bilgilendirme)
- Canlı grup dersi paketi ayrıca: 9.000 TL/yıl
- Süre 12 ay; **her ağustos otomatik üst sınıfa geçiş**, ek ücret yok
- Ödeme: kredi kartı (taksit), kapıda ödeme (üyelik kartı), havale/posta çeki
- **MorJeton**: ücretsiz hesap açılır, jeton yüklenir, mini sınıf/özel ders jetonla alınır
- Yaz tatili üyeliği, deneme üyeliği
- Giriş: kullanıcı kodu + şifre, mobil kod ile giriş, telefonla giriş; Android uygulaması

## 2. Bizde (izbo) ne var, ne eksik?

| Alan | Mevcut durum | Morpa'ya göre eksik |
|---|---|---|
| Roller | Student, Instructor, Admin, SuperAdmin; kayıtta öğrenci/eğitmen seçimi | **Veli rolü**, öğrenci–veli bağı, öğrencinin sınıf seviyesi, okul yöneticisi rolü |
| Kurum | `Organization` yalnızca faturalama ve koltuk paylaşımı | Gerçek kurum kapsamı (okulun öğretmenleri/öğrencileri/raporları), toplu öğrenci kaydı |
| İçerik | Yok (sınıf, sınav, ödev öğretmene ait) | **Müfredat ağacı** (seviye > ders > ünite > konu > kazanım), içerik türleri, katalog, public sınıf sayfaları |
| Video | MinIO'ya 200 MB'a kadar dosya | HLS dönüştürme/akış, oynatıcı, izleme ilerlemesi, canlı ders kaydı (`RecordingUrl` hiç doldurulmuyor) |
| Soru | Sorular tek bir sınava bağlı | **Merkezi soru bankası** (kazanım, zorluk, çözüm videosu), test/deneme üretimi |
| Sınav | Sınav motoru + canlı quiz (Kahoot benzeri) iyi durumda | Seviye belirleme, deneme sınavı takvimi, kazanım bazlı sonuç raporu, kâğıt sınav cevap girişi |
| Ödev | Sınıfa bağlı ödev, teslim, notlandırma | İçerik kütüphanesinden ödev gönderme |
| Canlı ders | WebRTC oda, beyaz tahta, chat, el kaldırma, Jitsi oturumları | Haftalık program, kayıt + tekrar izleme, kapasite (4 kişi), rezervasyon, öğretmen müsaitlik takvimi |
| Ödeme | Abonelikleri **öğretmen/kurum** öder, `ManualPaymentProvider` | Öğrenci/veli paketleri, içerik erişim hakları (entitlement), gerçek ödeme (iyzico), taksit, **jeton cüzdanı** |
| Kişiselleştirme | Yok | AI asistan, öneri motoru, haftalık çalışma planı |
| Motivasyon | Yok | Puan, lig, avatar, rozet |
| Veli takibi | Yok | Veli paneli, haftalık rapor e-postası/bildirim |
| Raporlama | İstemcide hesaplanan basit not defteri | Çalışma süresi, içerik tüketimi, kazanım başarısı, okul raporları |
| Mobil | PWA manifest (service worker yok) | Kurulabilir PWA, ileride native uygulama |

**Yeniden kullanılabilecek güçlü parçalar:** sınav motoru ve canlı quiz, WebRTC canlı oda, bildirim servisi
(SignalR), dosya servisi (MinIO), abonelik/kota/sipariş altyapısı, `IPaymentProvider` soyutlaması, gateway ve
servis başına DB yapısı.

## 3. Öğretmen odaklılığın kodda sabitlendiği yerler

- `Classroom.InstructorId` tek sahip varsayıyor; tüm üretim uçları `UserRoles.ContentManagers` ile korunuyor
- Öğrenci sınıfa yalnızca öğretmen ekleyince giriyor (`ClassroomsController.cs`, `ClassroomManagementService.cs`)
- Plan ve kota metrikleri yalnızca **üretimi** ölçüyor (sınıf, sınav, ödev, canlı dakika); abone öğretmen ya da kurum (`SubscriptionDataSeeder.cs`)
- Kurum yalnızca eğitmen tarafından açılabiliyor (`OrganizationsController.cs`)
- Landing, fiyatlandırma ve dashboard metinleri öğretmene yazılmış (`LandingPage.tsx`, `PricingPage.tsx`, `DashboardPage.tsx`)

## 4. Önerilen yol haritası

Her faz tek başına yayına alınabilir; bir sonrakine geçmeden çalışan bir ürün bırakır.

### Faz 0 — Rol ve hedef kitle dönüşümü
- `UserRole`'e `Parent` (ve gerekirse `SchoolAdmin`) eklenmesi; veli–öğrenci bağlantısı (davet kodu / velinin çocuk hesabı açması)
- Öğrenci profiline sınıf seviyesi (1–8, LGS) ve okul bilgisi
- Kayıt akışı: "Veliyim / Öğrenciyim / Öğretmenim / Kurumum"
- Rol bazlı ayrı dashboard'lar (öğrenci: içerik ve program; veli: çocukların özeti; öğretmen: mevcut araçlar)
- Öğrencinin sınıfa davet koduyla katılması
- Landing ve fiyat sayfasının öğrenci/veliye göre yeniden yazılması

### Faz 1 — Müfredat ve içerik kataloğu (yeni `ContentService`)
- Müfredat ağacı: Seviye > Ders > Ünite > Konu > Kazanım (MEB kazanım kodları)
- İçerik öğeleri: video konu anlatımı, çözümlü soru videosu, PDF/yazdırılabilir etkinlik, interaktif (HTML5/H5P), e-kitap
- Admin içerik yönetim paneli (toplu yükleme)
- Video: MinIO + ffmpeg ile HLS dönüştürme, oynatıcı, izleme ilerlemesi
- Öğrenci tarafı: "Derslerim" → ders → ünite → konu sayfası, kaldığı yerden devam
- Public SEO sayfaları: `/5-sinif`, `/lgs` (içerik sayıları, örnek videolar, paketler)

### Faz 2 — Soru bankası ve ölçme
- Merkezi soru bankası (kazanım, zorluk, tip, çözüm videosu); mevcut sınav motoru bankadan beslenir
- Kazanım testleri, yazılı provaları, ünite sınavları, deneme sınavları (takvimli)
- Seviye belirleme sınavı
- Sonuç raporu: ders/kazanım bazlı başarı, eksik konular, önerilen içerik
- Öğretmen: içerik kütüphanesinden ödev ve test gönderme

### Faz 3 — Ticaret: paket, ödeme, jeton
- Plan modelini öğrenciye uyarlama: **erişim hakkı (entitlement)** = seviye + paket + bitiş tarihi
- Paketler: Temel / Plus / Premium (+ canlı ders paketi, yaz tatili üyeliği, deneme üyeliği)
- `IPaymentProvider` için iyzico (taksit), havale/kapıda ödeme için mevcut manuel onay akışı
- Jeton cüzdanı: bakiye, hareket defteri (ledger), jeton paketleri, derse harcama/iade
- Ağustosta otomatik üst sınıfa geçiş işi (zamanlanmış görev)

### Faz 4 — Canlı ders ürünleri
- Grup canlı dersleri: seviye bazlı haftalık program, paket sahiplerine otomatik erişim, kayıt + tekrar izleme
- Mini sınıf: 4 kişi kapasiteli oturum, önceden kayıt, jetonla ödeme
- Birebir özel ders ve koçluk: öğretmen profili ve müsaitlik takvimi, rezervasyon, "konu anlatımı/soru çözümü" tercihi ve not, iptal kuralları, ders sonrası puanlama
- Mevcut WebRTC odası ve Jitsi altyapısı bunların hepsinde kullanılır

### Faz 5 — Kişiselleştirme ve motivasyon
- AI asistan (Claude API): konu sorma, soru çözüm ipucu, seviyeye göre öneri
- Başarı Asistanı: zayıf kazanımlardan haftalık çalışma planı
- Puan, lig, rozet, avatar

### Faz 6 — Veli, okul ve raporlama
- Veli paneli: çalışma süresi, izlenen içerik, sınav sonuçları, canlı ders katılımı
- Haftalık veli bilgilendirme e-postası/bildirimi
- Kurumsal üyelik: okul lisansı, toplu öğrenci kodu üretimi, okul yöneticisi raporları, kurum bazlı veri kapsamı
- Kurulabilir PWA (service worker, push bildirim)

## 5. Kod dışı not

Morpa'nın asıl değeri platformdan çok **içerik**: her seviyede binlerce dakika animasyon, yüz binlerce soru, ders
programını yürüten öğretmen kadrosu. Faz 1–2 altyapıyı kurar ama içeriğin kendisi (video, soru, PDF) ayrıca
üretilmeli, lisanslanmalı ya da öğretmenlere açılmalıdır. Bu karar iş modelini ve öncelikleri doğrudan belirler.
