# not myfitness pal

A small calorie and macro tracker. React + TypeScript + Vite.

## Run it
```
npm install
npm run dev
```

## How it works
- Food data comes from [Open Food Facts](https://world.openfoodfacts.org) (free, no key). See `src/api.ts`.
- Diary entries and goals are saved in the browser's localStorage.

## Next steps
- Add USDA FoodData Central for whole foods (use a small backend so the API key stays private)
- Barcode scanning, custom foods and recipes
- Accounts and a real database (Supabase or Firebase)
