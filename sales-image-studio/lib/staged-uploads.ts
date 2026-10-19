import { env } from "@/lib/platform-env";

export type AssetKind = "logo" | "qr" | "image";
const uploadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const stageKey = (userId: string, uploadId: string, kind: AssetKind) => `staged/${userId}/${uploadId}/${kind}`;
export const stagePartKey = (userId: string, uploadId: string, kind: AssetKind, part: number) => `${stageKey(userId,uploadId,kind)}.part.${part}`;
export async function stagedAsset(userId: string, uploadId: string, kind: AssetKind) {
  if (!uploadIdPattern.test(uploadId) || !env.BUCKET) return null;
  return env.BUCKET.get(stageKey(userId, uploadId, kind));
}
export async function transferAsset(userId: string, uploadId: string, kind: AssetKind, destination: string) {
  const staged = await stagedAsset(userId, uploadId, kind);
  if (!staged || !env.BUCKET) throw new Error(`${kind} 上传已失效，请重新选择文件`);
  const type = staged.httpMetadata?.contentType || "application/octet-stream";
  if (kind === "image" && type !== "image/jpeg") throw new Error("海报必须为 JPG");
  if (kind !== "image" && !["image/png", "image/jpeg", "image/webp"].includes(type)) throw new Error("Logo 或二维码格式不支持");
  await env.BUCKET.put(destination, staged.body, { httpMetadata: { contentType: type } });
  await env.BUCKET.delete(stageKey(userId, uploadId, kind));
}
