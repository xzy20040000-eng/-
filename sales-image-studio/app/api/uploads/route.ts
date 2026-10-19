import { env } from "@/lib/platform-env";
import { getRequestUser } from "../../../lib/phone-auth";
import { stageKey, stagePartKey, type AssetKind } from "../../../lib/staged-uploads";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!env.BUCKET) return Response.json({ error: "存储服务未连接" }, { status: 503 });
  const kind = request.headers.get("x-asset-kind") as AssetKind;
  const type = request.headers.get("content-type") || "";
  const allowed = kind === "image" ? type === "image/jpeg" : ["image/png", "image/jpeg", "image/webp"].includes(type);
  if (!(["logo", "qr", "image"] as string[]).includes(kind) || !allowed) return Response.json({ error: "素材格式不支持" }, { status: 400 });
  if (Number(request.headers.get("content-length") || 0) > 12_000_000) return Response.json({ error: "单张图片不得超过 12 MB" }, { status: 413 });
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 12_000_000) return Response.json({ error: "单张图片不得超过 12 MB" }, { status: 413 });
  const requestedId = request.headers.get("x-upload-id");
  const uploadId = requestedId || crypto.randomUUID();
  const part = Number(request.headers.get("x-upload-part"));
  const total = Number(request.headers.get("x-upload-total"));
  const chunked = requestedId !== null;
  if (chunked && (!/^[0-9a-f-]{36}$/i.test(uploadId) || !Number.isInteger(part) || !Number.isInteger(total) || total < 2 || total > 4 || part < 0 || part >= total || bytes.byteLength > 3_000_000)) return Response.json({ error: "上传分片无效" }, { status: 400 });
  await env.BUCKET.put(chunked ? stagePartKey(user.id, uploadId, kind, part) : stageKey(user.id, uploadId, kind), bytes, { httpMetadata: { contentType: type } });
  return Response.json({ uploadId });
}
