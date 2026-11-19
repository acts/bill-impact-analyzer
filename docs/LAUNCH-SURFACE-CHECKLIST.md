# Launch Surface Checklist — Bill Impact Analyzer

Quiet personal tool (D-2): most public-launch items are deliberately not done. If anyone else starts using it, this file is void and the full checklist applies first.

## Identity & domain
- [x] Real domain — **N/A by decision D-2** (stays on `vercel.app`)
- [ ] HTTPS everywhere; HSTS present — HSTS set; verify on production
- [ ] Favicon — not needed (quiet tool)

## Metadata & sharing
- [x] `<title>` descriptive: "Bill Impact Analyzer — IT workload worksheet for California bills"
- [x] Meta description accurate ("Stores nothing.")
- [x] OG image / Twitter card / structured data — **N/A by D-2**

## Findability & routing honesty
- [x] sitemap.xml — **N/A by D-2**
- [x] robots.txt disallows all; `X-Robots-Tag: noindex` on every response
- [x] Nonsense URL returns a real 404 with a link to the analyzer (verified locally)
- [x] No legacy URLs

## Legal & trust surface
- [x] Privacy policy / terms — **N/A** while single-user; home page states "What this tool stores: nothing"
- [x] Contact path — N/A (single user)
- [x] Pricing — none shown

## Technical surface
- [ ] Security headers verified by GET on production, dated output filed
- [x] Public pages edge-cached — N/A: one dynamic page (nonce CSP requires dynamic rendering); `/api/bill` responses are edge-cached
- [x] Analytics — declined (S-4, D-2)
- [ ] Performance spot-check on production
- [x] Accessibility: axe zero critical/serious on `/` and 404 (local); human screen-reader pass — not required for a quiet single-user tool

## The mirror test
- [x] Home page says what it is, that it stores nothing, and that output is a draft for analyst review
- [x] Every claim on the page is true today
