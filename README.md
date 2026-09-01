# EduPlatform (izbo)

Çok servisli eğitim platformu: .NET 10 mikroservisler, Ocelot API Gateway, React/Vite frontend.

## Mimari

- **API Gateway** — JWT doğrulama, rate limiting, Ocelot yönlendirme
- **Servisler** — Auth, User, Classroom, Homework, Exam, Live Session, Notification, File, Subscription
- **Altyapı** — PostgreSQL (servis başına DB), Redis (Exam cache/SignalR), MinIO (dosyalar)

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

3. (İsteğe bağlı) MinIO bucket:

```bash
chmod +x scripts/init-minio-bucket.sh
./scripts/init-minio-bucket.sh
```

4. Doğrulama:

```bash
curl -f "https://${API_DOMAIN}/health"
```

`docker compose -f docker-compose.prod.yml ps` çıktısında **on servisin de** `healthy` olması beklenir.

### Mevcut bir kurulumu yükseltmek

`scripts/init-db.sh` yalnızca **boş** bir postgres volume’ünde çalışır. Bu sürümden önce kurulmuş bir
stack’te `eduplatform_subscription` veritabanı yoktur; SubscriptionService onsuz açılmaz ve ona bağlı
servisler de başlamaz. Yükseltmeden önce bir kez elle oluşturun:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "CREATE DATABASE eduplatform_subscription;"
```

Tablolar servis ilk açılışta EF migration’larıyla kurulur. Temiz kurulumlarda bu adım gerekmez.

### Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `JWT_SECRET` | En az 32 karakter |
| `INTERNAL_API_KEY` | Servisler arası hesap/profil senkronu için paylaşılan anahtar |
| `POSTGRES_PASSWORD` | PostgreSQL şifresi |
| `FRONTEND_URL` | CORS origin (`https://app...`) |
| `API_PUBLIC_URL` | Ocelot BaseUrl |
| `VITE_API_URL` | Frontend build-time API URL |
| `APP_DOMAIN` / `API_DOMAIN` | Caddy TLS hostları |
| `ACME_EMAIL` | Let’s Encrypt e-posta |

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

## Güvenlik notları

- Production’da Swagger kapalıdır.
- Altyapı portları (5432, 6379, …) prod compose’da dışarı açılmaz.
- TLS Caddy üzerinde sonlanır.
- Canlı ders (Jitsi vb.) harici servisler için firewall ve domain kurallarını ayrıca yapılandırın.
