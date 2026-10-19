import { env } from "@/lib/platform-env";
import { authIpHash, createSession, normalizePhone, passwordHash, randomToken, sameOrigin } from "../../../../lib/phone-auth";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "请求来源无效" }, 403);
  if (!env.DB) return json({ error: "数据库暂时不可用" }, 503);
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: "请求格式有误" }, 400); }
  const phone = normalizePhone(String((input as { phone?: unknown })?.phone ?? ""));
  const password = String((input as { password?: unknown })?.password ?? "");
  if (!phone || password.length < 8 || password.length > 128) return json({ error: "请输入有效手机号，密码须为 8 至 128 位" }, 400);
  const ipHash = await authIpHash(request);
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM auth_attempts WHERE ip_hash = ? AND kind = 'register' AND created_at > ?").bind(ipHash, hourAgo).first<{ count: number }>();
  if ((recent?.count ?? 0) >= 10) return json({ error: "注册次数过多，请稍后再试" }, 429);
  await env.DB.prepare("INSERT INTO auth_attempts (id, phone, ip_hash, kind, created_at) VALUES (?, ?, ?, 'register', ?)").bind(crypto.randomUUID(), phone, ipHash, new Date().toISOString()).run();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE phone = ?").bind(phone).first();
  if (existing) return json({ error: "该手机号已注册，请直接登录" }, 409);
  const id = crypto.randomUUID();
  const salt = randomToken();
  try { await env.DB.prepare("INSERT INTO users (id, phone, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, phone, salt, await passwordHash(password, salt), new Date().toISOString()).run(); }
  catch { return json({ error: "注册失败，请稍后重试" }, 500); }
  return json({ ok: true }, 201, { "Set-Cookie": await createSession(id, request) });
}
