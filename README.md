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

The API + frontend are served together at **http://localhost:5000**.

## Production hosting and database

The Node server serves both the frontend and API, so a simple deployment can
run them as one web service with a managed PostgreSQL database. Configure the
host's environment variables from `server/.env.example`; for production, set
`NODE_ENV=production`, use public HTTPS values for `CLIENT_URL` and `APP_URL`,
point `DB_HOST` and the other `DB_*` values at the hosted database, and create
two different JWT secrets of at least 32 characters. Mount persistent storage
for uploads and set `UPLOAD_DIR` to its absolute mount path; the default local
`server/uploads` directory is not safe for ephemeral hosting. Production startup
rejects localhost database hosts, non-HTTPS URLs, example JWT secrets, and
relative upload paths. Production also requires real SMTP credentials for
verification and password-reset emails. Run `npm run db:migrate` against the
production database before serving traffic. Configure automated database
backups and persistent-volume backups in the hosting provider; the application
does not create offsite backups itself. Keep `.env` and user-uploaded files out
of source control.

## Quick user manual

### Players

1. Open the home page, register, and log in. Verify your email if the system requests it.
2. Browse tournaments, open one accepting registrations, and select **Join Tournament**. Wait for staff approval.
3. Open **Fixtures**, select your tournament, and check your opponent and scheduled time. Play with the tournament rules shown on its details page.
4. After a scheduled match, submit the home and away scores with a clear final-score screenshot. A player on either approved side can submit; an admin or moderator reviews it.
5. Check **Standings** on the tournament page for updated results. Use **Log Out** in the sidebar or profile menu to return to the home page.

### Admins and moderators

Use **Admin Panel** to manage tournament entries. Generate and schedule fixtures, then review pending result submissions and approve or reject them. Approved results update the match and standings.

## Database scripts

```bash
npm run db:migrate        # create tables (schema.sql)
npm run db:seed           # default settings + global chat channel
npm run db:create-admin   # create the first admin (prompts for credentials)
npm run db:clean-users    # DESTRUCTIVE: permanently delete all non-admin users
                          #   (add --dry-run to preview without deleting)
```

## Admin user management

Log in as an admin and open **Admin Command Center** (`/pages/admin-dashboard.html`):

- **Add User** — create a player, moderator, or admin with a temporary password.
- **Delete** — permanently removes a user and all their data from the database
  (hard delete, not a soft flag). Safety guards prevent deleting your own
  account or the last remaining admin.

API (all require an admin token): `GET/POST /api/admin/users`, `DELETE /api/admin/users/:uuid`.

## Email (verification & password reset)

The app runs in one of two modes, shown in the server startup log:

- **Dev mode** (default, no SMTP configured): new signups are auto-verified so
  you can log in immediately. Password-reset emails are delivered to a free
  **Ethereal test inbox** — the forgot-password page shows an
  *"Open the reset email"* button that opens the real email in your browser.
- **Real email**: use the Resend HTTPS API (recommended for hosted services):
  ```
  RESEND_API_KEY=re_your_api_key
  EMAIL_FROM="EFootball Arena <verified-sender@your-domain.com>"
  ```
  Verify the sender domain with Resend first. The server verifies the API key
  at startup and reports connectivity failures in its logs.
- Alternatively, use real SMTP credentials in `server/.env`, e.g.
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=your.real.email@gmail.com
  SMTP_PASS=your_16_char_app_password
  EMAIL_FROM="EFootball Arena <your.real.email@gmail.com>"
  ```
  Signups then require email verification and reset links go to real inboxes.
  The server verifies the SMTP connection at startup and reports failures in its logs.
  If a verification email fails, the user can request another from the login page.
  Configure `EMAIL_FROM` with a sender address accepted by your provider.
  (For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your normal password.)
