# EduPlatform (izbo)

Çok servisli eğitim platformu: .NET 10 mikroservisler, Ocelot API Gateway, React/Vite frontend.

## Mimari

- **API Gateway** — JWT doğrulama, rate limiting, Ocelot yönlendirme
- **Servisler** — Auth, User, Classroom, Homework, Exam, Live Session, Notification, File
- **Altyapı** — PostgreSQL (servis başına DB), Redis (Exam cache/SignalR), MinIO (dosyalar)

SignalR hub’ları (Classroom, Notification) production MVP’de **tek instance** için yapılandırılmıştır. Yatay ölçek için Redis backplane eklenmelidir (ExamService’te mevcut).

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

### Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `JWT_SECRET` | En az 32 karakter |
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

## Güvenlik notları

- Production’da Swagger kapalıdır.
- Altyapı portları (5432, 6379, …) prod compose’da dışarı açılmaz.
- TLS Caddy üzerinde sonlanır.
- Canlı ders (Jitsi vb.) harici servisler için firewall ve domain kurallarını ayrıca yapılandırın.
