// POST /api/lead: saves one lead from the "Get My Offer" form.
// One row per submit, keyed by a random id made in the browser (a double press updates the same row).
import { P, pipeline, cleanPhone, cleanEmail, cleanText, clientIp } from "./_lib.js";

const COURSES = ["Project Management", "SAFe & Agile", "Generative AI", "IT Service Management", "All courses", "Not sure yet"];

export default async function handler(req, res) {
  // a copy of the page on another host (e.g. knowledgehut.com) posts here cross-site with a text/plain body and no cookies
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = typeof req.body === "string" ? safeJson(req.body) || {} : req.body || {};
  const id = String(b.id || "");
  if (!/^[a-z0-9-]{16,40}$/i.test(id)) return res.status(400).json({ error: "bad id" });

  const name = cleanText(b.name, 80), phone = cleanPhone(b.phone), email = cleanEmail(b.email);
  const course = COURSES.includes(b.course) ? b.course : "";
  if (name.length < 2 || !phone || !email || !course) return res.status(400).json({ error: "name, mobile, email and course are needed" });

  try {
    // light abuse guard: 60 writes per IP per fixed 60 s window
    const rl = `${P}rl:${clientIp(req)}`;
    const [, n] = await pipeline([["SET", rl, 0, "EX", 60, "NX"], ["INCR", rl]]);
    if (n > 60) return res.status(429).json({ error: "too many requests" });

    const [prevRaw] = await pipeline([["HGET", `${P}leads`, id]]);
    const prev = prevRaw ? safeJson(prevRaw) || {} : {};
    const now = new Date().toISOString();
    const row = {
      id, created: prev.created || now, updated: now,
      name, phone, email, course,
      source: prev.source || cleanText(b.source, 400), // the landing link's query string: UTM tags, fbclid, gclid
      ref: prev.ref || cleanText(b.ref, 200),          // the referring page
      site: prev.site || siteOf(req),
      device: prev.device || (/Mobi|Android|iPhone/i.test(String(req.headers["user-agent"] || "")) ? "mobile" : "desktop"),
    };
    await pipeline([
      ["HSET", `${P}leads`, id, JSON.stringify(row)],
      ["ZADD", `${P}leads:idx`, Date.parse(row.created), id],
    ]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "could not save" });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

// which copy of the page the lead came from, from the browser's Origin / Referer
function siteOf(req) {
  for (const h of [req.headers.origin, req.headers.referer]) {
    try { if (h && h !== "null") return cleanText(new URL(h).host, 80); } catch {}
  }
  return "";
}
