# TechEarnest CRM

CRM + project + resource management platform. Modular monolith: Spring Boot API and React SPA.

Phase 10 production audit is underway (see `docs/MVP_COMPLETION_REPORT.md`). Do not start V2 until remaining P1 items are accepted or closed.

## Stack

- Java 21, Spring Boot 3.5, Maven, PostgreSQL 16, Flyway
- React 18, TypeScript, Vite, Bootstrap 5 / SCSS
- Docker Compose: PostgreSQL, Redis, MinIO

## Prerequisites

- JDK 21
- Maven 3.9+
- Node.js 20+
- Docker Desktop **running** (engine, not only the CLI) for Compose and Testcontainers
- or a local PostgreSQL 16 instance matching `.env`

## Run locally

```bash
cp .env.example .env
docker compose up -d
```

Wait until Docker Desktop is running and PostgreSQL is healthy, then:

```bash
cd backend
mvn spring-boot:run
```

API: http://localhost:8080  
Health: http://localhost:8080/actuator/health  
OpenAPI: http://localhost:8080/swagger-ui.html  

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

UI: http://localhost:5173  

Sign in with a seeded demo account, for example `orgadmin@example.com` / `ChangeMe!123`. Refresh tokens are stored in the `te_refresh` httpOnly cookie.

## Tests

```bash
cd backend && mvn test
cd frontend && npm test
```

`CrmApplicationTests` uses Testcontainers PostgreSQL (Docker required). `AuthFlowTest` uses the configured local database and seeded users.

## Layout

```text
docs/        architecture and product docs
backend/     Spring Boot
frontend/    Vite + React
docker-compose.yml
```

## Next

Close remaining Phase 10 P1 items (TEAM scope, audit region filter, documents or defer), then start V2 only when accepted. See `docs/MVP_COMPLETION_REPORT.md`.
