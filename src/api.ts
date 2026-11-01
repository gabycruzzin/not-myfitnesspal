export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
// serving: one serving as the label prints it (e.g. "1 container (150 g)"), plus its weight or volume.
export type Serving = { amount: number; unit: string; label: string };
export type Food = { id: string; name: string; brand?: string; per100g: Macros; serving?: Serving };

type OFFProduct = {
  code?: string;
  product_name?: string;
  brands?: string | string[];
  nutriments?: Record<string, number | string | undefined>;
};

type OFFServing = { code: string; serving_size?: string; serving_quantity?: number | string; serving_quantity_unit?: string };

const num = (v: unknown) => Math.round((typeof v === "number" ? v : Number(v) || 0) * 10) / 10;

// Open Food Facts search API (free, no key), proxied through /api/off in vite.config.ts.
export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: "20",
    fields: "code,product_name,brands,nutriments",
  });
  const res = await fetch(`/api/off/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  const data = (await res.json()) as { hits?: OFFProduct[] };
  const foods = (data.hits ?? [])
    .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
    .map((p) => ({
      id: p.code ?? p.product_name!,
      name: p.product_name!,
      brand: Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0],
      per100g: {
        kcal: num(p.nutriments!["energy-kcal_100g"]),
        protein: num(p.nutriments!["proteins_100g"]),
        carbs: num(p.nutriments!["carbohydrates_100g"]),
        fat: num(p.nutriments!["fat_100g"]),
      },
    }));
  const servings = await fetchServings(foods.map((f) => f.id), signal);
  return foods.map((f) => ({ ...f, serving: servings.get(f.id) }));
}

// Serving sizes already looked up, by product code (null = product lists none), kept across visits.
const SERVING_CACHE_KEY = "servingCache";
const loadServingCache = (): Record<string, Serving | null> => {
  try {
    return JSON.parse(localStorage.getItem(SERVING_CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); });
  });

// The search index has no serving sizes, so look up the uncached ones in one request.
// This API answers 503 now and then, so retry with a short pause; if it never works, foods fall back to 100 g.
async function fetchServings(codes: string[], signal?: AbortSignal): Promise<Map<string, Serving>> {
  const cache = loadServingCache();
  const ids = codes.filter((c) => /^\d+$/.test(c) && !(c in cache));
  if (ids.length) {
    const params = new URLSearchParams({
      code: ids.join(","),
      fields: "code,serving_size,serving_quantity,serving_quantity_unit",
      page_size: String(ids.length),
    });
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await wait(500 * attempt, signal);
      try {
        const res = await fetch(`/api/products?${params}`, { signal });
        if (!res.ok) continue;
        const data = (await res.json()) as { products?: OFFServing[] };
        for (const id of ids) cache[id] = null;
        for (const p of data.products ?? []) {
          const amount = Math.round(Number(p.serving_quantity) || 0);
          if (amount > 0) cache[p.code] = { amount, unit: p.serving_quantity_unit || "g", label: p.serving_size || `${amount} g` };
        }
        try { localStorage.setItem(SERVING_CACHE_KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
        break;
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
      }
    }
  }
  const servings = new Map<string, Serving>();
  for (const c of codes) if (cache[c]) servings.set(c, cache[c]!);
  return servings;
}
