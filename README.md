# Team TimeFlow

Kiosk-style time clock and workforce dashboard for small businesses.

Built and owned by **JD Marketing & Consulting LLC**.

## What it is

A single-screen tablet kiosk where staff clock in and out with a PIN, plus an
admin dashboard for time tracking, payroll exports, announcements, and company
branding. Designed to be white-labeled per client — every company name, logo,
and color is configurable from the admin Company Settings page.

## Features

- **Kiosk mode** — initials grid → PIN entry → clock in / out, with break and
  lunch tracking, an announcements ticker, today's sales-goal display, and a
  live staff board showing who's on duty.
- **Admin dashboard** — overview, employee management, time tracking, payroll
  calculator with CSV export, announcements, and company settings.
- **White-label by default** — company name, short name, tagline, logo image,
  fallback letter, primary color, accent color, timezone, and currency all
  edit from Admin → Company Settings. Settings persist in the browser.
- **Theme-aware** — brand colors flow through Tailwind CSS variables, so every
  surface (sidebar, kiosk accents, buttons, focus rings) updates together.

## Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives)
- React Router for routing
- Supabase (Postgres + RLS) for persistence
- TanStack Query for client cache
- jsPDF + jspdf-autotable for printable payroll & per-employee time cards
- Zod + react-hook-form on validated forms
- Vitest for tests

## Local development

Requires Node.js 18+.

```sh
# Install dependencies
npm install

# Start the dev server (defaults to http://localhost:8080)
npm run dev

# Run tests
npm run test

# Production build
npm run build

# Preview the production build
npm run preview
```

## Project structure

```
src/
├── App.tsx                       # Router + providers
├── pages/
│   ├── Index.tsx                 # Landing page
│   ├── KioskPage.tsx             # Tablet kiosk
│   ├── AdminPage.tsx             # Admin shell
│   └── NotFound.tsx
├── components/
│   ├── CompanyThemeProvider.tsx  # Applies brand colors at runtime
│   ├── CompanyLogo.tsx           # Logo image or letter-tile fallback
│   ├── admin/                    # Admin views (employees, payroll, settings, …)
│   ├── kiosk/                    # Kiosk views (PIN entry, staff board, …)
│   └── ui/                       # shadcn/ui primitives
├── data/
│   ├── companyStore.ts           # localStorage-backed company config
│   ├── employeeStore.ts          # Employee list store
│   └── mockData.ts               # Seed data (employees, time entries, goals)
├── hooks/
│   ├── useCompany.ts             # Reads + updates the company config
│   ├── useEmployees.ts
│   └── use-toast.ts
├── types/
│   ├── company.ts                # Company config type + default
│   └── workforce.ts              # Employee, TimeEntry, Goal, …
└── lib/
    └── utils.ts                  # cn() helper
```

## Configuring for a new company

1. Open the app and navigate to **Admin → Company Settings**.
2. Update the company name, short name, and tagline.
3. Upload a logo image (under 500 KB) or set a one-to-two letter fallback.
4. Pick a primary color and accent color. Changes apply across the app
   immediately and persist between visits.
5. Set timezone and currency for future reporting features.

The default config seeds with placeholder values — change them on first run.

## Roadmap

Data persists in Supabase (Postgres + RLS). See AUDIT.md for the current
prioritized list of fixes and improvements. The big ones:

- Real Supabase Auth for admin tier; hashed PINs via an Edge Function;
  brute-force lockout on the kiosk PIN screen; locked-down RLS policies.
- Audit log viewer UI (rows are already being written for every edit/delete).
- Bulk forgotten-clock-out estimator in the UI (currently runs via SQL).
- Per-tenant payroll config (OT threshold, multiplier, excluded roles).
- Mobile-friendly admin layout.
- Real test coverage on the payroll math.

## License

Proprietary. © JD Marketing & Consulting LLC. All rights reserved.
