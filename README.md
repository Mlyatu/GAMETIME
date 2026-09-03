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

## Getting Started (once Step 3+ is complete)

```bash
cd server
cp .env.example .env   # then fill in real values
npm install
npm run dev
```
