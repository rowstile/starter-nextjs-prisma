// The app's database: Prisma, signed in as the request's user on every transaction.
import { PrismaPg } from "@prisma/adapter-pg";
import { cookies } from "next/headers";
import pg from "pg";
import { authz, signedIn } from "@rowstile/prisma";
import "@rowstile/next";                              // signed-in reads never land in a cache
import { PrismaClient } from "./generated/prisma/client.ts";
import "./authz.gen.ts";                              // the policy's names: a wrong one doesn't type-check

/** Who the request is. THIS IS A PLACEHOLDER: it believes a cookie anyone can set. Read your session here
 *  instead (auth(), a verified token) and return the user's id, or null when nobody is signed in. */
export async function requestUser(): Promise<string | null> {
  return (await cookies()).get("user")?.value || null;
}

// the app's own connection, as the role the policy names (app role starter_app): never the owner's URL,
// which Prisma migrates with. Row-level security doesn't apply to a table's owner.
export const pool = new pg.Pool({ connectionString: process.env.ROWSTILE_APP_URL });
export const db = new PrismaClient({ adapter: signedIn(new PrismaPg(pool), { user: requestUser }) }).$extends(authz());
