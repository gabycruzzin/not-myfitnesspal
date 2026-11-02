# not myfitness pal

A small calorie and macro tracker. React + TypeScript + Vite.

## Set up the database (once)
Diary entries, goals and custom serving sizes are saved in [Supabase](https://supabase.com) (Postgres + sign-in).
1. Create a free Supabase project.
2. In the dashboard, open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project Settings → API**.

## Run it
```
npm install
npm run dev
```

## How it works
- Food data comes from [Open Food Facts](https://world.openfoodfacts.org) (free, no key). See `src/api.ts`.
  The dev server proxies its API (see `vite.config.ts`); a hosted build needs the same proxy.
- Accounts and data live in Supabase. See `src/db.ts`. Row level security in `supabase/schema.sql`
  means each user can only read and change their own rows.
- Anything logged in a browser before accounts existed is imported into the first account that signs in there.

## Next steps
- Add USDA FoodData Central for whole foods (use a small backend so the API key stays private)
- Barcode scanning, custom foods and recipes
