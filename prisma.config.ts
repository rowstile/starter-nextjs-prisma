import { defineConfig, env } from "prisma/config";

// Prisma migrates as the tables' owner. The app itself connects as starter_app (ROWSTILE_APP_URL, src/db.ts),
// which row-level security applies to.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("ROWSTILE_OWNER_DSN") },
});
