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
| `index.html` | The whole page: hero with the Black Friday pass, the lead form pop-up, the four course areas, FAQs, final call to action. **All copy, course names and course links live here.** |
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

Fields: **Full Name, Mobile Number, Email Address, Course**. The Course list is: Project Management, SAFe & Agile, Generative AI, IT Service Management, All courses, Not sure yet.

On submit the page sends one `POST` to `/api/lead` (on other hosts: `https://blackfridaykh.vercel.app/api/lead`) with a `text/plain` JSON body, so no CORS preflight is needed:

```json
{ "id": "<random id made in the browser>", "name": "…", "phone": "…", "email": "…", "course": "…", "source": "?utm_source=…", "ref": "<referring page>" }
```

The API validates it again, rate-limits per IP (60 a minute), and stores:

`id`, `created`, `updated`, `name`, `phone`, `email`, `course`, `source` (the landing link's query string: UTM tags, `fbclid`, `gclid`), `ref`, `site` (which copy of the page sent it, for example `www.upgrad.com` or `blackfridaykh.vercel.app`), `device` (`mobile` / `desktop`).

One lead per page load: a double press or a retry updates the same row.

### The dashboard

`/admin` asks for the PIN, then shows: total leads, today's leads, a count per course, leads from ads, a search box, filters by course and by source, the table, and **Download CSV** (exports what the filters show). It refreshes every 30 seconds.

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

- **Copy, course names, course links, FAQs:** `index.html`.
- **The countdown:** the "countdown" section of `app.js`.
  - `SALE_END` is the end of the 10-day countdown: 23:59:59 IST on 26 November 2026, so the timer reads "10 days" on launch day (16 Nov).
  - From 27 to 30 November the timer shows the hours left until midnight (India time) and starts again each day.
  - `DAY_MSG` holds the three closing lines, shown on 28, 29 and 30 November.
  - From 1 December (`TIMER_OFF_FROM`) the timer and its line are hidden. The rest of the page stays as it is, so the sale page keeps working without a countdown.
  - Add `?date=2026-11-29` to the link to preview any day.
- **Course list in the form:** the `<select id="fCourse">` in `index.html`, the `COURSES` list in `api/lead.js`, and the `COURSES` list plus the course filter in `admin.html`. Keep the three in step, or the API will reject the new value.
- **Pop-up delay:** `POP_DELAY` in `page.js` (milliseconds).
- After changing `styles.css`, `app.js`, `page.js` or `device.js`, bump the `?v=` number on its tag in `index.html` so browsers fetch the new file.

Logos and badges in `assets/logos/` are the official files from knowledgehut.com, resized. Third-party marks (PMI, PRINCE2, SAFe, ITIL) must not be redrawn or regenerated.

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

## Still open with the KnowledgeHut team

- A consent line and privacy / terms links for the form (none were supplied, so none are shown).
- The toolkit FAQ answer still carries the placeholder "[Insert confirmed toolkit contents and eligibility.]".
- An official badge for PMI-CPMAI (the page shows the PMI partner badge instead).
