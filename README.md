# rowstile starter: Next.js and Prisma

Documents that people share with each other and with teams, in a Next.js app (App Router) on Prisma. There
is no permission check in the app's code. Who may see and change a document is written in one file,
[`db/policy.authz`](db/policy.authz), which [rowstile](https://rowstile.dev) compiles into Postgres row-level
security: the database filters every read and refuses every write the rules don't allow.

## Run it

    docker compose up --build

That starts Postgres, runs the migrations (the tables, then the policy) and serves the app on
<http://localhost:3000>. Three people are there: ann, bo and cy, and cy is in the team "writers".

1. Sign in as **ann** and create a document.
2. Sign in as **bo**: the list is empty. The document isn't hidden by the page; Postgres doesn't return it.
3. As ann, share it with bo as a **viewer**. Bo now sees it. When he renames it, the database refuses, and
   the page shows the rule and what was missing.
4. As ann, share it with the team **writers** as **editor**. Cy, a member, renames it.

## What is where

| | |
|---|---|
| [`db/policy.authz`](db/policy.authz) | the rules: who owns, who may share, what a viewer and an editor may do |
| [`db/tests/sharing.authz`](db/tests/sharing.authz) | the rules' tests: each brings its own rows and is rolled back |
| [`src/db.ts`](src/db.ts) | Prisma, signed in as the request's user on every transaction |
| [`app/page.tsx`](app/page.tsx), [`app/actions.ts`](app/actions.ts) | the page and its forms, with no checks in them |
| [`prisma/`](prisma/) | the tables, and Prisma's migrations; the policy is one of them |
| [`rowstile.toml`](rowstile.toml) | where the policy, its tests and its migrations are |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | the tests, and on a pull request a comment that says who gains or loses access |

Two roles connect to the database. `starter_owner` owns the tables and runs the migrations: its URL is
`ROWSTILE_OWNER_DSN`, which Prisma uses. The app connects as `starter_app` (`ROWSTILE_APP_URL`), which
row-level security applies to. Never give the app the owner's URL: row-level security doesn't apply to a
table's owner.

## Change the rules

You need Node 22 or later. With the containers up:

    npm install
    export ROWSTILE_OWNER_DSN=postgresql://starter_owner:owner@localhost:15432/starter
    export ROWSTILE_APP_URL=postgresql://starter_app:app@localhost:15432/starter
    npx rowstile push --development   # once: migrations set this database up, so say it is a development one
    npx rowstile dev                  # on every save: check, apply to this database, run the tests

Edit `db/policy.authz` (say, let an editor share: `can share = owner or editor`) and watch `rowstile dev` say
which tests now fail. When the change is what you want:

    npx rowstile migrate              # writes the next Prisma migration, from db/policy.lock
    npm test                          # the app's own tests (npx prisma generate first, once)

`rowstile dev` changes this database directly, which is fine on your laptop, and it then already holds what
the new migration brings. So on this database `npx prisma migrate deploy` stops at that migration (AZ607):
tell Prisma it is applied, `npx prisma migrate resolve --applied <the new migration's folder>`. Any other
database takes migrations only. To start over, `docker compose down -v`.

## Make it yours

- **Who the request is.** `requestUser` in `src/db.ts` believes a cookie that anyone can set, and the page's
  "Signed in as" writes it. Replace both with your session before anyone else can reach the app.
- **The passwords** in `docker-compose.yml`, `docker/init.sql` and the first migration are for a laptop.
- **The people and the team** are made by the first migration, for the walk above. Delete those lines.
- **Your tables.** Add them to `prisma/schema.prisma`, write their migration (with their grants to
  `starter_app`), then give them a type and rules in the policy. A table without rules is readable by the
  app in full; `npx rowstile lint` lists them.

rowstile is a 0.x preview: its language and its functions may still change before 1.0, and nobody outside
the project has audited it ([how it is checked](https://rowstile.dev/how-it-is-checked)). The docs:
[Next.js and Prisma](https://rowstile.dev/stacks/nextjs), [the policy language](https://rowstile.dev/reference/language),
[the cookbook](https://rowstile.dev/cookbook/).

This starter is yours to take and change: [Apache-2.0](LICENSE).
