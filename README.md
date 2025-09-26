This is a Next.js app (App Router) with Supabase auth and storage.

## Requirements

- Node.js 18.18+ (Node 20+ recommended)
- npm, pnpm, or yarn

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```
cp .env.example .env.local
```

Required:
- `NEXT_PUBLIC_SUPABASE_URL` – Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Your Supabase anon public key

Optional:
- `SUPABASE_SERVICE_ROLE_KEY` – Server-side key (never exposed client-side)
- `NEXT_PUBLIC_BILLING_WEBHOOK_URL` – n8n/other webhook URL for billing actions

## Install & Run

1) Install dependencies:

```
npm install
```

2) Start the dev server:

```
npm run dev
```

Open http://localhost:3000

## Notes

- Images from Supabase storage are allowed via Next/Image configuration.
- Auth is enforced in `middleware.js` for `/dashboard/*` routes.
- Tailwind CSS v4 is configured via `postcss.config.mjs` and `tailwind.config.js`.
