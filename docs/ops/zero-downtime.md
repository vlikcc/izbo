# Zero-downtime notes

Caddy only forwards to healthy upstreams (`health /health/ready`). Replace one service at a time:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --build authservice
```

Keep `start_period` in healthchecks long enough for EF migrations. Migrations take a PostgreSQL advisory lock, so two instances of the same service can boot together without racing the schema.

Connection strings include pool caps (`Maximum Pool Size=50`) via `NpgsqlPooling.Apply`. Override per service if a host is undersized.
