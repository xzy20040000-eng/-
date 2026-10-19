import { env } from "@/lib/platform-env";
import { headers } from "next/headers";

const COOKIE = "sis_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export type User = { id: string; phone: string };

export function normalizePhone(input: string): string | null {
  const clean = input.replace(/[\s()-]/g, "").replace(/^\+86/, "");
  return /^1[3-9]\d{9}$/.test(clean) ? clean : null;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

export async function passwordHash(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(pair => parseInt(pair, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 250_000 }, key, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}

export function equalHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

export async function createSession(userId: string, request: Request): Promise<string> {
  if (!env.DB) throw new Error("Database unavailable");
  const token = randomToken();
  const now = new Date();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(await sha256(token), userId, new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString(), now.toISOString()).run();
  return sessionCookie(token, request);
}

export async function authIpHash(request: Request): Promise<string> {
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-nf-client-connection-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "local";
  return sha256(`sales-image-studio:${ip}`);
}

function cookieToken(cookieHeader: string | null): string | null {
  const match = cookieHeader?.match(/(?:^|;\s*)sis_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] ?? null;
}

export async function getUserFromCookie(cookieHeader: string | null): Promise<User | null> {
  const token = cookieToken(cookieHeader);
  if (!token || !env.DB) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare("SELECT users.id AS id, users.phone AS phone FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(hash, new Date().toISOString()).first<User>();
  return row ?? null;
}

export async function getPageUser(): Promise<User | null> {
  const requestHeaders = await headers();
  return getUserFromCookie(requestHeaders.get("cookie"));
}

export async function getRequestUser(request: Request): Promise<User | null> {
  return getUserFromCookie(request.headers.get("cookie"));
}

export function sessionCookie(token: string, request: Request): string {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${THIRTY_DAYS}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function clearSessionCookie(request: Request): string {
  return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

export function getSessionToken(request: Request): string | null {
  return cookieToken(request.headers.get("cookie"));
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
