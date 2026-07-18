# Vote OSS

![Vote OSS Readme Header](images/readme-header.png)

[![License: MIT](https://img.shields.io/github/license/srkpi/vote-oss?label=License)](https://opensource.org/licenses/MIT) [![Docker](https://img.shields.io/docker/v/sckpi/vote-oss?label=Docker)](https://hub.docker.com/r/srkpi/vote-oss) [![Tests](https://img.shields.io/github/actions/workflow/status/srkpi/vote-oss/tests.yml?label=Tests)](https://github.com/srkpi/vote-oss/actions) [![Website](https://img.shields.io/website?url=https%3A%2F%2Fvoteoss.kpi.ua%2Fapi%2Fhealth&label=Website)](https://voteoss.kpi.ua)

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
  - [Running the App Locally](#running-the-app-locally)
- [Local Development Login](#local-development-login)
- [Mock Integrations API](#mock-integrations-api)
- [Scripts](#scripts)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
  - [Docker Compose](#docker-compose)
  - [MinIO — Public Bucket Setup](#minio--public-bucket-setup)
  - [CI/CD](#cicd)
- [API Documentation](#api-documentation)
- [Analytics — PostHog](#analytics--posthog)
- [Security Model](#security-model)
- [License](#license)

## Features

- **RSA-2048 ballot encryption** — each ballot is encrypted with the election's public key; the private key is revealed only after the election closes
- **Chained ballot ledger** — every ballot is SHA-256 hashed and linked to the previous one, making any tampering immediately detectable
- **Zero-knowledge anonymity** — the system records _that_ a user voted, but never _what_ they chose
- **Non-anonymous elections** — optional identified mode where voter names are cryptographically embedded in ballots and published when the election closes
- **Diia-based identity verification** — login is handled through the Ukrainian government's Diia app via KPI ID, ensuring only real, verified students can vote
- **Access restrictions** — elections can be scoped to specific faculties, groups, study years, study forms, course levels, or group memberships
- **Public ballot verification** — anyone can inspect the full ballot chain and independently verify results using the published private key
- **Petitions** — student-created petitions with a configurable signature quorum, admin approval workflow, and public signatory list
- **Groups** — student government organisations can create groups, manage membership via invite links, and scope elections to their members
- **Candidate registration forms** — groups can run structured candidate registration processes with team invite workflows and review stages
- **Election campaigns** — full lifecycle orchestration for elections: registration → optional per-candidate signature collection → final vote, advanced via an automated state machine
- **Meeting protocols** — groups can create and generate formatted PDF meeting protocols linked to closed elections for vote tallies
- **Bypass tokens** — admins can issue time-limited bypass tokens (global or per-election) for students with access issues; global bypasses are invalidated on the next token refresh
- **Admin hierarchy** — a tree-structured admin system with invite tokens and permission delegation
- **FAQ management** — rich-text FAQ pages editable by admins, powered by [Quill](https://quilljs.com/)
- **OpenAPI spec** — auto-generated Swagger documentation served at `/docs`
- **Analytics** — PostHog integration for product analytics and error tracking

## Tech Stack

| Layer                     | Technology                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**             | [Next.js 16](https://nextjs.org/) (App Router, React Server Components)                                                                                                                      |
| **Language**              | [TypeScript 5](https://www.typescriptlang.org/)                                                                                                                                              |
| **UI**                    | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/) |
| **Database**              | [PostgreSQL](https://www.postgresql.org/)                                                                                                                                                    |
| **ORM**                   | [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg`                                                                                                                                 |
| **Cache / Session Store** | [Redis](https://redis.io/) via [ioredis](https://github.com/redis/ioredis)                                                                                                                   |
| **Object Storage**        | [MinIO](https://min.io/) (S3-compatible) for group logos and uploaded files                                                                                                                  |
| **Authentication**        | [KPI ID](https://auth.kpi.ua) (CAS-based) + Diia verification, JWT (access + refresh) via [jose](https://github.com/panva/jose)                                                              |
| **Cryptography**          | Node.js built-in `crypto` — RSA-2048 key generation, ECDSA signing, SHA-256 hashing                                                                                                          |
| **Rich Text**             | [Quill](https://quilljs.com/) (Delta format)                                                                                                                                                 |
| **Analytics**             | [PostHog](https://posthog.com/) (client-side + server-side, OpenTelemetry log export)                                                                                                        |
| **API Docs**              | [next-swagger-doc](https://github.com/jellydn/next-swagger-doc) + [swagger-ui-react](https://www.npmjs.com/package/swagger-ui-react)                                                         |
| **Testing**               | [Jest 30](https://jestjs.io/), [ts-jest](https://github.com/kulshekhar/ts-jest), [Allure](https://allurereport.org/)                                                                         |
| **Linting / Formatting**  | [ESLint 9](https://eslint.org/) (flat config), [Prettier](https://prettier.io/), [simple-import-sort](https://github.com/lydell/eslint-plugin-simple-import-sort)                            |
| **Package Manager**       | [pnpm 11](https://pnpm.io/)                                                                                                                                                                  |
| **Containerisation**      | [Docker](https://www.docker.com/) (multi-stage build), [Caddy](https://caddyserver.com/) reverse proxy                                                                                       |
| **CI/CD**                 | GitHub Actions                                                                                                                                                                               |

## Architecture Overview

The application runs as a standalone Next.js server (`output: 'standalone'`). All server-side data fetching uses the internal API client (`serverApi`) which forwards cookies directly. The browser-side client (`api`) includes automatic JWT refresh-token rotation with a single-flight deduplication mechanism.

A Caddy reverse proxy sits in front of the app, routing `/files/*` to MinIO and everything else to the Next.js server.

## Database Schema

The application uses **PostgreSQL** as its primary database and connects to it through **Prisma ORM** using the `@prisma/adapter-pg` native driver adapter. The Prisma schema is located at [`prisma/schema.prisma`](prisma/schema.prisma).

| Model                                  | Description                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `JwtToken`                             | Stores access/refresh JTI pairs for revocation tracking                                       |
| `Admin`                                | Admin users with a self-referential hierarchy tree (`promoter` → `subordinates`)              |
| `AdminInviteToken`                     | Hashed, time-limited, multi-use tokens for onboarding new admins                              |
| `Election`                             | An election or petition with RSA key pair, open/close timestamps, and choice constraints      |
| `ElectionRestriction`                  | Scoping rules attached to an election (faculty, group, study year, etc.)                      |
| `ElectionChoice`                       | An individual answer option within an election                                                |
| `IssuedToken`                          | Records which users have been issued a vote token (prevents double-token issuance)            |
| `Ballot`                               | An encrypted, signed, chained ballot entry                                                    |
| `UsedTokenNullifier`                   | SHA-256 hash of spent vote tokens (prevents double-voting)                                    |
| `GlobalBypassToken`                    | Platform-level bypass tokens for students with access issues                                  |
| `GlobalBypassTokenUsage`               | Per-user usage records for global bypass tokens                                               |
| `ElectionBypassToken`                  | Election-scoped bypass tokens that waive specific restrictions                                |
| `ElectionBypassTokenUsage`             | Per-user usage records for election bypass tokens                                             |
| `FaqCategory`                          | A top-level FAQ section with an ordered position                                              |
| `FaqItem`                              | A single Q&A entry inside a category, storing content as a Quill Delta JSON string            |
| `Group`                                | A student group with ownership, requisites, and optional logo                                 |
| `File`                                 | Object storage file record (MinIO bucket + key) for group logos                               |
| `GroupMember`                          | Membership record linking a user to a group                                                   |
| `GroupInviteLink`                      | Hashed invite link with usage cap and expiry for joining a group                              |
| `GroupInviteLinkUsage`                 | Per-user usage records for group invite links                                                 |
| `Protocol`                             | A meeting protocol with agenda, attendance, and an OSS snapshot                               |
| `ProtocolAgendaItem`                   | A single agenda item, optionally linked to a closed election with a yes/no/abstain mapping    |
| `ElectionCampaign`                     | Orchestrates a full election process through multiple phases                                  |
| `ElectionCampaignRestriction`          | Eligibility restrictions inherited by all child entities of a campaign                        |
| `CandidateRegistrationForm`            | A candidate registration form owned by a group                                                |
| `CandidateRegistrationFormRestriction` | Per-form eligibility restriction                                                              |
| `CandidateRegistration`                | A candidate's registration submission with status lifecycle                                   |
| `TeamMemberInviteToken`                | Per-slot invite tokens for registrations that require a team                                  |
| `UserProfile`                          | Stores information about user avatar, more settings will be in the future                     |

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`npm install -g pnpm`)
- **Docker** and **Docker Compose** (for local dependencies)
- Access to **KPI ID** — or use the included [Mock Integrations API](#mock-integrations-api) for local development

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

Copy the example file and fill in the required values:

```bash
cp .env.example .env
```

The `docker-compose.yml` in this repository provides sensible defaults for local development — the table below documents every variable so you know what to change for production.

| Variable                          | Required | Description                                                                                                                  |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`            | No       | Display name shown in the UI (default: `"Vote OSS"`)                                                                         |
| `NEXT_PUBLIC_APP_URL`             | **Yes**  | Full public URL of the app, e.g. `https://voteoss.kpi.ua`                                                                    |
| `DATABASE_URL`                    | **Yes**  | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/voteoss`                                                |
| `REDIS_URL`                       | **Yes**  | Redis connection string, e.g. `redis://localhost:6379`                                                                       |
| `JWT_ACCESS_SECRET`               | **Yes**  | Random secret for signing access tokens — **minimum 32 characters**                                                          |
| `JWT_REFRESH_SECRET`              | **Yes**  | Random secret for signing refresh tokens — **minimum 32 characters**                                                         |
| `DATABASE_ENCRYPTION_KEY`         | **Yes**  | Random secret for encrypting sensitive fields — **64 hex characters** (`openssl rand -hex 32`)                               |
| `CAMPUS_API_URL`                  | **Yes**  | Base URL of the KPI Campus API. Use `http://localhost:3001` locally with the mock                                            |
| `CAMPUS_INTEGRATION_API_KEY`      | **Yes**  | KPI Campus API key (any value works with the mock)                                                                           |
| `NEXT_PUBLIC_KPI_AUTH_URL`        | No       | KPI ID auth base URL (default: `https://auth.kpi.ua`). Use `http://localhost:3001` locally                                   |
| `NEXT_PUBLIC_KPI_APP_ID`          | **Yes**  | Your registered KPI ID application ID (any value works with the mock)                                                        |
| `KPI_APP_SECRET`                  | **Yes**  | Your KPI ID application secret (any value works with the mock)                                                               |
| `CRON_SECRET`                     | **Yes**  | Bearer secret for protecting cron endpoints — **minimum 32 characters**                                                      |
| `MINIO_ROOT_USER`                 | **Yes**  | MinIO admin username (for local: any string, e.g. `minioadmin`)                                                              |
| `MINIO_ROOT_PASSWORD`             | **Yes**  | MinIO admin password (for local: any string, e.g. `minioadmin`)                                                              |
| `MINIO_ENDPOINT`                  | **Yes**  | MinIO endpoint URL, e.g. `http://localhost:9000`                                                                             |
| `MINIO_ACCESS_KEY`                | **Yes**  | MinIO access key                                                                                                             |
| `MINIO_SECRET_KEY`                | **Yes**  | MinIO secret key                                                                                                             |
| `TRUSTED_PROXY_COUNT`             | No       | Number of trusted reverse proxies in front of the app (default: `1`). Used for correct client IP extraction in rate limiting |
| `NEXT_PUBLIC_POSTHOG_TOKEN`       | No       | PostHog project API key.                                                                                                     |
| `NEXT_PUBLIC_POSTHOG_HOST`        | No       | PostHog ingestion host (default: `https://eu.i.posthog.com`)                                                                 |
| `NEXT_PUBLIC_POSTHOG_ASSETS_HOST` | No       | PostHog assets host (default: `https://eu-assets.i.posthog.com`)                                                             |

#### Build-time vs Runtime Variables

Variables prefixed with `NEXT_PUBLIC_` are **inlined at build time** and baked into the client bundle. All other variables are read at runtime by the server only. When building a Docker image, the `NEXT_PUBLIC_*` variables must be passed as Docker build arguments (see [CI/CD](#cicd)).

### Database Setup

```bash
# Run all migrations
pnpm db:migrate

# Seed the database with a test admin and invite token
pnpm db:seed

# Open Prisma Studio (GUI browser for your data)
pnpm db:studio
```

### Running the App Locally

The easiest way to start all dependencies (PostgreSQL, Redis, MinIO, mock integrations, Caddy) is with Docker Compose:

```bash
# Start infrastructure only (recommended for development)
docker compose up

# In a separate terminal, start Next.js in development mode
pnpm dev
```

The app will be available at [http://localhost](http://localhost).

To also run the application container (useful for testing the production build):

```bash
docker compose --profile app up
```

> **Note:** The `app` service is behind the `app` profile so it doesn't start by default during development.

## Local Development Login

Because KPI ID requires real university credentials, the mock integrations API provides a shortcut for logging in locally **without** going through KPI ID or Diia.

Navigate directly to the auth callback page with any mock ticket ID:

```text
http://localhost/auth/callback?ticketId=s1
http://localhost/auth/callback?ticketId=s1@ФІОТ
http://localhost/auth/callback?ticketId=s7@КА-31
```

This bypasses the KPI ID flow entirely — the Next.js server exchanges the `ticketId` with the mock integrations API and issues a real JWT session, exactly as it would in production.

Available ticket IDs and their special behaviours are listed in the [vote-oss-mock-integrations](https://github.com/srkpi/vote-oss-mock-integrations) GitHub repo README.

To **log in as an admin**, seed the database to get an invite token:

```bash
pnpm db:seed
# Output: Token: <raw-token>
#         Join URL: http://localhost:3000/join/<raw-token>
```

Visit the join URL while logged in with any account to become an admin.

## Mock Integrations API

For local development there is a lightweight mock server that replaces the real KPI ID and Campus APIs. Source code is in [separate GitHub repo](https://github.com/srkpi/vote-oss-mock-integrations). It is published as a Docker image and started automatically by `docker compose`.

### What it mocks

| Real service    | Mock endpoint                               | Description                                                 |
| --------------- | ------------------------------------------- | ----------------------------------------------------------- |
| KPI ID ticket   | `GET /api/ticket`                           | Returns synthetic user info for a given ticket ID           |
| Campus student  | `GET /api/integration/voteoss/students/:id` | Returns synthetic academic data                             |
| Campus groups   | `GET /group/all`                            | Returns real KPI faculty/group structure from `groups.json` |

### Dynamic ticket IDs

The same ticket always returns the same student — results are hash-seeded and stateless.

| Ticket          | Resolves to                                                |
| --------------- | ---------------------------------------------------------- |
| `s1` … `s100`   | A random student from any faculty                          |
| `s1@ФІОТ`       | A student whose group belongs to the ФІОТ faculty          |
| `s7@КА-31`      | A student in group КА-31 specifically                      |
| `s3@ФЕЛ`        | A student whose group belongs to the ФЕЛ faculty           |

### Predefined edge-case tickets

| Ticket       | Error triggered          | What's special                                       |
| ------------ | ------------------------ | ---------------------------------------------------- |
| `employee`   | `NotStudentError`        | `EMPLOYEE_ID` set, `STUDENT_ID` empty                |
| `both`       | _(valid student)_        | Both `EMPLOYEE_ID` and `STUDENT_ID` set              |
| `no-diia`    | `NotDiiaAuthError`       | `AUTH_METHOD = BANK_ID` instead of `DIIA`            |
| `invalid`    | `InvalidUserDataError`   | `STUDENT_ID` and `NAME` are empty                    |
| `academic`   | `NotStudyingError`       | Campus returns `OnAcademicLeave`                     |
| `dismissed`  | `NotStudyingError`       | Campus returns `Dismissed`                           |

### Cheat sheet endpoint

The mock exposes a human-readable cheat sheet at `GET /students` that lists all available tickets, faculty/group names, and a preview of generated student data. Useful when you need a student from a specific faculty:

```bash
curl http://localhost:3001/students | jq .
```

## Scripts

| Command                 | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Generate OpenAPI spec, then start Next.js in dev mode   |
| `pnpm build`            | Generate OpenAPI spec, then build for production        |
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
| `pnpm db:seed`          | Seed the database with a test admin and invite token    |
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

### Docker Compose

The `docker-compose.yml` defines all services needed to run the full stack. The typical production setup uses the Caddy reverse proxy to serve traffic:

```text
┌─ Caddy (:80 / :443) ───────────────────────────────┐
│  /files/*  →  MinIO (:9000)                        │
│  /*        →  Next.js app (:3000)                  │
└────────────────────────────────────────────────────┘
```

Start everything (without the `app` profile — the app image is separate):

```bash
docker compose up -d
```

Or include the pre-built app image:

```bash
docker compose --profile app up -d
```

Run migrations before or after starting containers:

```bash
docker compose exec app pnpm db:migrate:prod
```

### MinIO — Public Bucket Setup

Group logos and other uploaded files are stored in MinIO. After first launch you must create a **public read** bucket so that uploaded images are accessible via the Caddy proxy without authentication.

**Use MinIO Client (`mc`) from the command line:**

```bash
# Configure the client to point at your MinIO instance
mc alias set local http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

# Create the bucket
mc mb local/vote-oss-public

# Set the bucket policy to allow anonymous reads
mc anonymous set download local/vote-oss-public
```

Files are served through the Caddy proxy at `/files/<object-key>`, which rewrites the request to `http://minio:9000/vote-oss-public/<object-key>`. Make sure your `MINIO_ENDPOINT` environment variable points to the correct MinIO URL from the Next.js container's perspective.

### CI/CD

Three GitHub Actions workflows are included:

#### `lint.yml` — runs on every push and pull request

- Runs TypeScript type checking (`pnpm type-check`)
- Runs ESLint (`pnpm lint`)

#### `tests.yml` — runs on pushes to `dev`/`main` and pull requests

- Runs the full Jest test suite via Allure
- Uploads the Allure report as a workflow artifact (retained for 30 days)
- Publishes the report to GitHub Pages on merges to `main`

#### `docker.yml` — runs on pushes to `dev`/`main` and pull requests

- Logs into Docker Hub
- Builds a multi-platform Docker image using BuildKit layer caching
- Tags the image as:
  - `latest` (on `main` branch only)
  - `<branch-name>` (e.g. `dev`)
  - `sha-<short-commit-hash>`
- Pushes the image to Docker Hub

Build-time environment variables (`NEXT_PUBLIC_*`) are sourced from GitHub Actions **Environment** variables (`vars.*`) stored under the `Production` or `Development` environment depending on the branch. Runtime secrets (database URLs, JWT secrets, etc.) must be injected separately into the container at deploy time and are never stored in the image.

### Cron Jobs

The following endpoints must be called on a schedule. Protect each with `Authorization: Bearer <CRON_SECRET>`.

| Endpoint                        | Recommended schedule | Purpose                                                   |
| ------------------------------- | -------------------- | --------------------------------------------------------- |
| `POST /api/cron/cleanup-tokens` | Weekly               | Delete expired JWT token rows from the database           |
| `POST /api/cron/cleanup-bypass` | Weekly               | Delete expired global bypass token records                |
| `POST /api/cron/campaign-tick`  | Every 5–15 minutes   | Advance election campaigns through their state machine    |

Example:

```bash
curl -X POST https://voteoss.kpi.ua/api/cron/campaign-tick \
  -H "Authorization: Bearer $CRON_SECRET"
```

## API Documentation

The full OpenAPI 3.0 specification is auto-generated from JSDoc `@swagger` annotations at build time and written to `public/openapi.json`.

**Interactive Swagger UI:** [https://voteoss.kpi.ua/docs](https://voteoss.kpi.ua/docs)

To regenerate the spec locally after adding or changing annotations:

```bash
pnpm generate:openapi
```

## Analytics — PostHog

Vote OSS integrates [PostHog](https://posthog.com/) for both client-side and server-side analytics.

### Client-side

PostHog is initialised in `src/instrumentation-client.ts` and loaded on every page. It captures:

- Page views (via `PostHogPageView` component using the Next.js App Router)
- Page leave events
- User identification (userId, faculty, group, studyYear, isAdmin) set on login

Analytics events flow through the Next.js server proxy at `/ph` to avoid ad-blocker interference:

```text
Browser  →  /ph/*  →  Next.js proxy  →  PostHog ingestion host
```

### Server-side

The server-side PostHog client (`src/lib/posthog-server.ts`) is used in `src/instrumentation.ts` via the OpenTelemetry log exporter. Unhandled server errors are automatically captured and attributed to the authenticated user when a PostHog session cookie is present.

### Configuration

| Variable                          | Description                                             |
| --------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_TOKEN`       | PostHog project API key                                 |
| `NEXT_PUBLIC_POSTHOG_HOST`        | Ingestion host, default: `https://eu.i.posthog.com`     |
| `NEXT_PUBLIC_POSTHOG_ASSETS_HOST` | Assets host, default: `https://eu-assets.i.posthog.com` |

If `NEXT_PUBLIC_POSTHOG_TOKEN` is absent or empty, PostHog is not initialised and no data is sent.

## Security Model

### Voting Flow

1. **Identity verification** — the user authenticates via KPI ID + Diia; the server issues a signed JWT containing their faculty, group, and study metadata.
2. **Eligibility check** — when requesting a vote token, the server verifies the user's JWT claims against the election's restriction rules (and any active bypass tokens).
3. **Token issuance** — a unique, ECDSA-signed vote token is issued and the issuance is recorded (one token per user per election).
4. **Ballot submission** — the client encrypts the chosen option(s) with the election's RSA public key and submits the encrypted ballot alongside the token, its ECDSA signature, and a SHA-256 nullifier. For non-anonymous elections the ballot also includes the voter's identity embedded in a v2 envelope.
5. **Server-side verification** — the server verifies the token signature, checks the nullifier has not been used before, decrypts the ballot to validate choices (and voter identity for non-anonymous elections), then appends the ballot to the hash chain and records the nullifier.
6. **Tally** — after the election closes, the private key is published. Any observer can decrypt every ballot and independently reproduce the tally.

### JWT Strategy

- Access tokens are **short-lived** (minutes). Refresh tokens are **longer-lived** and **rotated** on every use.
- Both token JTIs are stored in PostgreSQL (`jwt_tokens`). Revocation is performed by removing the row; a Redis bloom filter cache is used to avoid hitting the database on every request.
- The browser client handles 401 responses with a single-flight refresh call (concurrent 401s share one refresh request rather than racing).

### Rate Limiting

Login and token refresh endpoints are rate-limited per IP address using Redis sliding window counters. The number of trusted reverse proxies in front of the app is controlled by `TRUSTED_PROXY_COUNT` to ensure the correct client IP is extracted from `X-Forwarded-For`.

### Bypass Token Security

Global bypass tokens grant platform access to students who fail eligibility checks (e.g. those on academic leave). When an admin revokes a global bypass, the next token refresh for affected users will fail, effectively forcing re-authentication within one access token TTL. This ensures revocation takes effect promptly without requiring an immediate session invalidation.

## License

This project is open source. See the [LICENSE](LICENSE) file for details.
