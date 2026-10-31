export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type Food = { id: string; name: string; brand?: string; per100g: Macros };

type OFFProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

// Open Food Facts: free, no API key. Swap or add USDA FoodData Central later.
export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: "code,product_name,brands,nutriments",
  });
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { signal });
  if (!res.ok) throw new Error(`Food search failed (${res.status})`);
  const data = (await res.json()) as { products?: OFFProduct[] };
  return (data.products ?? [])
    .filter((p) => p.product_name && p.nutriments?.["energy-kcal_100g"] != null)
    .map((p) => ({
      id: p.code ?? p.product_name!,
      name: p.product_name!,
      brand: p.brands?.split(",")[0],
      per100g: {
        kcal: num(p.nutriments!["energy-kcal_100g"]),
        protein: num(p.nutriments!["proteins_100g"]),
        carbs: num(p.nutriments!["carbohydrates_100g"]),
        fat: num(p.nutriments!["fat_100g"]),
      },
    }));
}
