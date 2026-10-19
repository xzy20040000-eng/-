import { env } from "@/lib/platform-env";
import { getRequestUser } from "../../../../lib/phone-auth";
import { TEMPLATES } from "../../../../lib/poster-templates";
import { stagedAsset, transferAsset } from "../../../../lib/staged-uploads";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function GET(request: Request, context: Context) {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "请先登录" }, 401);
  if (!env.DB) return json({ error: "数据库未连接" }, 503);
  const { id } = await context.params;
  const row = await env.DB.prepare("SELECT id, title, template_id AS templateId, address, event_time AS eventTime, status, created_at AS createdAt, updated_at AS updatedAt FROM images WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  return row ? json(row) : json({ error: "记录不存在" }, 404);
}

export async function PUT(request: Request, context: Context) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "请求来源无效" }, 403);
  const user = await getRequestUser(request);
  if (!user) return json({ error: "请先登录" }, 401);
  if (!env.DB || !env.BUCKET) return json({ error: "存储服务未连接" }, 503);
  const { id } = await context.params;
  const existing = await env.DB.prepare("SELECT id FROM images WHERE id = ? AND user_id = ?").bind(id, user.id).first();
  if (!existing) return json({ error: "记录不存在" }, 404);
  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 80);
  const address = String(form.get("address") || "").trim().slice(0, 240);
  const eventTime = String(form.get("eventTime") || "").trim().slice(0, 100);
  const templateId = String(form.get("templateId") || "").trim();
  const logoUploadId = String(form.get("logoUploadId") || "");
  const qrUploadId = String(form.get("qrUploadId") || "");
  const imageUploadId = String(form.get("imageUploadId") || "");
  const removeQr = form.get("removeQr") === "1";
  if (!title || !address || !eventTime || !TEMPLATES.some(template => template.id === templateId) || !imageUploadId) return json({ error: "请完整填写信息并生成 JPG 海报" }, 400);
  const [image, logo, qr] = await Promise.all([stagedAsset(user.id, imageUploadId, "image"), logoUploadId ? stagedAsset(user.id, logoUploadId, "logo") : Promise.resolve(null), qrUploadId ? stagedAsset(user.id, qrUploadId, "qr") : Promise.resolve(null)]);
  if (!image || (logoUploadId && !logo) || (qrUploadId && !qr)) return json({ error: "素材上传已失效，请重新生成" }, 400);
  const prefix = `images/${user.id}/${id}`;
  await transferAsset(user.id, imageUploadId, "image", `${prefix}/image`);
  if (logoUploadId) await transferAsset(user.id, logoUploadId, "logo", `${prefix}/logo`);
  if (qrUploadId) await transferAsset(user.id, qrUploadId, "qr", `${prefix}/qr`);
  if (removeQr) await env.BUCKET.delete(`${prefix}/qr`);
  const hasQr = !removeQr && (Boolean(qrUploadId) || Boolean(await env.BUCKET.head(`${prefix}/qr`)));
  await env.DB.prepare("UPDATE images SET title = ?, template_id = ?, address = ?, event_time = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(title, templateId, address, eventTime, hasQr ? "complete" : "pending_qr", new Date().toISOString(), id, user.id).run();
  return json({ id, status: hasQr ? "complete" : "pending_qr" });
}
