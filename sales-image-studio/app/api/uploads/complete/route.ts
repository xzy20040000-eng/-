import { env } from "@/lib/platform-env";
import { getRequestUser } from "../../../../lib/phone-auth";
import { stageKey, stagePartKey, type AssetKind } from "../../../../lib/staged-uploads";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "请求来源无效" }, { status: 403 });
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const bucket = env.BUCKET;
  if (!bucket) return Response.json({ error: "存储服务未连接" }, { status: 503 });
  const input = await request.json().catch(() => null) as { uploadId?: string; total?: number; kind?: AssetKind; type?: string } | null;
  const { uploadId, total, kind, type } = input || {};
  if (!uploadId || !/^[0-9a-f-]{36}$/i.test(uploadId) || !Number.isInteger(total) || total! < 2 || total! > 4 || !kind || !["logo","qr","image"].includes(kind) || !type || (kind === "image" ? type !== "image/jpeg" : !["image/png","image/jpeg","image/webp"].includes(type))) return Response.json({ error: "上传信息无效" }, { status: 400 });
  const parts = await Promise.all(Array.from({ length: total! }, (_, part) => bucket.get(stagePartKey(user.id,uploadId,kind,part))));
  if (parts.some(part => !part)) return Response.json({ error: "上传分片不完整，请重试" }, { status: 400 });
  const chunks = await Promise.all(parts.map(async part => new Uint8Array(await new Response(part!.body).arrayBuffer())));
  const length = chunks.reduce((sum,chunk) => sum + chunk.length, 0);
  if (length > 12_000_000) return Response.json({ error: "单张图片不得超过 12 MB" }, { status: 413 });
  const merged = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk,offset); offset += chunk.length; }
  await bucket.put(stageKey(user.id,uploadId,kind),merged.buffer,{ httpMetadata: { contentType: type } });
  await Promise.all(chunks.map((_,part) => bucket.delete(stagePartKey(user.id,uploadId,kind,part))));
  return Response.json({ uploadId });
}
