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
- Awwwards-style landing: kinetic masked hero reveal, parallax bg, countdown, live ticket counter, marquee, lineup with genre filters, interactive floors explorer, 4 ticket tiers, FAQ accordion, contact form, noise/scanline overlays
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
