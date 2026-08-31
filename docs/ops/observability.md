# Gözlemlenebilirlik

Servisler OpenTelemetry ile izlenir. `OTEL_EXPORTER_OTLP_ENDPOINT` doluysa izler OTLP ile dışa aktarılır. Prometheus metrikleri her süreçte `/metrics` altındadır; Caddy bu yolu internete açmaz.

Yerel yığın:

```bash
docker compose --profile obs up -d
```

- Grafana: http://localhost:3001 (kullanıcı `admin` / `admin`)
- Prometheus: http://localhost:9090
- OTLP: `otel-collector:4317` (compose ağı)

`.env` içine `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317` yazıp servisleri yeniden başlatın.
