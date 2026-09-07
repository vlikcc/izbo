# Dokploy ile yayına alma

`docker-compose.dokploy.yml`, `docker-compose.prod.yml`'in Dokploy sürümüdür. Tek yapısal farkı
**caddy servisinin olmaması**: Dokploy'un Traefik'i 80/443'ü sahiplenir, ikinci bir ters vekil o
portlara bağlanamaz. Caddy'nin iki genel hostname için yaptığı her şey — yönlendirme, HSTS ve diğer
güvenlik başlıkları, API'ye özel CSP, `/metrics`'in dışarı kapatılması — `frontend` ve `apigateway`
üzerindeki Traefik etiketlerine taşınmıştır.

## 1. DNS

İki kayıt gerekir, ikisi de sunucunun IP'sine:

| Tip | Ad | Değer |
|-----|-----|-------|
| A | `eduplatform` | sunucu IP'si |
| A | `api.eduplatform` | sunucu IP'si |

Cloudflare kullanıyorsanız ikisini de **DNS-only (gri bulut)** bırakın. Turuncu bulutta Traefik'in
Let's Encrypt HTTP-01 doğrulaması Cloudflare'in arkasından geçmek zorunda kalır; sertifika alınana
kadar proxy'yi kapatmak en pratiği.

Doğrulama:

```bash
dig +short eduplatform.velikececi.com
dig +short api.eduplatform.velikececi.com
```

İkisi de sunucunun IP'sini döndürmeden devam etmeyin — sertifika alınamaz.

## 2. Ortam değişkenleri

Gizli değerleri sunucuda üretin, repoya yazmayın. Dokploy'un Environment sekmesine yapıştırılacak
şablon:

```bash
# Domainler
APP_DOMAIN=eduplatform.velikececi.com
API_DOMAIN=api.eduplatform.velikececi.com
ACME_EMAIL=<let's encrypt bildirimleri için e-posta>

FRONTEND_URL=https://eduplatform.velikececi.com
API_PUBLIC_URL=https://api.eduplatform.velikececi.com
VITE_API_URL=https://api.eduplatform.velikececi.com

# Gizli değerler — her biri için: openssl rand -base64 32
JWT_SECRET=
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
MINIO_BUCKET=eduplatform
INTERNAL_API_KEY=

# İlk yönetici. Bir kez açıp hesabı oluşturduktan sonra false'a çekin.
SEED_ENABLED=true
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=

# Jitsi (boş bırakılırsa herkese açık meet.jit.si kullanılır)
JITSI_APP_ID=
JITSI_APP_SECRET=
VITE_JITSI_DOMAIN=meet.jit.si

# SMTP (boş SMTP_HOST = e-posta gönderilmez)
SMTP_HOST=
SMTP_PORT=587
SMTP_FROM=
SMTP_USER=
SMTP_PASSWORD=
SMTP_ENABLE_SSL=true
EMAIL_REQUIRE_VERIFICATION=false
```

`VITE_API_URL` **derleme zamanında** frontend bundle'ının içine gömülür. Sonradan değiştirirseniz
frontend imajının yeniden derlenmesi gerekir; sadece yeniden başlatmak yetmez.

## 3. Dokploy

1. **Create Application → Compose**.
2. Kaynağı bu depoya, `main` dalına bağlayın.
3. Compose dosyası olarak `docker-compose.dokploy.yml` seçin.
4. Environment sekmesine yukarıdaki değerleri girin.
5. Deploy.

Domainleri Dokploy arayüzünden ayrıca eklemeyin — yönlendirme, sertifika ve güvenlik başlıkları
compose içindeki etiketlerle tanımlı. Arayüzden ikinci bir domain tanımı aynı hostname için çakışan
router üretir.

## 4. Doğrulama

```bash
curl -fsS https://api.eduplatform.velikececi.com/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://eduplatform.velikececi.com/

# Güvenlik başlıkları Caddy'deki haliyle duruyor mu
curl -sI https://api.eduplatform.velikececi.com/health | grep -iE 'strict-transport|content-security|x-frame|x-content-type|referrer|cross-origin'

# Metrics dışarı kapalı olmalı (403)
curl -s -o /dev/null -w '%{http_code}\n' https://api.eduplatform.velikececi.com/metrics

# Swagger production'da kapalı olmalı (404)
curl -s -o /dev/null -w '%{http_code}\n' https://api.eduplatform.velikececi.com/docs
```

Konteynerlerin durumu Dokploy arayüzünden görülür; on servisin de `healthy` olması beklenir.

## Caddy kurulumundan farklar

- **`/metrics` 403 döner, 404 değil.** Traefik'te "404 döndür" diye bir middleware yok; en yakını
  erişimi loopback'e kısıtlayan bir `ipallowlist`. Yol yine dışarı kapalı, sadece cevap farklı.
- **Aktif sağlık kontrolü yok.** Caddyfile upstream'leri `/health/ready` ile yokluyordu. Traefik'in
  eşdeğeri Dokploy tarafında ayrıca tanımlanır; compose'daki `healthcheck` blokları ve `depends_on`
  koşulları yerinde durduğu için servisler yine hazır olmadan trafik almaz.
- **`caddy_data` / `caddy_config` volume'leri yok.** Sertifikaları artık Traefik saklar.

## Mevcut kurulumdan geçiş

`docker-compose.prod.yml` ile ayakta bir stack varsa, Dokploy'a geçmeden önce onu durdurun —
aksi halde iki ters vekil 80/443 için yarışır:

```bash
docker compose -f docker-compose.prod.yml down
```

Veritabanı volume'leri isimlendirilmiş olduğu için veri korunur, ama Dokploy farklı bir proje adı
kullanır: veri taşınacaksa volume'leri elle taşımak gerekir. Temiz kurulumda bu adım gereksizdir.
