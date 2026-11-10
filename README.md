# EduPlatform (izbo)

Çok servisli eğitim platformu: .NET 10 mikroservisler, Ocelot API Gateway, React/Vite frontend.

## Mimari

- **API Gateway** — JWT doğrulama, rate limiting, Ocelot yönlendirme
- **Servisler** — Auth, User, Classroom, Homework, Exam, Live Session, Notification, File, Subscription, Content
- **Altyapı** — PostgreSQL (servis başına DB), Redis (Exam cache/SignalR), MinIO (dosyalar, içerik videoları), ffmpeg (HLS)

### İçerik kataloğu (ContentService)

**ContentService** müfredata bağlı içerik kataloğudur: Seviye (1–12. sınıf, LGS, YKS TYT/AYT/YDT) → Ders →
Ünite → Konu → Kazanım, ve konulara bağlı içerikler (video, soru çözüm videosu, PDF, çalışma kağıdı,
e-kitap, gömülü içerik). Seviyeler ve MEB ders listeleri migration ile gelir; ünite/konu/kazanım
yöneticinin `POST /api/content/curriculum/import` ile yüklediği XLSX/CSV'den gelir (sütunlar: Seviye, Ders,
Ünite, Konu, Kazanım Kodu, Açıklama; aynı dosyayı tekrar yüklemek bir şey değiştirmez).

- Öğretmen kendi içeriğini oluşturur, yükler ve onaya gönderir (`items/{id}/submit`); yönetici
  `review-queue` üzerinden onaylar/reddeder. Yöneticinin içeriği doğrudan yayınlanabilir. Taslak ve
  incelemedeki içerik yalnızca sahibine ve yöneticiye görünür.
- Videolar `eduplatform-content` bucket'ına akışla yüklenir (`Content__MaxUploadMb`, varsayılan 2048) ve
  servis içindeki `VideoTranscodeWorker` ffmpeg ile 360p/720p HLS (6 sn segment) + küçük resim üretir.
  Oynatma `items/{id}/hls/{dosya}`, PDF `items/{id}/file` (Range destekli) üzerinden, yetki kontrollüdür.
- `/api/content/public/*` gateway'de **kimliksiz** geçer (public seviye sayfaları için yalnızca
  yayımlanmış içeriğin sayıları, adları ve küçük resimleri).
- Premium içerik bu fazda yalnızca işaretlenir; `IContentAccessPolicy` henüz herkese izin verir.

