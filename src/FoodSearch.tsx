import { useRef, useState, type FormEvent } from "react";
import { searchFoods, type Food, type Macros, type Serving } from "./api";
import type { NewEntry } from "./db";

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const SERVING_STEP = 0.5;
const roundToStep = (n: number) => Math.max(SERVING_STEP, Math.round(n / SERVING_STEP) * SERVING_STEP);
export const servingLabel = (n: number) => `${n} serving${n === 1 ? "" : "s"}`;
// Foods without a listed serving size use the size you set for them (remembered by food), or 100 g.
const servingOf = (f: Food, custom: Record<string, number>): Serving => {
  if (f.serving) return f.serving;
  const amount = custom[f.id] ?? 100;
  return { amount, unit: "g", label: `${amount} g` };
};

export const scale = (m: Macros, grams: number): Macros => ({
  kcal: Math.round((m.kcal * grams) / 100),
  protein: Math.round((m.protein * grams) / 10) / 10,
  carbs: Math.round((m.carbs * grams) / 10) / 10,
  fat: Math.round((m.fat * grams) / 10) / 10,
});

export const sumMacros = (items: Macros[]): Macros => items.reduce<Macros>(
  (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
  { kcal: 0, protein: 0, carbs: 0, fat: 0 },
);

// Macro numbers in each nutrient's color, e.g. "90 kcal, 16p 6c 0f".
export const MacroText = ({ m, kcalLabel = "kcal" }: { m: Macros; kcalLabel?: string }) => (
  <>
    <span className="m-kcal">{Math.round(m.kcal)} {kcalLabel}</span>,{" "}
    <span className="m-protein">{Math.round(m.protein * 10) / 10}p</span> <span className="m-carbs">{Math.round(m.carbs * 10) / 10}c</span> <span className="m-fat">{Math.round(m.fat * 10) / 10}f</span>
  </>
);

type Props = {
  customServings: Record<string, number>;
  onCustomServing: (foodId: string, grams: number, save: boolean) => void;
  onAdd: (entry: NewEntry) => void;
  disabled?: boolean;
  placeholder?: string;
};

// Search box, servings stepper, meal picker and results. Used by the diary and by setup's typical day.
export default function FoodSearch({ customServings, onCustomServing, onAdd, disabled, placeholder = "Search foods, e.g. greek yogurt" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [status, setStatus] = useState("");
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState(MEALS[0]);
  const searchCtrl = useRef<AbortController>();

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return setStatus("Type at least 2 letters to search.");
    searchCtrl.current?.abort();
    const ctrl = (searchCtrl.current = new AbortController());
    setStatus("Searching…");
    try {
      const foods = await searchFoods(q, ctrl.signal);
      setResults(foods);
      setStatus(foods.length ? "" : "No foods found. Try a simpler name.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus("Search failed. Check your connection and try again.");
    }
  };

  const add = (f: Food) => {
    const { amount, unit } = servingOf(f, customServings);
    const grams = Math.round(servings * amount);
    onAdd({ name: f.name, grams, unit, servings, meal, ...scale(f.per100g, grams) });
  };

  return (
    <>
      <form className="controls" onSubmit={runSearch} role="search">
        <input placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search foods" />
        <button type="submit">Search</button>
      </form>
      <div className="controls amount">
        <div className="stepper">
          <button type="button" className="ghost" onClick={() => setServings(roundToStep(servings - SERVING_STEP))} disabled={servings <= SERVING_STEP} aria-label="Fewer servings">−</button>
          <input type="number" min={SERVING_STEP} step={SERVING_STEP} value={servings} onChange={(e) => setServings(Number(e.target.value) || SERVING_STEP)} onBlur={() => setServings(roundToStep(servings))} aria-label="Servings" />
          <button type="button" className="ghost" onClick={() => setServings(roundToStep(servings + SERVING_STEP))} aria-label="More servings">+</button>
        </div>
        <span>{servings === 1 ? "serving" : "servings"}</span>
        <select value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Meal">
          {MEALS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      {status && <p className="note">{status}</p>}
      <ul className="list">
        {results.map((f) => {
          const s = servingOf(f, customServings);
          const per = scale(f.per100g, s.amount);
          return (
            <li key={f.id}>
              <div><b>{f.name}</b>{f.brand && <small> {f.brand}</small>}
                {f.serving ? (
                  <small className="serving">1 serving = {s.label}</small>
                ) : (
                  <small className="serving">
                    1 serving ={" "}
                    <input className="inline" type="number" min={1} value={s.amount} aria-label={`Serving size in grams for ${f.name}`}
                      onChange={(e) => onCustomServing(f.id, Math.max(1, Number(e.target.value) || 1), false)}
                      onBlur={() => onCustomServing(f.id, s.amount, true)} />{" "}
                    g <span className="hint">(none listed, set your own)</span>
                  </small>
                )}
                <small><MacroText m={per} kcalLabel="kcal per serving" /></small></div>
              <button onClick={() => add(f)} disabled={disabled}>Add {servings} ({Math.round(servings * s.amount)} {s.unit})</button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
