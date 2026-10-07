// The app's data layer against the migrated database (ROWSTILE_APP_URL): the README's walk, as a test.
// The policy has tests of its own, in db/tests/ (rowstile test). These are for the app's code on top of it.
import { afterAll, expect, test } from "vitest";
import { actingAs } from "@rowstile/client";
import { db, pool } from "@/db";

const ANN = "1", BO = "2", CY = "3"; // cy is in the team "writers" (10)

afterAll(() => pool.end());

test("a document is shared with a person and with a team", async () => {
  const doc = await actingAs(ANN, () => db.document.create({ data: { owner_id: 1, title: "Plan" } }));
  try {
    // it is ann's: for bo it isn't there
    expect(await actingAs(BO, () => db.document.findMany({ where: { id: doc.id } }))).toEqual([]);
    await expect(actingAs(BO, () => db.document.update({ where: { id: doc.id }, data: { title: "bo's" } })))
      .rejects.toBeNotFound();

    // shared with bo as a viewer: he reads it, and a change is refused, with the permission that was missing
    await actingAs(ANN, () => db.$authz.share("document", doc.id, "viewer", "user", 2));
    expect(await actingAs(BO, () => db.$authz.perms("document", doc.id))).toEqual(["view"]);
    await expect(actingAs(BO, () => db.document.update({ where: { id: doc.id }, data: { title: "bo's" } })))
      .rejects.toBeRefused("update", "document.edit");

    // shared with the writers as editors: cy, a member, changes it
    await actingAs(ANN, () => db.$authz.share("document", doc.id, "editor", "team", 10, "member"));
    await actingAs(CY, () => db.document.update({ where: { id: doc.id }, data: { body: "by cy" } }));
    expect((await actingAs(ANN, () => db.document.findUniqueOrThrow({ where: { id: doc.id } }))).body).toBe("by cy");

    // an editor may not delete it, and nobody signed in sees nothing
    await expect(actingAs(CY, () => db.document.delete({ where: { id: doc.id } }))).rejects.toBeRefused("delete");
    expect(await actingAs(null, () => db.document.findMany())).toEqual([]);
  } finally {
    await actingAs(ANN, () => db.document.delete({ where: { id: doc.id } }));
  }
});
