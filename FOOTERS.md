# Footers

## Live now: the simple clean footer

`src/components/SiteFooter.jsx` renders a plain footer on every public page:
one hairline, the brand, the links people actually use (Scholarships,
Programmes, Matches, Saved, How it works, Log in, Privacy, Terms), one
**Create your profile** button, then the small print and © at the bottom.
No card, no glow, no wordmark. Light and dark both use the app tokens.
Mobile: brand + button on top, links wrap underneath, everything ≥40 px tall.

---

# The ten candidates (kept at /footers)


Preview: **/footers** on the deployed site (or locally on :8000).
Every candidate is a real component from `src/components/footers/variants.jsx`,
rendered on the site canvas with the site's HeroUI buttons/chips/inputs, the same
link set and the same copy as the footer that is live today.

| # | Name | What it is |
|---|------|-----------|
| 1 | **Dark card** | What is live now: dark card, glow, CTA on the right, three link columns, oversized wordmark. |
| 2 | **Editorial light** | White card, one big statement line, four quiet columns, brand row along the bottom. |
| 3 | **Slim bar** | One hairline row: brand, links inline, one button, back-to-top. Nearly invisible. |
| 4 | **Mega columns** | Brand column + three link columns + a trust column, closed by a tinted legal bar. |
| 5 | **Newsletter band** | Tinted band with an email field and a real link grid underneath. |
| 6 | **Split prose** | Statement and the three verdicts on the left, chevroned link lists on the right. |
| 7 | **Command bar** | Dark and search-first: a search pill, quick chips, four quiet columns. |
| 8 | **Stat strip** | Live numbers on top (scholarships, programmes, recheck window), links below. |
| 9 | **Bento tiles** | Brand panel plus three bordered link tiles. |
| 10 | **Minimal + wordmark** | One thin link row, a gradient ScholarPath wordmark, legal line under it. |

## How to choose

Open `/footers`, scroll, press **Use this footer** on the one you want, then say
"footer 4" (or whichever). The choice lives in `localStorage['sf.footer-choice']`
so the page remembers it; it does not change the public site on its own.

## What happens when you pick

`src/components/SiteFooter.jsx` starts rendering that variant — one edit, because
every public page (landing, /privacy, /terms, /how-it-works, /design, /footers
excluded) already renders `SiteFooter`. Then: rebuild, run the audits
(`smoke`, `heroui`, `responsive`, `responsive-css`, `footers`), push, and the
deploy goes out. The other nine stay at `/footers` for later.
