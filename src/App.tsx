import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { searchFoods, type Food, type Macros, type Serving } from "./api";
import {
  supabase, DEFAULT_GOALS, type Entry,
  loadDay, addEntry, removeEntry, loadGoals, saveGoals, loadCustomServings, saveCustomServing, importLocalData,
} from "./db";
import SignIn from "./SignIn";

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
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

const scale = (m: Macros, grams: number): Macros => ({
  kcal: Math.round((m.kcal * grams) / 100),
  protein: Math.round((m.protein * grams) / 10) / 10,
  carbs: Math.round((m.carbs * grams) / 10) / 10,
  fat: Math.round((m.fat * grams) / 10) / 10,
});

const Title = () => <h1><em>Not</em> MyFitnessPal</h1>;

// Macro numbers in each nutrient's color, e.g. "90 kcal, 16p 6c 0f".
const MacroText = ({ m, kcalLabel = "kcal" }: { m: Macros; kcalLabel?: string }) => (
  <>
    <span className="m-kcal">{m.kcal} {kcalLabel}</span>,{" "}
    <span className="m-protein">{m.protein}p</span> <span className="m-carbs">{m.carbs}c</span> <span className="m-fat">{m.fat}f</span>
  </>
);

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return (
      <main>
        <header><Title /></header>
        <section className="auth">
          <h2>Connect a database</h2>
          <p className="note">
            Diary entries are saved in Supabase. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
            project's URL and anon key, then restart the dev server. Setup steps are in the README.
          </p>
        </section>
      </main>
    );
  }
  if (!checked) return <main><header><Title /></header><p className="note">Loading…</p></main>;
  if (!session) return <main><header><Title /></header><SignIn /></main>;
  return <Tracker session={session} />;
}

function Tracker({ session }: { session: Session }) {
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [goals, setGoals] = useState<Macros>(DEFAULT_GOALS);
  const [customServings, setCustomServings] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [status, setStatus] = useState("");
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState(MEALS[0]);
  const searchCtrl = useRef<AbortController>();
  const goalsTimer = useRef<ReturnType<typeof setTimeout>>();

  const fail = (what: string) => (e: unknown) => {
    console.error(e);
    setNotice(`Couldn't ${what}. Check your connection and try again.`);
  };

  // On sign-in: bring over anything saved in this browser before accounts existed, then load goals and serving sizes.
  useEffect(() => {
    (async () => {
      const imported = await importLocalData();
      if (imported) setNotice(`Imported ${imported} diary ${imported === 1 ? "entry" : "entries"} saved in this browser.`);
      const [g, c] = await Promise.all([loadGoals(), loadCustomServings()]);
      setGoals(g);
      setCustomServings(c);
      setReady(true);
    })().catch(fail("load your account"));
  }, [session.user.id]);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    loadDay(date).then((rows) => current && setEntries(rows)).catch(fail("load this day's diary"));
    return () => { current = false; };
  }, [date, ready]);

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

  const total = entries.reduce<Macros>(
    (a, e) => ({ kcal: a.kcal + e.kcal, protein: a.protein + e.protein, carbs: a.carbs + e.carbs, fat: a.fat + e.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const add = (f: Food) => {
    const { amount, unit } = servingOf(f, customServings);
    const grams = Math.round(servings * amount);
    const day = date;
    addEntry(day, { name: f.name, grams, unit, servings, meal, ...scale(f.per100g, grams) })
      .then((saved) => { if (day === date) setEntries((list) => [...list, saved]); })
      .catch(fail(`add ${f.name}`));
  };
  const remove = (id: string) => {
    const before = entries;
    setEntries(entries.filter((e) => e.id !== id));
    removeEntry(id).catch((e) => { setEntries(before); fail("remove that entry")(e); });
  };
  // Goals save shortly after you stop typing, so each keystroke isn't a write.
  const changeGoal = (k: keyof Macros, value: number) => {
    const next = { ...goals, [k]: value };
    setGoals(next);
    clearTimeout(goalsTimer.current);
    goalsTimer.current = setTimeout(() => saveGoals(next).catch(fail("save your goals")), 600);
  };

  const bars: [string, keyof Macros, string][] = [
    ["Calories", "kcal", "kcal"], ["Protein", "protein", "g"], ["Carbs", "carbs", "g"], ["Fat", "fat", "g"],
  ];

  return (
    <main>
      <header>
        <Title />
        <div className="header-actions">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} aria-label="Diary date" />
          <button className="link" onClick={() => supabase!.auth.signOut()} title={session.user.email}>Sign out</button>
        </div>
      </header>
      {notice && <p className="note notice" role="status">{notice} <button className="link" onClick={() => setNotice("")}>Dismiss</button></p>}

      <section className="totals">
        {bars.map(([label, k, unit]) => {
          const over = total[k] > goals[k];
          return (
            <div key={k} className="stat" data-k={k}>
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
                <input type="number" min={0} value={goals[k]} onChange={(e) => changeGoal(k, Number(e.target.value))} />
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
                        onChange={(e) => setCustomServings({ ...customServings, [f.id]: Math.max(1, Number(e.target.value) || 1) })}
                        onBlur={() => saveCustomServing(f.id, s.amount).catch(fail("save that serving size"))} />{" "}
                      g <span className="hint">(none listed, set your own)</span>
                    </small>
                  )}
                  <small><MacroText m={per} kcalLabel="kcal per serving" /></small></div>
                <button onClick={() => add(f)} disabled={!ready}>Add {servings} ({Math.round(servings * s.amount)} {s.unit})</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2>Diary</h2>
        {ready && entries.length === 0 && <p className="note">Nothing logged yet. Search for a food above to add it.</p>}
        {MEALS.map((m) => {
          const items = entries.filter((e) => e.meal === m);
          if (!items.length) return null;
          return (
            <div key={m}>
              <h3 className={`meal meal-${m.toLowerCase()}`}>{m}</h3>
              <ul className="list">
                {items.map((e) => (
                  <li key={e.id}>
                    <div><b>{e.name}</b><small>{e.servings ? `${servingLabel(e.servings)} (${e.grams} ${e.unit})` : `${e.grams} ${e.unit}`}, <MacroText m={e} /></small></div>
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
