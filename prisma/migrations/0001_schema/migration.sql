-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateTable
CREATE TABLE "app"."users" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."teams" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."team_members" (
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateTable
CREATE TABLE "app"."documents" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_user_id_idx" ON "app"."team_members"("user_id");

-- CreateIndex
CREATE INDEX "documents_owner_id_idx" ON "app"."documents"("owner_id");


-- The role the app connects as. Row-level security applies to it: it is not a superuser, does not bypass
-- row-level security, and owns no table. The owner (who runs this) makes it and may switch to it, which
-- rowstile's tests need. The password is for a laptop: change it anywhere else (ALTER ROLE ... PASSWORD).
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'starter_app') THEN
    CREATE ROLE starter_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD 'app';
  END IF;
END $$;
ALTER ROLE starter_app SET jit = off;
GRANT USAGE ON SCHEMA "app" TO starter_app;
GRANT SELECT ON ALL TABLES IN SCHEMA "app" TO starter_app;
GRANT INSERT, UPDATE, DELETE ON "app"."documents" TO starter_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA "app" TO starter_app;

-- people and a team to try it with (the README's walk uses them): delete these lines in your app
INSERT INTO "app"."users" VALUES (1, 'ann'), (2, 'bo'), (3, 'cy');
INSERT INTO "app"."teams" VALUES (10, 'writers');
INSERT INTO "app"."team_members" VALUES (10, 3);
