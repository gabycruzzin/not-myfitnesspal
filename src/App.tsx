import { useEffect, useState } from "react";
import { searchFoods, type Food, type Macros } from "./api";

type Entry = Macros & { id: string; name: string; grams: number; meal: string };
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [status, setStatus] = useState("");
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState(MEALS[0]);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setStatus("Searching…");
      try {
        const foods = await searchFoods(query.trim(), ctrl.signal);
        setResults(foods);
        setStatus(foods.length ? "" : "No foods found. Try a simpler name.");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("Search failed. Check your connection and try again.");
      }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const entries = diary[date] ?? [];
  const total = entries.reduce<Macros>(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const add = (f: Food) => {
    const entry: Entry = { id: crypto.randomUUID(), name: f.name, grams, meal, ...scale(f.per100g, grams) };
    setDiary({ ...diary, [date]: [...entries, entry] });
  };
  const remove = (id: string) => setDiary({ ...diary, [date]: entries.filter((e) => e.id !== id) });

  const bars: [string, keyof Macros, string][] = [
    ["Calories", "kcal", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"],
  ];

  return (
    <main>
      <header>
        <h1>Tally</h1>
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
        <div className="controls">
          <input placeholder="Search foods, e.g. greek yogurt" value={query} onChange={(e) => setQuery(e.target.value)} />
          <input type="number" min={1} value={grams} onChange={(e) => setGrams(Number(e.target.value) || 1)} aria-label="Grams" title="Grams" />
          <select value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Meal">
            {MEALS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        {status && <p className="note">{status}</p>}
        <ul className="list">
          {results.map((f) => (
            <li key={f.id}>
              <div><b>{f.name}</b>{f.brand && <small> {f.brand}</small>}
                <small>{Math.round(f.per100g.kcal)} kcal per 100 g, {f.per100g.protein}p {f.per100g.carbs}c {f.per100g.fat}f</small></div>
              <button onClick={() => add(f)}>Add {grams} g</button>
            </li>
          ))}
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
                    <div><b>{e.name}</b><small>{e.grams} g, {e.kcal} kcal, {e.protein}p {e.carbs}c {e.fat}f</small></div>
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
