# Vote OSS

**Vote OSS** is an open-source, secure voting platform built for the students of the National Technical University of Ukraine "Igor Sikorsky Kyiv Polytechnic Institute". It provides anonymous, verifiable, and tamper-resistant elections using RSA encryption, a chained ballot ledger, and identity verification via the Ukrainian government's Diia app.

**Production:** [https://voteoss.kpi.ua](https://voteoss.kpi.ua)\
**API Docs (Swagger):** [https://voteoss.kpi.ua/docs](https://voteoss.kpi.ua/docs)\
**Source Code:** [https://github.com/srkpi/vote-oss](https://github.com/srkpi/vote-oss)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the App](#running-the-app)
- [Scripts](#scripts)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
  - [Docker](#docker)
  - [CI/CD](#cicd)
- [API Documentation](#api-documentation)
- [Security Model](#security-model)
- [License](#license)

## Features

- **RSA-2048 ballot encryption** — each ballot is encrypted with the election's public key; the private key is revealed only after the election closes
- **Chained ballot ledger** — every ballot is SHA-256 hashed and linked to the previous one, making any tampering immediately detectable
- **Zero-knowledge anonymity** — the system records _that_ a user voted, but never _what_ they chose
- **Diia-based identity verification** — login is handled exclusively through the Ukrainian government's Diia app via KPI ID, ensuring only real, verified students can vote
- **Access restrictions** — elections can be scoped to specific faculties and groups
- **Public ballot verification** — anyone can inspect the full ballot chain and independently verify results using the published private key
- **Admin hierarchy** — a tree-structured admin system with invite tokens and permission delegation
- **FAQ management** — rich-text FAQ pages editable by admins, powered by [Quill](https://quilljs.com/)
- **OpenAPI spec** — auto-generated Swagger documentation served at `/docs`

## Tech Stack

| Layer                     | Technology                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**             | [Next.js 16](https://nextjs.org/) (App Router, React Server Components)                                                                                                                      |
| **Language**              | [TypeScript 5](https://www.typescriptlang.org/)                                                                                                                                              |
| **UI**                    | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **Database**              | [PostgreSQL](https://www.postgresql.org/)                                                                                                                                                    |
| **ORM**                   | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg`                                                                                                                                 |
| **Cache / Session Store** | [Redis](https://redis.io/) via [ioredis](https://github.com/redis/ioredis)                                                                                                                   |
| **Authentication**        | [KPI ID](https://auth.kpi.ua) (CAS-based) + Diia verification, JWT (access + refresh) via [jose](https://github.com/panva/jose)                                                              |
| **Cryptography**          | Node.js built-in `crypto` — RSA-2048 key generation, ECDSA signing, SHA-256 hashing                                                                                                          |
| **Rich Text**             | [Quill](https://quilljs.com/) (Delta format)                                                                                                                                                 |
| **API Docs**              | [next-swagger-doc](https://github.com/jellydn/next-swagger-doc) + [swagger-ui-react](https://www.npmjs.com/package/swagger-ui-react)                                                         |
| **Testing**               | [Jest 30](https://jestjs.io/), [ts-jest](https://github.com/kulshekhar/ts-jest), [Allure](https://allurereport.org/)                                                                         |
| **Linting / Formatting**  | [ESLint 9](https://eslint.org/) (flat config), [Prettier](https://prettier.io/), [simple-import-sort](https://github.com/lydell/eslint-plugin-simple-import-sort)                            |
| **Package Manager**       | [pnpm 10](https://pnpm.io/)                                                                                                                                                                  |
| **Containerisation**      | [Docker](https://www.docker.com/) (multi-stage build)                                                                                                                                        |
| **CI/CD**                 | GitHub Actions                                                                                                                                                                               |

## Architecture Overview

The application runs as a standalone Next.js server (`output: 'standalone'`). All server-side data fetching uses the internal API client (`serverApi`) which forwards cookies directly. The browser-side client (`api`) includes automatic JWT refresh-token rotation with a single-flight deduplication mechanism.

## Database Schema

The application uses **PostgreSQL** as its primary database and connects to it through **Prisma ORM** using the `@prisma/adapter-pg` native driver adapter. The Prisma schema is located at [`prisma/schema.prisma`](prisma/schema.prisma).

### ER Diagram

![ER Diagram](./prisma/er-diagram.svg)

### Models

| Model                 | Description                                                                        |
| --------------------- | ---------------------------------------------------------------------------------- |
| `JwtToken`            | Stores access/refresh JTI pairs for revocation tracking                            |
| `Admin`               | Admin users with a self-referential hierarchy tree (`promoter` → `subordinates`)   |
| `AdminInviteToken`    | Hashed, time-limited, multi-use tokens for onboarding new admins                   |
| `Election`            | An election with RSA key pair, open/close timestamps, and choice constraints       |
| `ElectionRestriction` | Scoping rules attached to an election (faculty, group, study year, etc.)           |
| `ElectionChoice`      | An individual answer option within an election                                     |
| `IssuedToken`         | Records which users have been issued a vote token (prevents double-token issuance) |
| `Ballot`              | An encrypted, signed, chained ballot entry                                         |
| `UsedTokenNullifier`  | SHA-256 hash of spent vote tokens (prevents double-voting)                         |
| `FaqCategory`         | A top-level FAQ section with an ordered position                                   |
| `FaqItem`             | A single Q&A entry inside a category, storing content as a Quill Delta JSON string |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`npm install -g pnpm`)
- **PostgreSQL** ≥ 14
- **Redis** ≥ 6
- Access to **KPI ID** (for authentication integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/srkpi/vote-oss.git
cd vote-oss

# Install dependencies
pnpm install

# Generate the Prisma client
pnpm db:generate
```

### Environment Variables

Copy the example file and fill in the required values or use default ones with the default `docker-compose.yml` file:

```bash
cp .env.example .env
```

| Variable                     | Required | Description                                                                                                                  |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`       | No       | Display name shown in the UI (default: `"Vote OSS"`)                                                                         |
| `NEXT_PUBLIC_APP_URL`        | **Yes**  | Full public URL of the app, e.g. `https://voteoss.kpi.ua`                                                                    |
| `DATABASE_URL`               | **Yes**  | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/voteoss`                                                |
| `REDIS_URL`                  | **Yes**  | Redis connection string, e.g. `redis://localhost:6379`                                                                       |
| `JWT_ACCESS_SECRET`          | **Yes**  | Random secret for signing access tokens — **minimum 32 characters**                                                          |
| `JWT_REFRESH_SECRET`         | **Yes**  | Random secret for signing refresh tokens — **minimum 32 characters**                                                         |
| `DATABASE_ENCRYPTION_KEY`    | **Yes**  | Random secret for elections private key encryption — **64 characters, hex format**                                           |
| `CAMPUS_API_URL`             | **Yes**  | Base URL of the KPI Campus API used for faculty/group validation                                                             |
| `CAMPUS_INTEGRATION_API_KEY` | **Yes**  | KPI Campus API key used for retrieving user data by user id from KPI ID                                                      |
| `NEXT_PUBLIC_KPI_AUTH_URL`   | No       | KPI ID auth base URL (default: `https://auth.kpi.ua`)                                                                        |
| `NEXT_PUBLIC_KPI_APP_ID`     | **Yes**  | Your registered KPI ID application ID                                                                                        |
| `KPI_APP_SECRET`             | **Yes**  | Your KPI ID application secret                                                                                               |
| `CRON_SECRET`                | **Yes**  | Bearer secret for protecting cron endpoints — **minimum 32 characters**                                                      |
| `TRUSTED_PROXY_COUNT`        | No       | Number of trusted reverse proxies in front of the app (default: `1`). Used for correct client IP extraction in rate limiting |

#### Build-time vs Runtime Variables

Variables prefixed with `NEXT_PUBLIC_` are **inlined at build time** and baked into the client bundle. All other variables are read at runtime by the server only. When building a Docker image, the four `NEXT_PUBLIC_*` variables must be passed as Docker build arguments (see [CI/CD](#cicd)).

### Database Setup

```bash
# Run all migrations (development)
pnpm db:migrate

# Run migrations without prompts (production)
pnpm db:migrate:prod

# Seed the database (optional)
pnpm db:seed

# Open Prisma Studio (GUI browser for your data)
pnpm db:studio
```

### Running the App

```bash
# If you are testing app locally you need to launch:
# - PostgreSQL database
# - Redis
# - Mock integrations API
docker compose up

# Start the development server (also regenerates the OpenAPI spec)
pnpm dev

# Build for production
pnpm build

# Start the production server
pnpm start
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command                 | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Start Next.js development server with hot reload        |
| `pnpm build`            | Build the application for production                    |
| `pnpm start`            | Start the production server                             |
| `pnpm lint`             | Run ESLint across the entire codebase                   |
| `pnpm type-check`       | Run TypeScript type checking without emitting files     |
| `pnpm format`           | Format all files with Prettier                          |
| `pnpm format:check`     | Check formatting without writing changes                |
| `pnpm test`             | Run the Jest test suite                                 |
| `pnpm test:watch`       | Run Jest in watch mode                                  |
| `pnpm test:coverage`    | Run Jest and collect coverage reports                   |
| `pnpm test:ci`          | Run Jest in CI mode (no watch, force exit)              |
| `pnpm allure:generate`  | Generate an Allure HTML report from test results        |
| `pnpm allure:open`      | Open the generated Allure report in a browser           |
| `pnpm allure:serve`     | Serve Allure results interactively                      |
| `pnpm db:migrate`       | Run Prisma migrations (dev — with prompts)              |
| `pnpm db:migrate:prod`  | Run Prisma migrations (production — no prompts)         |
| `pnpm db:generate`      | Regenerate the Prisma client after schema changes       |
| `pnpm db:studio`        | Launch Prisma Studio                                    |
| `pnpm db:reset`         | Reset the database and re-run all migrations            |
| `pnpm db:seed`          | Seed the database with initial data                     |
| `pnpm generate:openapi` | Regenerate `public/openapi.json` from JSDoc annotations |

## Testing

Tests live in `src/__tests__/` and are run with Jest using `ts-jest`. The test environment uses [Allure Jest](https://allurereport.org/) to produce rich test reports.

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run tests and then generate + open the Allure report
allure run -- pnpm test
pnpm allure:open
```

Allure reports for the `main` branch are automatically published to GitHub Pages by the CI pipeline.

Test environment variables are pre-configured in `jest.setup.ts` so no real database or Redis instance is required for unit tests.

## Production Deployment

### Docker

The project includes a multi-stage `Dockerfile` that produces a minimal, non-root production image using the Next.js standalone output mode.

```bash
# Build the image (supply NEXT_PUBLIC_* vars at build time)
docker build \
  --build-arg NEXT_PUBLIC_APP_NAME="Vote OSS" \
  --build-arg NEXT_PUBLIC_APP_URL="https://voteoss.kpi.ua" \
  --build-arg NEXT_PUBLIC_KPI_AUTH_URL="https://auth.kpi.ua" \
  --build-arg NEXT_PUBLIC_KPI_APP_ID="your-app-id" \
  -t vote-oss .

# Run the container (supply server-side secrets at runtime via environment)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e CAMPUS_API_URL="..." \
  -e KPI_APP_SECRET="..." \
  -e CRON_SECRET="..." \
  vote-oss
```

The container exposes port `3000` and runs as a non-root `nextjs` user for security.

### CI/CD

Three GitHub Actions workflows are included:

#### `lint.yml` — runs on every push and pull request

- Sets up Node.js 20 and pnpm with caching
- Generates the Prisma client
- Runs TypeScript type checking (`pnpm type-check`)
- Runs ESLint (`pnpm lint`)

#### `tests.yml` — runs on pushes to `dev`/`main` and pull requests

- Runs the full Jest test suite via Allure
- Uploads the Allure report as a workflow artifact (retained for 30 days)
- Publishes the report to GitHub Pages on merges to `main`

#### `docker.yml` — runs on pushes to `dev`/`main`

- Logs into Docker Hub
- Builds a multi-platform Docker image using BuildKit layer caching
- Tags the image as:
  - `latest` (on `main` branch only)
  - `<branch-name>` (e.g. `dev`)
  - `sha-<short-commit-hash>`
- Pushes the image to Docker Hub

Build-time environment variables (`NEXT_PUBLIC_*`) are sourced from GitHub Actions **Environment** variables (`vars.*`) stored under the `Production` or `Development` environment depending on the branch. Runtime secrets (database URLs, JWT secrets, etc.) must be injected separately into the container at deploy time and are never stored in the image.

### Cron Jobs

The endpoint `POST /api/cron/cleanup-tokens` purges expired JWT token records from the database. It must be called with an `Authorization: Bearer <CRON_SECRET>` header. Schedule it with your platform's cron facility (e.g. Vercel Cron, Kubernetes CronJob, or a simple crontab) — once per 7 days is sufficient.

```bash
curl -X POST https://voteoss.kpi.ua/api/cron/cleanup-tokens \
  -H "Authorization: Bearer $CRON_SECRET"
```

## API Documentation

The full OpenAPI 3.0 specification is auto-generated from JSDoc `@swagger` annotations at build time and written to `public/openapi.json`.

**Interactive Swagger UI:** [https://voteoss.kpi.ua/docs](https://voteoss.kpi.ua/docs)

To regenerate the spec locally after adding or changing annotations:

```bash
pnpm generate:openapi
```

## Security Model

### Voting Flow

1. **Identity verification** — the user authenticates via KPI ID + Diia; the server issues a signed JWT containing their faculty, group, and study metadata.
2. **Eligibility check** — when requesting a vote token, the server verifies the user's JWT claims against the election's restriction rules.
3. **Token issuance** — a unique, ECDSA-signed vote token is issued and the issuance is recorded (one token per user per election).
4. **Ballot submission** — the client encrypts the chosen option(s) with the election's RSA public key and submits the encrypted ballot alongside the token, its ECDSA signature, and a SHA-256 nullifier.
5. **Server-side verification** — the server verifies the token signature, checks the nullifier has not been used before, decrypts the ballot to validate choices, then appends the ballot to the hash chain and records the nullifier.
6. **Tally** — after the election closes, the private key is published. Any observer can decrypt every ballot and independently reproduce the tally.

### JWT Strategy

- Access tokens are **short-lived** (minutes). Refresh tokens are **longer-lived** and **rotated** on every use.
- Both token JTIs are stored in PostgreSQL (`jwt_tokens`). Revocation is performed by removing the row; a Redis bloom filter cache is used to avoid hitting the database on every request.
- The browser client handles 401 responses with a single-flight refresh call (concurrent 401s share one refresh request rather than racing).

### Rate Limiting

Login and token refresh endpoints are rate-limited per IP address using Redis sliding window counters. The number of trusted reverse proxies in front of the app is controlled by `TRUSTED_PROXY_COUNT` to ensure the correct client IP is extracted from `X-Forwarded-For`.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
