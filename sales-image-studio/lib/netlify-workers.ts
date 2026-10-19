// Netlify implementation of the small D1/R2 surface used by the app.
// next.config.ts aliases cloudflare:workers to this module only in Netlify builds.
import { getDatabase } from "@netlify/database";
import { getStore } from "@netlify/blobs";

function statement(sql: string, values: unknown[] = []) {
  const run = async () => {
    let index = 0;
    const query = sql.replace(/\?/g, () => `$${++index}`);
    return getDatabase().pool.query(query, values);
  };
  return {
    bind: (...next: unknown[]) => statement(sql,next),
    async first<T>() { const result = await run(); return (result.rows[0] || null) as T | null; },
    async all<T>() { const result = await run(); return { results: result.rows as T[] }; },
    async run() { await run(); return { success: true }; },
  };
}

function assets() { return getStore({ name: "sales-image-assets", consistency: "strong" }); }
const BUCKET = {
  async get(key: string) {
    const entry = await assets().getWithMetadata(key,{ type: "stream", consistency: "strong" });
    if (!entry) return null;
    return { body: entry.data, httpMetadata: { contentType: String(entry.metadata?.contentType || "application/octet-stream") } };
  },
  async head(key: string) { return assets().getMetadata(key,{ consistency: "strong" }); },
  async put(key: string, value: ArrayBuffer | ReadableStream | Blob | string, options?: { httpMetadata?: { contentType?: string } }) {
    const data = value instanceof ReadableStream ? await new Response(value).arrayBuffer() : value;
    await assets().set(key,data,{ metadata: { contentType: options?.httpMetadata?.contentType || "application/octet-stream" } });
  },
  async delete(key: string) { await assets().delete(key); },
};

export const env = { DB: { prepare: statement }, BUCKET };
