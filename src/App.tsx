import { useEffect, useRef, useState, type FormEvent } from "react";
import { searchFoods, type Food, type Macros, type Serving } from "./api";

// grams is the logged amount in `unit` (g, or ml for drinks); older entries have no unit and are grams.
type Entry = Macros & { id: string; name: string; grams: number; unit?: string; servings?: number; meal: string };
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const SERVING_STEP = 0.5;
const roundToStep = (n: number) => Math.max(SERVING_STEP, Math.round(n / SERVING_STEP) * SERVING_STEP);
const servingLabel = (n: number) => `${n} serving${n === 1 ? "" : "s"}`;
// Foods without a listed serving size use the size you set for them (remembered by food), or 100 g.
const servingOf = (f: Food, custom: Record<string, number>): Serving => {
  if (f.serving) return f.serving;
  const amount = custom[f.id] ?? 100;
  return { amount, unit: "g", label: `${amount} g` };
};
const DEFAULT_GOALS: Macros = { kcal: 2000, protein: 150, carbs: 200, fat: 65 };
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

const scale = (m: Macros, grams: number): Macros => ({
  kcal: Math.round((m.kcal * grams) / 100),
  protein: Math.round((m.protein * grams) / 10) / 10,
  carbs: Math.round((m.carbs * grams) / 10) / 10,
  fat: Math.round((m.fat * grams) / 10) / 10,
});

export default function App() {
  const [date, setDate] = useState(today());
  const [diary, setDiary] = useStored<Record<string, Entry[]>>("diary", {});
  const [goals, setGoals] = useStored<Macros>("goals", DEFAULT_GOALS);
  const [customServings, setCustomServings] = useStored<Record<string, number>>("customServings", {});
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

  const entries = diary[date] ?? [];
  const total = entries.reduce<Macros>(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const add = (f: Food) => {
    const { amount, unit } = servingOf(f, customServings);
    const grams = Math.round(servings * amount);
    const entry: Entry = { id: crypto.randomUUID(), name: f.name, grams, unit, servings, meal, ...scale(f.per100g, grams) };
    setDiary({ ...diary, [date]: [...entries, entry] });
  };
  const remove = (id: string) => setDiary({ ...diary, [date]: entries.filter((e) => e.id !== id) });

  const bars: [string, keyof Macros, string][] = [
    ["Calories", "kcal", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"],
  ];

  return (
    <main>
      <header>
        <h1>not <em>myfitness</em> pal</h1>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Diary date" />
      </header>

      <section className="totals">
        {bars.map(([label, k, unit]) => {
          const over = total[k] > goals[k];
          return (
            <div key={k} className="stat">
              <div className="row"><b>{label}</b><span className={over ? "over" : ""}>{Math.round(total[k])} / {goals[k]} {unit}</span></div>
              <div className="bar"><i className={over ? "over" : ""} style={{ width: `${Math.min(100, (total[k] / goals[k]) * 100)}%` }} /></div>
            </div>
          );
        })}
        <details>
          <summary>Edit daily goals</summary>
          <div className="goals">
            {bars.map(([label, k]) => (
              <label key={k}>{label}
                <input type="number" min={0} value={goals[k]} onChange={(e) => setGoals({ ...goals, [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
        </details>
      </section>

      <section>
        <h2>Add food</h2>
        <form className="controls" onSubmit={runSearch} role="search">
          <input placeholder="Search foods, e.g. greek yogurt" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search foods" />
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
                        onChange={(e) => setCustomServings({ ...customServings, [f.id]: Math.max(1, Number(e.target.value) || 1) })} />{" "}
                      g <span className="hint">(none listed, set your own)</span>
                    </small>
                  )}
                  <small>{per.kcal} kcal per serving, {per.protein}p {per.carbs}c {per.fat}f</small></div>
                <button onClick={() => add(f)}>Add {servings} ({Math.round(servings * s.amount)} {s.unit})</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Diary</h2>
        {entries.length === 0 && <p className="note">Nothing logged yet. Search for a food above to add it.</p>}
        {MEALS.map((m) => {
          const items = entries.filter((e) => e.meal === m);
          if (!items.length) return null;
          return (
            <div key={m}>
              <h3>{m}</h3>
              <ul className="list">
                {items.map((e) => (
                  <li key={e.id}>
                    <div><b>{e.name}</b><small>{e.servings ? `${servingLabel(e.servings)} (${e.grams} ${e.unit ?? "g"})` : `${e.grams} g`}, {e.kcal} kcal, {e.protein}p {e.carbs}c {e.fat}f</small></div>
                    <button className="ghost" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>
    </main>
  );
}
