"use server";
// The page's forms. No permission check here: Postgres refuses what the rules don't allow, action() gives
// the refusal back as a value (Next.js hides a thrown error's message), and the page shows it.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { action } from "@rowstile/next";
import { db } from "@/db";

/** Runs a form's work, keeps what the database said if it refused, and shows the page again. */
async function run(work: () => Promise<unknown>): Promise<void> {
  const result = await action(work)();
  const jar = await cookies();
  if (result.ok) jar.delete("refused");
  else jar.set("refused", JSON.stringify({ detail: result.problem.detail, why: result.problem.why ?? [] }), { maxAge: 20 });
  revalidatePath("/");
}

/** The placeholder sign-in: a cookie with the user's id. Replace it with your own. */
export async function signInAs(form: FormData): Promise<void> {
  const jar = await cookies();
  const user = String(form.get("user") ?? "");
  if (user) jar.set("user", user);
  else jar.delete("user");
  jar.delete("refused");
  revalidatePath("/");
}

export async function createDocument(form: FormData): Promise<void> {
  const owner = Number((await cookies()).get("user")?.value ?? 0);
  await run(() => db.document.create({ data: { owner_id: owner, title: String(form.get("title") || "Untitled") } }));
}

export async function renameDocument(form: FormData): Promise<void> {
  await run(() => db.document.update({ where: { id: Number(form.get("id")) }, data: { title: String(form.get("title")) } }));
}

export async function removeDocument(form: FormData): Promise<void> {
  await run(() => db.document.delete({ where: { id: Number(form.get("id")) } }));
}

/** Shares a document with a person ("user:2") or with a team's members ("team:10"), as a viewer or an editor. */
export async function shareDocument(form: FormData): Promise<void> {
  const [kind, id] = String(form.get("with")).split(":");
  const relation = form.get("relation") === "editor" ? "editor" : "viewer";
  await run(() => db.$authz.share("document", Number(form.get("id")), relation, kind === "team" ? "team" : "user", id,
    kind === "team" ? "member" : ""));
}
