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

  // Marketing consent (added 16 Nov). The page requires the tick, but leads WITHOUT it are still saved
  // (consent: false): a copy of the page published before 16 Nov has no tick box, and its leads must not be lost.
  const consent = b.consent === true;
  // consentAt is the browser's clock; keep it only if it is plausible (not in the future, not over a day old), else use server time
  const tAt = typeof b.consentAt === "string" ? Date.parse(b.consentAt) : NaN, tNow = Date.now();
  const consentAt = consent && !isNaN(tAt) && tAt <= tNow + 60000 && tAt >= tNow - 86400000 ? new Date(tAt).toISOString() : "";

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
      consent: prev.consent || consent, consentAt: prev.consentAt || (consent ? consentAt || now : ""),
      source: prev.source || cleanText(b.source, 400), // the landing link's query string: UTM tags, fbclid, gclid
      ref: prev.ref || cleanText(b.ref, 200),          // the referring page
      site: prev.site || siteOf(req),
      device: prev.device || (/Mobi|Android|iPhone/i.test(String(req.headers["user-agent"] || "")) ? "mobile" : "desktop"),
      // where the visitor is, from Vercel's IP geolocation (added 18 Nov): works for every copy of the page, since they all post here
      ...geoOf(req, prev),
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

// country (ISO code, e.g. "IN"), state/region code and city of the visitor's IP, as Vercel's edge sees it.
// Approximate (VPNs and mobile networks can show a nearby city); the first submit's values are kept on a retry.
function geoOf(req, prev) {
  if (prev.country) return { country: prev.country, region: prev.region || "", city: prev.city || "" };
  const h = (k) => String(req.headers[k] || "");
  let city = h("x-vercel-ip-city");
  try { city = decodeURIComponent(city); } catch {}
  const country = h("x-vercel-ip-country").toUpperCase();
  return { country: /^[A-Z]{2}$/.test(country) ? country : "", region: cleanText(h("x-vercel-ip-country-region"), 8), city: cleanText(city, 60) };
}

// which copy of the page the lead came from, from the browser's Origin / Referer
function siteOf(req) {
  for (const h of [req.headers.origin, req.headers.referer]) {
    try { if (h && h !== "null") return cleanText(new URL(h).host, 80); } catch {}
  }
  return "";
}
