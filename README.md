# EFootball Arena — Tournament Management System

A full-stack tournament management platform for eFootball competitions:
player registration, payments, fixtures, live results, OCR score verification,
admin dashboard, real-time chat, and reporting.

## Project Structure

```
efootball-arena/
├── client/                 # Frontend (HTML5, CSS3, Bootstrap 5, vanilla JS)
│   ├── assets/
│   │   ├── css/            # Stylesheets (theme, components, pages)
│   │   ├── js/              # Frontend logic (API calls, UI behavior)
│   │   └── images/          # Logos, icons, static images
│   ├── pages/                # Individual HTML pages (login, dashboard, etc.)
│   ├── components/           # Reusable HTML/JS UI fragments
│   └── layouts/              # Shared page shells (sidebar, navbar, footer)
│
├── server/                 # Backend (Node.js + Express, MVC architecture)
│   ├── controllers/          # Request handlers — business logic per feature
│   ├── routes/               # Express route definitions (/api/...)
│   ├── middleware/           # Auth guards, error handling, rate limiting
│   ├── models/               # Database access layer (queries per table)
│   ├── services/              # Reusable business logic (email, OCR, reports)
│   ├── config/                # DB connection, app-wide config
│   ├── database/              # SQL schema, migrations, seed scripts
│   ├── socket/                 # Socket.io event handlers (chat, live feed)
│   ├── utils/                   # Helper functions (formatting, tokens, etc.)
│   ├── validators/              # express-validator rule sets
│   ├── uploads/                  # User-uploaded files (avatars, payment proofs)
│   ├── logs/                     # Application logs (morgan output)
│   ├── public/                    # Static files served directly by Express
│   ├── .env.example                # Environment variable template
│   ├── package.json
│   └── server.js                   # Entry point (added in a later step)
│
└── .gitignore
```

## Build Roadmap (step by step)

- [x] **Step 1 — Project scaffolding**: folder structure, package.json,
      environment template, git ignore rules.
- [x] Step 2 — Database schema (all tables: Users, Admins, Players, Teams,
      Tournament, Matches, Standings, Results, Announcements, Chat,
      Notifications, Payments, Verification, Media, Audit Logs, Settings).
- [x] Step 3 — Express server bootstrap (server.js, app.js, DB connection,
      security middleware: Helmet, CORS, rate limiting, Morgan, compression).
- [x] Step 4 — Authentication system (JWT, bcrypt, register/login/reset,
      role-based middleware).
- [x] Step 5 — Core REST API routes/controllers (players, teams, tournaments).
- [x] Step 6 — Match & standings engine (auto points, auto goal difference,
      auto ranking, fixture generation).
- [x] Step 7 — Payments module (M-Pesa / Airtel Money / Tigo Pesa / HaloPesa,
      admin approve/reject/refund).
- [x] Step 8 — Real-time features (Socket.io: chat, notifications, live feed).
- [x] Step 9 — Media & OCR (uploads, Tesseract.js score reading).
- [x] Step 10 — Reports (PDF/Excel/CSV/JSON export).
- [x] Step 11 — Frontend design system (Cyber Dark + Glassmorphism theme,
      shared layout components).
- [ ] Step 12 — Frontend pages (landing, auth, player dashboard, admin panel).
      - [x] Batch 1: Landing page + full auth flow (register, login,
            forgot/reset password, email verification).
      - [x] Batch 2: About, Features.
      - [x] Batch 3: Player dashboard, tournaments, fixtures, leaderboard, teams.
      - [ ] Batch 4: Admin panel.
      - [ ] Batch 5: Gallery, chat, notifications, profile, settings.
- [ ] Step 13 — Wiring frontend to API + polish, testing, deployment notes.

Each step will be generated fully, explained file by file, before moving
to the next — so the project stays reviewable and within reasonable size
per turn.

## Frontend design system (Step 11)

Everything under `client/assets/css/` and `client/assets/js/` is the
shared foundation every page in Step 12 will build on:

- **`tokens.css`** — every color, radius, shadow, blur, and timing value
  as a CSS custom property. This is the *only* file to edit if the
  brand palette changes — nothing else should hardcode a hex value.
- **`base.css`** — resets, typography scale, global background gradient,
  scrollbar styling, `prefers-reduced-motion` handling.
- **`glass.css`** — the signature look: `.glass-card` (frosted floating
  panels), `.neu-surface` (neumorphic depth), `.glow-*` utilities (neon
  accents).
- **`components.css`** — buttons, badges, form controls, the sidebar/
  topbar/table/stat-card/toast/modal building blocks, restyled to match
  the Arena look rather than fighting Bootstrap's defaults.
- **`animations.css`** — fade-in, float, glow-pulse, skeleton shimmer,
  and chat typing-dot keyframes.
- **`include.js`** — this project has no build step, so shared chrome
  (sidebar/topbar/footer) is done via `<div data-include="/components/sidebar.html">`
  rather than a templating engine. See `client/layouts/dashboard-shell.html`
  for the copy-paste starting point Step 12's pages will use.
- **`client/pages/design-system.html`** — a living style guide
  demonstrating every token/component together. Open this first when
  building new pages, to reuse existing classes instead of inventing new ones.

Verified by actually rendering the page (not just reviewing the code):
caught and fixed an invalid Font Awesome Free icon name (`fa-grid-2` is
Pro-only) that was silently dropping the Dashboard nav icon.

## Getting Started (once Step 3+ is complete)

```bash
cd server
cp .env.example .env   # then fill in real values
npm install
npm run dev
```
