# upGrad KnowledgeHut · Black Friday Sale 2026

The landing page for upGrad KnowledgeHut's Black Friday Sale (goes live Monday 16 November 2026): up to 70% off on courses, plus the Ultimate Skills Toolkit with eligible enrolments.

- **Live site:** https://blackfridaykh.vercel.app
- **Leads dashboard:** https://blackfridaykh.vercel.app/admin (PIN-protected; ask the marketing team for the PIN)

> **For the tech team: leads are already being captured.** Every visitor who submits the "Get My Offer" form is saved to the database and shows up live in `/admin`, with name, mobile, email, the course area they picked and the campaign source (UTM). The dashboard exports everything as CSV. **This keeps working when you host the page on upgrad.com**: the form posts to the API on Vercel from any host, so you only need to copy the static files. Details below.

---

## What's in here

A plain static page plus two serverless functions. No framework, no build step, no npm dependencies.

| Path | What it is |
|---|---|
| `index.html` | The whole page: hero with the Black Friday pass, the lead form pop-up, the four course areas, the 7-course Ultimate Skills Toolkit (`#toolkit`), the 4 free self-paced courses (`#self-paced`), FAQs, final call to action. **All copy, course names and course links live here.** |
| `styles.css` | All styles. Phone first; desktop layout from 900 px. |
| `app.js` | The hero: the "Close the Gap" word wall that slides with the scroll, the swinging pass, the countdown. |
| `page.js` | The lead form (validation, pop-up, sending the lead), the offer buttons, the scroll-linked word strips. |
| `device.js` | "Desktop view / Mobile view" tabs for reviewers. Only runs on `localhost` and `*.vercel.app`; it does nothing on any other host. |
| `admin.html` | The leads dashboard at `/admin`. |
| `api/lead.js` | `POST /api/lead`: saves a lead. |
| `api/admin.js` | `GET /api/admin`: returns all leads (needs the admin PIN). |
| `api/_lib.js`, `api/_mem.js` | Redis helper (Upstash REST, plain `fetch`) and an in-memory store for local dev. |
| `assets/` | Logos, course badges, icons (WebP / SVG), the #CloseTheGap unit, the link-preview image `og.jpg`, favicons. |
| `favicon.ico`, `apple-touch-icon.png` | Favicons that browsers ask for at the site root. |
| `vercel.json` | Region `bom1` (Mumbai, next to the database), security headers, `noindex` on `/admin` and `/api`. |

## Hosting the page on upgrad.com

1. Copy these to the page's folder, keeping the structure: `index.html`, `styles.css`, `app.js`, `page.js`, `device.js`, `assets/`, `favicon.ico`, `apple-touch-icon.png`.
   Every path in the page is relative, so it works from a sub-path (for example `/black-friday/`).
2. **Do not copy** `api/`, `admin.html` or `vercel.json`. The lead API and the dashboard stay on Vercel.
3. In `index.html`, change the three link-preview addresses to the final page address: `og:url`, `og:image` and `twitter:image`.
4. Serve the page with a trailing slash, or make sure a redirect from the no-slash address **keeps the query string**. Otherwise UTM tags are lost before the page loads and every lead shows as "Direct / unknown".
5. Favicons: browsers also ask for `/favicon.ico` at the domain root, whatever the page declares. On upgrad.com that will be upGrad's own icon, which is fine.

Nothing else needs to change. When you tell us the final address, we will send one test lead from it and confirm it reaches the dashboard.

## How lead capture works

The form opens as a pop-up: by itself 3 seconds after landing (once per visit), and from every "Get My Offer", "Explore Offer" and "Help Me Choose" button. "Explore Offer" pre-selects that tile's course area.

