import { env } from "@/lib/platform-env";
import { authIpHash, createSession, equalHash, normalizePhone, passwordHash, sameOrigin } from "../../../../lib/phone-auth";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  if (!env.DB) return json({ error: "数据库暂时不可用" }, 503);
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: "请求格式有误" }, 400); }
  const phone = normalizePhone(String((input as { phone?: unknown })?.phone ?? ""));
  const password = String((input as { password?: unknown })?.password ?? "");
  if (!phone || !password || password.length > 128) return json({ error: "手机号或密码格式有误" }, 400);
  const ipHash = await authIpHash(request);
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE ip_hash = ? AND kind = 'failed_login' AND created_at > ?").bind(ipHash, hourAgo).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 30) return json({ error: "尝试次数过多，请稍后再试" }, 429);
  const user = await env.DB.prepare("SELECT id, password_salt AS passwordSalt, password_hash AS passwordHash FROM users WHERE phone = ?").bind(phone).first<{ id: string; passwordSalt: string; passwordHash: string }>();
  const candidate = await passwordHash(password, user?.passwordSalt || "00000000000000000000000000000000");
  if (!user || !equalHash(candidate, user.passwordHash)) {
    await env.DB.prepare("INSERT INTO auth_attempts (id, phone, ip_hash, kind, created_at) VALUES (?, ?, ?, 'failed_login', ?)").bind(crypto.randomUUID(), phone, ipHash, new Date().toISOString()).run();
    return json({ error: "手机号或密码错误" }, 401);
  }
  return json({ ok: true }, 200, { "Set-Cookie": await createSession(user.id, request) });
}
