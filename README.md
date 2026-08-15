# CASC: Corpus of Attested Sound Changes

A self-hostable, human-readable database of reviewed historical sound changes. The public catalog supports a strict lineage tree, inline expandable entries and word examples, Unicode/IPA search, citations, and direct moderator-only editing.

This is a clean-room project. It does not include or transform the corpus of the earlier Index Diachronica.

## Local development

Requirements: Node.js 24, pnpm 10, and PostgreSQL 17 or a compatible recent release.

```sh
cp .env.example .env
pnpm install
pnpm db:grant-local # only if PostgreSQL was initialized by another database role
pnpm db:migrate
pnpm db:seed:demo
pnpm admin:create admin "a-long-unique-password"
pnpm dev
```

The demo seed is optional and visibly labels every fixture as unreviewed demonstration data. A normal migrated database is empty.

## Docker deployment

Create `.env` from `.env.example` and set strong, independent `SESSION_SECRET` and `RATE_LIMIT_SECRET` values. Then run:

```sh
docker compose up --build -d
docker compose run --rm --build migrate
docker compose run --rm --build migrate pnpm admin:create admin "a-long-unique-password"
```

Place a TLS-terminating reverse proxy in front of port 3000. Configure request-size and connection-rate limits there as a first layer; the application also limits anonymous submissions and moderator logins.

Health checks:

- `/api/health` confirms the application process is running.
- `/api/ready` confirms PostgreSQL is reachable.

## Operations

All moderator accounts can edit, reorder, and delete catalog content. Administrators additionally manage accounts and can inspect or revert changes at `/moderation/history`. The catalog audit log stores only affected rows (and only changed fields for updates); audit records are append-only, and a revert is recorded as a new change.

Back up the database:

```sh
docker compose exec -T db pg_dump -U diachronica -d diachronica -Fc > diachronica.backup
```

Restore into an empty database using `pg_restore`. Test restores away from production before relying on a backup.

For an upgrade, back up PostgreSQL, pull the new source, rebuild the images, run the one-shot `migrate` service, and then restart `app`. Database migrations are version-controlled in `drizzle/` and are never generated at application startup.

Run `pnpm maintenance:purge` on a schedule to remove expired sessions and rate-limit buckets.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Licensing

Application code is AGPL-3.0-only. Database content is CC BY-SA 4.0. See `LICENSE` and `DATA_LICENSE`.
