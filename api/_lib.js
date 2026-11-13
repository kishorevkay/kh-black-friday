// Shared helpers for the KH Black Friday lead capture.
//
// Storage is Upstash Redis over its REST API (plain fetch, no SDK).
// ⚠️ The database is SHARED with the Diwali AI Badhaai Box (`badhai:` keys). Every key here is
// namespaced under `khbf:`. Never run FLUSHDB / FLUSHALL against it.
//   khbf:leads      hash   id → lead JSON
//   khbf:leads:idx  zset   id scored by created time (newest first in the admin)
//   khbf:rl:<ip>    string per-IP write counter, expires after 60 s

import { memPipeline } from "./_mem.js";

const REST_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const isDeployed = ["production", "preview"].includes(process.env.VERCEL_ENV || "");

export const P = process.env.KHBF_PREFIX || "khbf:";

export async function pipeline(commands) {
  if (!commands.length) return [];
  if (!(REST_URL && REST_TOKEN)) {
    if (isDeployed) throw new Error("No database configured: set KV_REST_API_URL and KV_REST_API_TOKEN.");
    return memPipeline(commands); // local dev only
  }
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return (await res.json()).map((e) => {
    if (e.error) throw new Error(`Upstash command failed: ${e.error}`);
    return e.result;
  });
}

// KH sells outside India too, so any 7 to 15 digit number passes, with or without a leading +.
export function cleanPhone(v) {
  const s = String(v || "").trim();
  const d = s.replace(/\D/g, "");
  return /^\d{7,15}$/.test(d) ? (s.startsWith("+") ? "+" : "") + d : "";
}
export function cleanEmail(v) {
  const e = String(v || "").trim().toLowerCase().slice(0, 120);
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e) ? e : "";
}
export function cleanText(v, max) {
  return String(v || "").replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
}
