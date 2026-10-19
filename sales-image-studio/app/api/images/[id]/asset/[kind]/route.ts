import { env } from "@/lib/platform-env";
import { getRequestUser } from "../../../../../../lib/phone-auth";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; kind: string }> };
export async function GET(request: Request, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!env.DB || !env.BUCKET) return new Response("Storage unavailable", { status: 503 });
  const { id, kind } = await context.params;
  if (!["logo", "qr", "image"].includes(kind)) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT id FROM images WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(`images/${user.id}/${id}/${kind}`);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
