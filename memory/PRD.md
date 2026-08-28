# PRD — ASIA TAKEOVER FESTIVAL

## Original problem statement
"Build me a web called ASIA TAKEOVER FESTIVAL where I can sell tickets to my biggest asian festival in prague in the biggest club DUPLEX"

User choices: MOCKED demo checkout; sections Hero + Lineup + Tickets + FAQ + Contact; event 27.09.2026 at DUPLEX Prague, 3 floors, 10 DJs, 2 rooftops, genres (K-POP, HipHop/RnB, Vinahouse, Pop Hits, J-POP, Choreography Dance), 2 photobooth zones, VIP zones, soju, presented by DUPLEX x SeoulVibes x GANGSHII; admin page for sales/tickets/parties CRUD/site content; door QR scanner at /nascanujtobrasko; English.

## Architecture
- FastAPI + MongoDB (motor) backend, JWT cookie auth (bcrypt), admin seeding from .env
- React + Tailwind + framer-motion + lenis frontend, recharts (admin), html5-qrcode (scanner)
- QR e-tickets generated server-side (qrcode lib, base64 PNG)
- Collections: users, events, ticket_tiers, orders, tickets, messages, content, login_attempts

## User personas
- Festival-goer: browses lineup/floors, buys demo tickets, gets QR e-ticket
- Organizer (admin): manages sales, orders, parties, tiers, site content, messages
- Door staff: scans/validates QR codes at entrance

## Implemented (2026-08-27)
- v4 (2026-08-27): Hero now plays user's promo video as background (cut to clean club clips 11s–30.3s, no intro globe/people, all text overlays and audio removed; WebM VP9 + MP4 fallback, muted autoplay loop). Orange BUY TICKETS button (orange bg, white text, glow) below the ATF logo links to new /tickets page (ticket tiers + demo checkout live there). Venue map chapter replaced with new official map (KPOP / MAINSTREAM / SAIGON rooms). black hero with official ASIA TAKEOVER logo center, GANGSHII / DUPLEX / SEOULVIBES logos above; NOCTA-style pinned scroll gallery with ONLY the official 3-floor venue map (KPOP ROOM / WORLD MUSIC / SAIGON FLOOR) with scale-from-card scroll animation; minimal footer. v3 trim: removed scroll indicator, hero date line, GET TICKETS button, stock photo chapters, and the entire Tickets/"Choose Your Weapon" section from the landing (checkout components kept in repo, unused). User assets processed to transparent PNGs in /assets. More event photos to come from user — drop into Gallery CHAPTERS.
- v5 (2026-08-27) production payments + Meta tracking: secure server-side order flow (POST /api/orders/create, price from DB, no tickets before payment), GoPay REST integration (OAuth2 payment-all scope, return_url + notification_url, server-side status verification with amount/currency/order match, full GoPay state model), idempotent atomic fulfillment, SIM test mode when GoPay creds absent (/pay/:orderId + /api/payments/sim/*), Meta Pixel (consent-gated, REACT_APP_META_PIXEL_ID) + server CAPI Purchase after verified payment (sha256 email, fbp/fbc raw, event_id=purchase_<order_id> dedup, META_TEST_EVENT_CODE support), UTM first/last touch + fbclid→fbc persisted on orders, EU cookie consent banner, rate limiting on order create, admin orders show payment status + attribution. Blocked: real GoPay/Meta verification until user provides credentials.
- v7 (2026-08-27) ticket section rebuild (per user spec): sequential GA release system (Early Bird 449 → 1st 499 → 2nd 549 → Final 599, only current tier shown as big card, sold-out tiers as compact muted rows, auto "Next release: X CZK" / "Final online ticket release", price progression line, no public quantities), VIP ALL ACCESS 799 separate gold-accent card (greyed when sold out), header "CHOOSE YOUR TICKET" + room labels (Seoul/Mainstream/Gangshii). Backend enforces sequential sale: only first unsold GA tier purchasable (POST /orders/create rejects future tiers 400 "This release is not on sale yet"), VIP exempt. VIP ALL ACCESS tier created in DB (cap 100). Mobile: GA first, VIP below, big CTAs. transactional ticket emails via Emergent-managed Resend proxy (EMERGENT_EMAIL_KEY backend-only, from_name "Asia Takeover", branded dark HTML template with per-ticket QR images served from /api/qr/{code}.png, TICKET i OF n layout, subject "Asia Takeover — Your Tickets 🎟️"); email sent inside atomic fulfillment with ticket_email_sent_at / ticket_email_error tracking; admin resend endpoint POST /api/admin/orders/{id}/resend-email (same tickets, paid orders only); scanner hardened: atomic find_one_and_update checkin (race-safe — exactly one VALID wins), refunded/cancelled rejection, checked_in_by recorded, auto-reset UI after 4s, refund sim action for testing. Cookie banner hidden on staff pages.
- Awwwards-style landing v1 (replaced by v2): kinetic hero, lineup filters, floors explorer, FAQ, contact form
- Demo checkout (MOCKED payment) issuing instant QR e-tickets
- Admin /admin: stats + sales chart, orders table w/ search + CSV export, party CRUD (incl. lineup JSON editor), tier CRUD, site content editor, contact messages inbox
- Door scanner /nascanujtobrasko: camera QR scan + manual entry, VALID/USED/INVALID/ADMITTED states with audio beeps, door log, per-session counters
- Auth: admin login, brute-force lockout, protected admin/scan APIs

## Credentials
- Admin/door: admin@asiatakeover.eu / Takeover2026! (see /app/memory/test_credentials.md)

## Backlog
- P0: real payment provider (Stripe) when ready to sell for real
- P1: email delivery of e-tickets (Resend), richer tier form UX (perks list editor)
- P1: public event page per party (/events/:id), photo gallery section
- P2: multilingual EN/CZ toggle, Apple/Google wallet passes, door staff roles separate from admin
