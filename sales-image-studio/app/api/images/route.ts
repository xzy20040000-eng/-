import { env } from "@/lib/platform-env";
import { getRequestUser } from "../../../lib/phone-auth";
import { TEMPLATES } from "../../../lib/poster-templates";
import { stagedAsset, transferAsset } from "../../../lib/staged-uploads";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "请先登录" }, 401);
  if (!env.DB) return json({ error: "数据库未连接" }, 503);
  const result = await env.DB.prepare("SELECT id, title, template_id AS templateId, address, event_time AS eventTime, status, created_at AS createdAt, updated_at AS updatedAt FROM images WHERE user_id = ? ORDER BY updated_at DESC").bind(user.id).all();
  return json({ items: result.results });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "请求来源无效" }, 403);
  const user = await getRequestUser(request);
  if (!user) return json({ error: "请先登录" }, 401);
  if (!env.DB || !env.BUCKET) return json({ error: "存储服务未连接" }, 503);
  const form = await request.formData();
  const title = String(form.get("title") || "").trim().slice(0, 80);
  const address = String(form.get("address") || "").trim().slice(0, 240);
  const eventTime = String(form.get("eventTime") || "").trim().slice(0, 100);
  const templateId = String(form.get("templateId") || "").trim();
  const logoUploadId = String(form.get("logoUploadId") || "");
  const qrUploadId = String(form.get("qrUploadId") || "");
  const imageUploadId = String(form.get("imageUploadId") || "");
  if (!title || !address || !eventTime || !TEMPLATES.some(template => template.id === templateId) || !logoUploadId || !imageUploadId) return json({ error: "请完整填写信息并上传 Logo 和 JPG 海报" }, 400);
  const [logo, image, qr] = await Promise.all([stagedAsset(user.id, logoUploadId, "logo"), stagedAsset(user.id, imageUploadId, "image"), qrUploadId ? stagedAsset(user.id, qrUploadId, "qr") : Promise.resolve(null)]);
  if (!logo || !image || (qrUploadId && !qr)) return json({ error: "素材上传已失效，请重新生成" }, 400);
  const id = crypto.randomUUID();
  const prefix = `images/${user.id}/${id}`;
  await transferAsset(user.id, logoUploadId, "logo", `${prefix}/logo`);
  if (qrUploadId) await transferAsset(user.id, qrUploadId, "qr", `${prefix}/qr`);
  await transferAsset(user.id, imageUploadId, "image", `${prefix}/image`);
  const now = new Date().toISOString();
  await env.DB.prepare("INSERT INTO images (id, user_id, title, template_id, address, event_time, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, user.id, title, templateId, address, eventTime, qrUploadId ? "complete" : "pending_qr", now, now).run();
  return json({ id, status: qrUploadId ? "complete" : "pending_qr" }, 201);
}
