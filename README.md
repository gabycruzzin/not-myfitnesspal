# Xochiwell

*Xochi* (SO-chee) comes from the Nahuatl *xōchitl*, "flower". Xochiwell is about blooming and feeling well.

A small calorie and macro tracker with no ads, no paywall and no guilt trips. React + TypeScript + Vite.

## Set up the database (once)
Diary entries, goals and custom serving sizes are saved in [Supabase](https://supabase.com) (Postgres + sign-in).
1. Create a free Supabase project.
2. In the dashboard, open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project Settings → API**.

Already set up the database before? Run any newer files in `supabase/migrations/` the same way.

## Run it
```
npm install
npm run dev
```

## Run it as an iOS app
Needs Xcode. The iOS project in `ios/` wraps the built web app with [Capacitor](https://capacitorjs.com).
```
npm run build
npx cap sync ios
npx cap open ios
```
Then pick a simulator or your iPhone in Xcode and press Run. Repeat the first two commands after changing web code.

## How it works
- Food data comes from [Open Food Facts](https://world.openfoodfacts.org) (free, no key). See `src/api.ts`.
  The dev server proxies its API (see `vite.config.ts`); a hosted build needs the same proxy.
- Accounts and data live in Supabase. See `src/db.ts`. Row level security in `supabase/schema.sql`
  means each user can only read and change their own rows.
- Anything logged in a browser before accounts existed is imported into the first account that signs in there.
- Goal setup is optional. New users choose between just logging and a short guided setup (`src/Setup.tsx`).
  Suggested goals come from a "typical day" of foods they enter, or their activity level (`src/goals.ts`). No body measurements are asked for or stored.

## Next steps
- Add USDA FoodData Central for whole foods (use a small backend so the API key stays private)
- Barcode scanning, custom foods and recipes
