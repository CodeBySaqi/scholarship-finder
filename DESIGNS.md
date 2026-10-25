# Five home-page designs — pick one

Live previews (marketing URLs, nothing links to them yet):

- Gallery: **/design**
- Direct: **/design/split** · **/design/bento** · **/design/aurora** · **/design/app** · **/design/minimal**

The live home page at **/** is untouched until you choose. Every design uses the
same public header, the same footer, the same HeroUI components and the same live
API data (`/public/stats` + the newest verified listing), so you are comparing
layout and tone, not content.

## 1 · Split editorial — `/design/split`
Big statement left, newest verified listing card right, four stat cards under it,
then "How it works" and recently verified rows, closing with a gradient honesty band.
**Best when:** the headline should carry the page and the product should feel editorial and calm.
**Watch out:** the most "website-like" of the five; least product feel.

## 2 · Bento grid — `/design/bento`
A six-column mosaic: headline tile 4×2, count tiles on the right, newest check,
a six-month deadline bar chart, the three verdicts, the three steps, recent rows and
a "what we never do" tile.
**Best when:** you want density — a lot of live numbers visible without scrolling.
**Watch out:** busiest layout; needs care on a small laptop.

## 3 · Dark aurora — `/design/aurora`
Dark radial-gradient hero with glow blobs, one glass card row (newest listing + two
counts), then a light body with verdict cards, steps and a dark CTA card.
**Best when:** you want the page to feel premium and distinct from every DAAD-lookalike.
**Watch out:** the only dark design; the contrast between dark hero and light body is a commitment.

## 4 · Product preview — `/design/app`
The hero shows the actual product in a mocked browser window — mini tabs,
three verdict rows, per-requirement list, deadline chart — with three promises beside it,
a three-step strip and a tinted CTA band.
**Best when:** "show, don't tell" — students should see the verdict screen before signing up.
**Watch out:** the mock has to keep matching the real UI as the product changes.

## 5 · Minimal type — `/design/minimal`
Kicker, one headline, one primary button, a rule-separated four-fact row, a
"what it does / what it never does" two-column list, plain recent-check rows, closing CTA.
**Best when:** trust and clarity matter more than decoration; fastest to scan on a phone.
**Watch out:** least visual "wow"; sells nothing with imagery.

## What every design keeps (non-negotiable)
Three verdicts only — Eligible / Not eligible / Check manually — never hidden, reasons
always attached, "screening is not admission" stated, unknown reported as unknown,
90-day recheck window, no paid ranking, no passport or bank details, no invented
CGPA/ECTS/deadline figures.

## How to choose
1. Open `/design`, click a card, then flip between them with the bar at the bottom.
2. Press **Use this design** on the one you want; it is stored in this browser.
3. Tell me the number and I will wire it into `/`, keep the other four behind
   `/design` (or delete them, your call), and re-run the full audit.

## Verification on this build
- `audit/run-dom.sh design` — 77/77 (each page: one h1, header nav, footer, disclaimer,
  verdict vocabulary, no match %, live counts, picker state, stored choice, unknown slug
  redirects, and `/` still free of the picker).
- `smoke` all routes clean · `heroui` 41/41 · `responsive` 83/83 · `responsive-css` 34/34.
- Live: /design plus all five previews render 5/5 with 0 console errors at 1440 px,
  390×844, 768×1024 and 1024×800 (no horizontal overflow at any width).
