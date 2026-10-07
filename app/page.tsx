// The one page: the documents the signed-in user may see, each with what they may do to it. Nothing here
// checks a permission: the list is filtered by Postgres, and the buttons come from one question to it.
import { cookies } from "next/headers";
import { db } from "@/db";
import { createDocument, removeDocument, renameDocument, shareDocument, signInAs } from "./actions";

export default async function Home() {
  const jar = await cookies();
  const me = jar.get("user")?.value ?? "";
  const refused = jar.get("refused")?.value;
  const said = refused ? (JSON.parse(refused) as { detail: string; why: string[] }) : null;
  // people and teams are a directory here: the policy has no rules for them, so everyone reads them
  const [users, teams, documents] = await Promise.all([
    db.user.findMany({ orderBy: { id: "asc" } }),
    db.team.findMany({ orderBy: { id: "asc" } }),
    db.document.findMany({ orderBy: { id: "asc" } }),
  ]);
  const can = await db.$authz.permsOf("document", documents.map((d) => d.id));
  const name = (id: number) => users.find((u) => u.id === id)?.name ?? String(id);

  return (
    <main>
      <h1>Shared documents</h1>
      {/* data-user: who the page was rendered for (the page test waits for it) */}
      <form action={signInAs} data-user={me}>
        <label>
          Signed in as{" "}
          <select name="user" defaultValue={me} key={me}>
            <option value="">nobody</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>{" "}
        <button>Switch</button>
      </form>

      {said && (
        <pre role="alert">
          {said.detail}
          {"\n"}
          {said.why.join("\n")}
        </pre>
      )}

      <ul>
        {documents.map((d) => {
          const mine = can[String(d.id)] ?? [];
          return (
            <li key={d.id}>
              <form action={renameDocument}>
                <input type="hidden" name="id" value={d.id} />
                <input name="title" defaultValue={d.title} aria-label="title" />{" "}
                <button>Rename</button> <small>owner: {name(d.owner_id)}; you can: {mine.join(", ") || "nothing"}</small>
              </form>
              {mine.includes("share") && (
                <form action={shareDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  Share with{" "}
                  <select name="with">
                    {users.filter((u) => String(u.id) !== me).map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}
                    {teams.map((t) => <option key={t.id} value={`team:${t.id}`}>team {t.name}</option>)}
                  </select>{" "}
                  as{" "}
                  <select name="relation">
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>{" "}
                  <button>Share</button>
                </form>
              )}
              <form action={removeDocument}>
                <input type="hidden" name="id" value={d.id} />
                <button>Delete</button>
              </form>
            </li>
          );
        })}
      </ul>
      {documents.length === 0 && <p>No documents you may see.</p>}

      {me && (
        <form action={createDocument}>
          <input name="title" placeholder="A new document" aria-label="new title" /> <button>Create</button>
        </form>
      )}
    </main>
  );
}
