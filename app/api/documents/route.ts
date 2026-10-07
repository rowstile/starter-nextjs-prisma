// A route handler: the documents the request's user may see, as JSON. route() answers a refusal with 403 and
// a row the user can't see with 404, each with a problem body.
import { route } from "@rowstile/next";
import { db } from "@/db";

export const GET = route(async () => {
  const documents = await db.document.findMany({ select: { id: true, title: true }, orderBy: { id: "asc" } });
  return Response.json(documents);
});
