# Security Audit: EduPlatform

**Original audit:** October 26, 2023 — 9 findings (3 critical, 3 high, 3 medium), verdict "unsuitable for
production".
**Remediation verified:** September 1, 2026, against `main`.
**Status:** all 9 findings closed. Each row below names the code that closes it and, where one exists, the
test that keeps it closed.

This file is a record of a specific audit and its remediation. It is **not** a statement that the platform
has no vulnerabilities, and it does not cover anything introduced after the verification date.

## Findings

| # | Finding | Severity | Status | Closed by | Regression test |
|---|---------|----------|--------|-----------|-----------------|
| 1 | Hardcoded secrets in `appsettings.json` | Critical | Closed | Every `appsettings*.json` ships empty placeholders; secrets arrive as `JWT__Secret`, `POSTGRES_PASSWORD`, `MINIO_*` env vars. `docker-compose.prod.yml` fails fast on a missing `JWT_SECRET` (`:?` expansion). | — |
| 2 | IDOR — FileService download/delete | Critical | Closed | `FileManagementService` gates both paths on `caller.CanActFor(file.UploadedBy)` ([FileManagementService.cs:198](src/Services/FileService/FileService/Services/FileManagementService.cs:198), [:260](src/Services/FileService/FileService/Services/FileManagementService.cs:260)). | — |
| 3 | IDOR — ExamService sessions/results | Critical | Closed | Every `IExamSessionService` method takes a `Caller`; reads go through `CanReadSessionAsync` ([ExamSessionService.cs:19](src/Services/ExamService/ExamService/Services/ExamSessionService.cs:19)). | `tests/EduPlatform.IntegrationTests/ExamOwnershipTests.cs` |
| 4 | Malicious file upload | High | Closed | `FileUploadRules` enforces an extension allowlist, checks magic bytes against the extension, derives the stored content type server-side, and caps size per file type ([FileUploadRules.cs](src/Services/FileService/FileService/Services/FileUploadRules.cs)). | `tests/EduPlatform.UnitTests/FileUploadRulesTests.cs` |
| 5 | IDOR — ClassroomService modify/delete | High | Closed | Ownership checked via `classroom.InstructorId == caller.UserId \|\| caller.IsPlatformAdmin` ([ClassroomManagementService.cs:368](src/Services/ClassroomService/ClassroomService/Services/ClassroomManagementService.cs:368)); `SessionService.ClassroomAccess` gates moderator tokens. | `tests/EduPlatform.IntegrationTests/ClassroomOwnershipTests.cs`, `HomeworkOwnershipTests.cs` |
| 6 | Path traversal via upload filename | High | Closed | The storage key is built from the server-generated GUID plus a validated extension, never the client name: `$"{type}/{fileId:N}{StoredFileName.ExtensionOf(fileName)}"` ([FileManagementService.cs:110](src/Services/FileService/FileService/Services/FileManagementService.cs:110)). The original name is sanitised and kept as metadata only. | `tests/EduPlatform.UnitTests/StoredFileNameTests.cs` |
| 7 | User enumeration on registration | Medium | Closed | Registration returns `RegistrationOutcome.AlreadyRegistered`, which the controller answers **identically** to `Created`; login returns null for an unknown address exactly as for a wrong password ([AuthenticationService.cs:24](src/Services/AuthService/AuthService/Services/AuthenticationService.cs:24)). | `tests/EduPlatform.IntegrationTests/AuthEnumerationTests.cs` |
| 8 | Overly permissive CORS | Medium | Closed | `AddCorsPolicy` binds to the configured `Frontend:Url` only, with an explicit method and header allowlist — no wildcard origin ([ServiceExtensions.cs:55](src/Shared/Shared/Extensions/ServiceExtensions.cs:55)). | — |
| 9 | No rate limiting | Medium | Closed | Gateway: global 200 req/min per IP ([ApiGateway/Program.cs](src/ApiGateway/ApiGateway/Program.cs)). Credential endpoints: tighter per-endpoint limits counted in Redis so they hold across instances — login 10/5min, registration 5/15min, forgot-password 5/15min ([AuthRateLimits](src/Shared/Shared/RateLimiting/)). | — |

## Controls added since the original audit

Not audit findings, but part of the same hardening and worth recording:

- **Transport & headers** — Caddy terminates TLS with HSTS (preload), `X-Content-Type-Options`,
  `Referrer-Policy`; the API sends `default-src 'none'; frame-ancestors 'none'`. The SPA ships a CSP with
  no `unsafe-inline`/`unsafe-eval` in `script-src` ([frontend/nginx.conf.template](frontend/nginx.conf.template)).
- **Attack-surface reduction** — `/metrics` is not routed publicly; Swagger UI and the OpenAPI documents
  are development-only and `ocelot.Production.json` defines no `/openapi/*` routes.
- **Internal endpoints** — `/api/internal/*` on SubscriptionService is reachable only inside the Docker
  network; the gateway defines no route to it.
- **Secrets at rest** — `.env` is git-ignored and docker-ignored; `.gitguardian.yaml` guards the repo.
- **Supply chain in CI** — Trivy on every image (fails on CRITICAL), CodeQL for C# and JavaScript,
  `scripts/check-vulnerable-packages.sh` for NuGet, `npm audit --omit=dev --audit-level=high` for runtime
  npm dependencies.
- **Passwords** — BCrypt hashing with a shared `PasswordPolicy` (`tests/EduPlatform.UnitTests/PasswordPolicyTests.cs`).

## Known accepted risks

- **Quota checks fail open.** When SubscriptionService is unreachable, `IQuotaGuard` lets requests through
  (`Subscription__FailOpen=true`). Deliberate: a billing outage must not stop a lesson in progress. The
  trade-off is that a sustained SubscriptionService outage suspends quota enforcement.
- **Payments are approved by hand.** There is no payment provider; an admin marks orders paid via
  `/api/admin/orders/{id}/mark-paid`. This makes the admin role financially sensitive — keep the
  SuperAdmin account on a strong, unique password.
- **Retention policy is documented but not automated.** `docs/ops/retention.md` defines retention windows;
  no job enforces them yet, so refresh tokens, outbox rows and audit events accumulate.
