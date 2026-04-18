This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Auth configuration (required)

Password recovery and invite links rely on a public app URL plus Supabase redirect allowlist.

- `NEXT_PUBLIC_SITE_URL`: canonical **production** site URL (`https://...`). Used for preview/production auth redirects and any client code that needs the public origin.
- `NEXT_PUBLIC_DEV_SITE_URL` (optional): used **only** while `next dev` (`NODE_ENV=development`) for Supabase `redirect_to` in password reset and invite emails. Defaults to `http://localhost:3000` if unset (change port here if you are not on 3000).

**Note:** If `NEXT_PUBLIC_SITE_URL` points at production but you run `npm run dev`, reset/invite emails still use the dev base URL above, so links are not stuck on production during local work.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used for privileged profile updates (never expose with `NEXT_PUBLIC_*`).

Supabase Dashboard -> Authentication -> URL Configuration must include:

- `http://localhost:3000/auth/callback` (development, invites)
- `http://localhost:3000/auth/recovery-callback` (development, password reset)
- `https://<your-production-domain>/auth/callback` (production, invites)
- `https://<your-production-domain>/auth/recovery-callback` (production, password reset)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

npx supabase gen types typescript --local > src/types/supabase.ts