Fields: **Full Name, Mobile Number, Email Address, Country** (a dropdown, added 18 Nov; sent as `countryChosen`, the ISO code), **Course**, plus a **marketing-communications consent tick** (required, unticked by default; added 16 Nov at KH's request). The Course list is: Project Management, SAFe & Agile, Generative AI, IT Service Management, Not sure yet. (The API also still accepts "All courses", which the form offered for a few hours on 13 November.)

On submit the page sends one `POST` to `/api/lead` (on other hosts: `https://blackfridaykh.vercel.app/api/lead`) with a `text/plain` JSON body, so no CORS preflight is needed:

```json
{ "id": "<random id made in the browser>", "name": "…", "phone": "…", "email": "…", "course": "…", "consent": true, "consentAt": "<ISO time the box was ticked>", "countryChosen": "IN", "source": "?utm_source=…", "ref": "<referring page>" }
```

The API validates it again, rate-limits per IP (60 a minute), and stores:

`id`, `created`, `updated`, `name`, `phone`, `email`, `course`, `consent` (true/false) and `consentAt` (kept only if it is not in the future or over a day old, else server time), `source` (the landing link's query string: UTM tags, `fbclid`, `gclid`), `ref`, `site` (which copy of the page sent it, for example `www.upgrad.com` or `blackfridaykh.vercel.app`), `device` (`mobile` / `desktop`), and from 18 Nov `country` (ISO code, e.g. `IN`), `region` and `city`: the visitor's location from Vercel's IP lookup (approximate; VPNs and mobile networks can show a nearby city). Leads saved before that show "Not recorded".

One lead per page load: a double press or a retry updates the same row. Leads that arrive WITHOUT consent (from a copy of the page published before 16 Nov, which has no tick box) are still saved, with `consent: false`, so no lead is lost; the dashboard shows Yes / No.

### The dashboard

`/admin` asks for the PIN, then shows: total leads, today's leads, a count per course, leads from ads, leads from India and from outside India, a search box, filters by course, by source and by country, the table (with a Country column: flag, country, city), and **Download CSV** (exports what the filters show, including country, state and city). It refreshes every 30 seconds.

"Came from" is worked out from the UTM tags, ad click ids and the referring site. To track a campaign, add UTM tags to the link, for example:

```
https://blackfridaykh.vercel.app/?utm_source=instagram&utm_medium=paid&utm_campaign=bf2026
```

### Storage

Upstash Redis over REST. All keys are under the prefix `khbf:`:

| Key | Type | Holds |
|---|---|---|
| `khbf:leads` | hash | lead id → lead JSON |
| `khbf:leads:idx` | sorted set | lead ids by created time |
| `khbf:rl:<ip>` | string | per-IP write counter, expires after 60 s |

The database is shared with another upGrad campaign (keys under `badhai:`). **Never run `FLUSHDB` or `FLUSHALL` on it.** Delete single leads with `HDEL khbf:leads <id>` and `ZREM khbf:leads:idx <id>`.

### Environment variables (Vercel project `blackfriday_kh`)

| Name | What it is |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis REST address and token |
| `ADMIN_PIN` | The dashboard PIN |

None of these are in this repository. Ask the marketing team.

## Editing the page

- **Copy, course names, course links, FAQs, the toolkit "Bonus" card in the hero, the consent sentence and the disclaimer:** `index.html`. The disclaimer is word for word from KH's email of 16 Nov; its two links (Refund Policy, T&Cs) are the email's own links. Do not edit it without KH legal.
- **The countdown:** the "countdown" section of `app.js` (schedule changed by KH on 17 Nov). All times are India time.
  - Until the end of 24 November, "Ends in" counts down to 24 Nov 11:59:59 PM (`SALE_END`).
  - 25 to 30 November: a red "Sale extended till 30 Nov" tag sits on the timer, and the timer counts down to 30 Nov 11:59:59 PM (`EXT_END`).
  - `DAY_MSG` holds the three closing lines, shown on 28, 29 and 30 November.
  - From 1 December (`TIMER_OFF_FROM`) the timer, the tag and the line are hidden. The rest of the page stays as it is.
  - Add `?date=2026-11-29` to the link to preview any day (at 10 AM), or `?date=2026-11-24T23:59:50` for an exact moment.
- **Course list in the form:** the `<select id="fCourse">` in `index.html`, the `COURSES` list in `api/lead.js`, and the `COURSES` list plus the course filter in `admin.html`. Keep the three in step, or the API will reject the new value.
- **Pop-up delay:** `POP_DELAY` in `page.js` (milliseconds).
- After changing `styles.css`, `app.js`, `page.js` or `device.js`, bump the `?v=` number on its tag in `index.html` so browsers fetch the new file.

Logos and badges in `assets/logos/` are the official files from knowledgehut.com, resized. Third-party marks (PMI, PRINCE2, SAFe, ITIL) must not be redrawn or regenerated. The PMI-CPMAI badge was supplied by the KH team on 16 Nov.

## Running it locally

The page itself (no lead saving; the form shows a "preview only" note):

```bash
python3 -m http.server 5260
```

then open http://localhost:5260. With the API as well, use the Vercel CLI (`vercel dev`); without the Redis variables it falls back to an in-memory store.

## Deploying to Vercel

```bash
npx vercel deploy --prod
```

## Legal pieces on the page (from KH, 16 Nov)

- The consent tick in the form, the age FAQ and the disclaimer at the bottom (Refund Policy and T&Cs links).
- "Our Privacy Policy" (https://www.knowledgehut.com/privacy-policy) and the © line under the disclaimer.