Büyük yüklemeler için zincirdeki her halkanın gövde sınırı/zaman aşımı yeterli olmalı: gateway yalnızca
yükleme rotası için Kestrel sınırını kaldırır (`ContentUpload__MaxRequestBodyMb`) ve Ocelot rotasına 1 saat
`Timeout` verir; Caddy'nin varsayılan gövde sınırı yoktur. Dokploy'da Traefik'in entrypoint
`respondingTimeouts.readTimeout` değeri (v3'te varsayılan 60 sn) büyük yüklemeleri keser — Traefik statik
yapılandırmasında artırın (ör. `3600s`).

### YZ Kampüs (ilkokul arayüzü)

İlkokul (1–4. sınıf) arayüzünün sunucu tarafı: T.C. Kimlik No ile giriş AuthService'te (`/api/auth/tc-login`),
ilerleme, ödül defteri (💎 KP / ⭐), Yıldız Kupası, avatar, Kampüs ödevleri ve beceri değerlendirmeleri
ContentService içindeki Kampüs modülünde (`/api/kampus/*`, ayrı `KampusDbContext`). Uç listesi ve kurallar:
[docs/kampus-api.md](docs/kampus-api.md). T.C. numarası yalnızca HMAC özeti ve AES-GCM şifreli olarak saklanır;
prod'da `NATIONAL_ID_LOOKUP_KEY` ve `NATIONAL_ID_ENCRYPTION_KEY` gerekir.

### Abonelik / kota katmanı

**SubscriptionService** plan kataloğunu (Free/Pro/Kurumsal), abonelikleri, kullanım sayaçlarını ve
kurumları (`Organization`) yönetir. `/api/plans` herkese açık; `/api/subscriptions/*` ve
`/api/organizations/*` JWT gerektirir; `/api/admin/*` Admin/SuperAdmin ister. `/api/internal/*`
gateway’den **geçirilmez**, yalnızca docker ağı içinden diğer servislerin ulaştığı uçlardır.

### Hesap kimliği (Auth ↔ User)

**AuthService** hesabın sahibidir: parola, oturum ve girişi belirleyen `IsActive` bayrağı ondadır.
**UserService** aynı `Id` ile profil dizinini tutar; admin panelindeki rol ve aktiflik yönetimi buradadır.

İki yön de `/api/internal/*` üzerinden, `INTERNAL_API_KEY` ile kimliklenir (gateway bu yolları
**geçirmez**):

- Kayıtta ve her girişte AuthService, UserService'e profili aynı `Id` ile yazar (idempotent). Giriş
  sırasındaki tekrar, bu mekanizmadan önce açılmış hesapları kendiliğinden dizine taşır.
- Admin panelinden aktiflik değiştirildiğinde UserService önce AuthService'e yazar. AuthService'e
  ulaşılamazsa işlem **başarısız olur** (`503`) ve dizin değişmez — yöneticinin kapattığını sanıp
  kapatmamış olması, sessizce yarım uygulamaktan daha kötüdür. Pasifleştirme ayrıca hesabın mevcut
  refresh token'larını iptal eder.

Classroom/Exam/Homework/LiveSession/File servisleri `Shared.Subscription.IQuotaGuard` üzerinden
kota kontrolü yapar (bkz. `src/Shared/Shared/Subscription/`). SubscriptionService'e ulaşılamazsa
istekler **fail-open** olarak geçer (`Subscription__FailOpen=true`) — faturalama kesintisi dersleri
durdurmaz. Kota aşımı `402 Payment Required` + `errorCode: QUOTA_EXCEEDED` olarak döner.

Bu fazda gerçek ödeme sağlayıcısı yok: abonelikler admin panelinden (`/api/admin/orders/{id}/mark-paid`)
manuel onaylanır. İleride bir ödeme sağlayıcısı eklemek `IPaymentProvider` arkasına yeni bir
implementasyon yazmaktan ibarettir.

SignalR hub’larının dördü de (Classroom, Exam, Live, Notification) `AddEduPlatformSignalR` üzerinden
Redis backplane kullanır (`src/Shared/Shared/Extensions/SignalRExtensions.cs`); backplane yalnızca
`ConnectionStrings__Redis` doluysa devreye girer ve prod compose dördüne de bu değeri verir. Yani hub’lar
yatay ölçeğe hazırdır.

## Geliştirme (yerel)

```bash
cp .env.example .env
# Geliştirme için varsayılan değerler yeterli

docker compose --profile dev up -d --build
```

- Frontend: http://localhost:3000  
- API Gateway: http://localhost:5050  
- RabbitMQ yalnızca `dev` profilinde (kodda kullanılmıyor)

### Varsayılan admin (geliştirme seed)

İlk açılışta **Auth** ve **User** veritabanlarına otomatik eklenir (`Seed:Enabled` Development’ta açık):

| Alan | Değer |
|------|--------|
| E-posta | `.env` içindeki `SEED_ADMIN_EMAIL` (örnek: `admin@eduplatform.local`) |
| Şifre | `.env` içindeki `SEED_ADMIN_PASSWORD` (repoda tutulmaz) |
| Rol | `SuperAdmin` |

Yerel Docker: `cp .env.example .env` yapıp `SEED_ADMIN_PASSWORD` değerini kendiniz belirleyin. Production’da seed kapalıdır; açmak için `Seed__Enabled=true` ve güçlü `Seed__Password` kullanın.

## Production (VPS + Docker Compose)

### Gereksinimler

- Docker & Docker Compose v2
- DNS: `APP_DOMAIN` ve `API_DOMAIN` → VPS IP
- Açık portlar: 80, 443

### Kurulum

1. `.env` oluşturun:

```bash
cp .env.example .env
# JWT_SECRET, POSTGRES_PASSWORD, MINIO_*, domain ve URL alanlarını doldurun
```

2. Stack’i başlatın:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

3. (İsteğe bağlı) MinIO bucket — FileService bucket'ı **açılışta kendisi oluşturur**, bu adım yalnızca
   bucket'ı elle önceden hazırlamak isteyenler içindir:

```bash
chmod +x scripts/init-minio-bucket.sh
./scripts/init-minio-bucket.sh
```

Nesne deposu açılışta erişilemezse servis yine ayağa kalkar ama log'a hata düşer ve `/health`
çıktısında `minio` **Degraded** görünür (uçun tamamı `200` dönmeye devam eder, aksi halde tek bir
depolama kesintisi gateway'i de düşürürdü). Depo geri geldiğinde durum kendiliğinden düzelir.

4. Doğrulama:

```bash
curl -f "https://${API_DOMAIN}/health"
```

`docker compose -f docker-compose.prod.yml ps` çıktısında **on servisin de** `healthy` olması beklenir.

### Dokploy ile yayına alma

Dokploy kullanıyorsanız `docker-compose.dokploy.yml` dosyasını kullanın: caddy servisi yoktur,
TLS'i Dokploy'un Traefik'i sonlandırır ve Caddy'nin yaptığı yönlendirme/güvenlik başlıkları
Traefik etiketlerine taşınmıştır. Adımlar: [docs/ops/dokploy.md](docs/ops/dokploy.md).

### Mevcut bir kurulumu yükseltmek

`scripts/init-db.sh` yalnızca **boş** bir postgres volume’ünde çalışır. Sonradan eklenen bir servisin
veritabanı (ör. `eduplatform_subscription`, ContentService'in `eduplatform_content`'i) eski bir kurulumda
bulunmaz; her servis açılışta kendi veritabanı yoksa oluşturur, sonra EF migration'larını uygular. Bunun
için postgres kullanıcısının `CREATEDB` yetkisi gerekir (stack'in varsayılan `postgres` kullanıcısında
vardır). Yetkisi kısıtlı bir kullanıcıyla çalışıyorsanız veritabanını önceden elle oluşturun:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "CREATE DATABASE eduplatform_content;"
```

### Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `JWT_SECRET` | En az 32 karakter |
| `INTERNAL_API_KEY` | Servisler arası hesap/profil senkronu için paylaşılan anahtar |
| `POSTGRES_PASSWORD` | PostgreSQL şifresi |
| `FRONTEND_URL` | CORS origin (`https://app...`) |
| `API_PUBLIC_URL` | Ocelot BaseUrl |
| `VITE_API_URL` | Frontend API URL (derleme zamanı, yalnızca yedek). Dokploy kurulumunda gerekmez: frontend konteyneri `API_PUBLIC_URL`'i çalışma anında `/config.js` olarak sunar |
| `APP_DOMAIN` / `API_DOMAIN` | Caddy TLS hostları |
| `ACME_EMAIL` | Let’s Encrypt e-posta |
| `CONTENT_MAX_UPLOAD_MB` | İçerik yükleme üst sınırı (MB, varsayılan 2048) |
| `MINIO_CONTENT_BUCKET` | İçerik bucket'ı (varsayılan `eduplatform-content`) |
| `CSP_MEDIA_SRC` | Frontend CSP `media-src` ek kaynakları (varsayılan `https://${API_DOMAIN}`) |

Gizliler repoda tutulmaz; yalnızca `.env` veya secret manager kullanın.

### Yedekleme

```bash
./scripts/backup-postgres.sh /var/backups/eduplatform
```

Cron örneği: `0 2 * * * cd /opt/eduplatform && ./scripts/backup-postgres.sh /var/backups/eduplatform`

### Rollback

1. Önce PostgreSQL yedeği alın.
2. Önceki image tag’leri ile `docker compose -f docker-compose.prod.yml up -d`.
3. Migration geri alma gerekiyorsa EF `dotnet ef migrations` ile yönetin; otomatik down yok.

### CI

GitHub Actions: build, test, Docker image build (`.github/workflows/ci.yml`).

Canlı smoke test:

```bash
SMOKE_API_URL=https://api.example.com dotnet test tests/EduPlatform.SmokeTests
```

### Gözlemlenebilirlik

- **Serilog** — Production’da JSON console log
- **OpenTelemetry** — `OTEL_EXPORTER_OTLP_ENDPOINT` ile collector bağlanabilir (opsiyonel)

## Veritabanı

Servisler açılışta `Database.Migrate()` çalıştırır. Yeni migration:

```bash
dotnet ef migrations add <Name> --project src/Services/<Service>/<Service>.csproj
```

> **Not:** `POSTGRES_MULTIPLE_DATABASES` yalnızca `postgres_data` volume'ü **ilk kez** oluşturulurken
> `scripts/init-db.sh` tarafından işlenir. SubscriptionService'i mevcut bir geliştirme ortamına
> ekliyorsanız (yani `postgres_data` volume'ü zaten varsa), veritabanını elle oluşturun:
> ```bash
> docker compose exec postgres psql -U postgres -c "CREATE DATABASE eduplatform_subscription;"
> docker compose up -d --build subscriptionservice
> ```
> ContentService için aynısı: `CREATE DATABASE eduplatform_content;` ardından
> `docker compose up -d --build contentservice`.

## Güvenlik notları

- Production’da Swagger kapalıdır.
- Altyapı portları (5432, 6379, …) prod compose’da dışarı açılmaz.
- TLS Caddy üzerinde sonlanır.
- Canlı ders (Jitsi vb.) harici servisler için firewall ve domain kurallarını ayrıca yapılandırın.
