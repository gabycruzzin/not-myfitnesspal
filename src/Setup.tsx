import { useState, type ReactNode } from "react";
import type { Macros } from "./api";
import type { Activity, EnergyRange, Profile, Reason, TypicalItem } from "./db";
import FoodSearch, { MEALS, MacroText, servingLabel, sumMacros } from "./FoodSearch";
import { ACTIVITIES, RANGES, REASONS, looksComplete, suggestGoals } from "./goals";

export type SetupStep = "welcome" | "reasons" | "activity" | "typical" | "goals";
const GUIDED: SetupStep[] = ["reasons", "activity", "typical", "goals"];

type Props = {
  start: SetupStep;
  profile: Profile;
  customServings: Record<string, number>;
  onCustomServing: (foodId: string, grams: number, save: boolean) => void;
  // goals is only passed when the user picked goals; otherwise their current goals stay as they are.
  onFinish: (profile: Profile, goals?: Macros) => void;
};

// Welcome screen and the optional guided goal setup. Every step can be skipped; leaving keeps what was answered so far.
export default function Setup({ start, profile, customServings, onCustomServing, onFinish }: Props) {
  const [step, setStep] = useState<SetupStep>(start);
  const [reasons, setReasons] = useState<Reason[]>(profile.reasons);
  const [activity, setActivity] = useState<Activity | null>(profile.activity);
  const [range, setRange] = useState<EnergyRange | null>(profile.energyRange);
  const [typical, setTypical] = useState<TypicalItem[]>(profile.typicalDay ?? []);
  const [draft, setDraft] = useState<Macros | null>(null);

  const firstRun = profile.setupChoice === null;
  const answers = (): Profile => ({
    ...profile, setupChoice: profile.setupChoice ?? "goals", reasons, activity, energyRange: range, typicalDay: typical.length ? typical : null,
  });
  const leave = () => onFinish(answers());

  const typicalTotal = sumMacros(typical);
  const typicalUsable = looksComplete(typical.length, typicalTotal.kcal);
  const suggestion = suggestGoals(reasons, activity, range, typicalUsable ? typicalTotal : null);
  // Moving to the goals step fills in fresh suggestions from the typical day as it is at that moment.
  const toGoals = (items: TypicalItem[]) => {
    const total = sumMacros(items);
    setTypical(items);
    setDraft(suggestGoals(reasons, activity, range, looksComplete(items.length, total.kcal) ? total : null).goals);
    setStep("goals");
  };
  const next = () => setStep(GUIDED[GUIDED.indexOf(step) + 1]);

  if (step === "welcome") {
    return (
      <section className="setup">
        <h2>welcome</h2>
        <p className="lede">Log what you eat, your way. Set goals if you'd like some, or skip them entirely. You can change your mind anytime.</p>
        <div className="choices">
          <button className="choice" onClick={() => onFinish({ ...profile, setupChoice: "log" })}>
            <b>Just start logging</b><small>Head straight to your diary.</small>
          </button>
          <button className="choice" onClick={() => setStep("reasons")}>
            <b>Help me set some goals</b><small>About 2 minutes, every step optional.</small>
          </button>
        </div>
      </section>
    );
  }

  const footer = (primary: ReactNode) => (
    <div className="setup-footer">
      <button className="link" onClick={leave}>{firstRun ? "skip setup, just start logging" : "cancel"}</button>
      {primary}
    </div>
  );
  const progress = <p className="progress">step {GUIDED.indexOf(step) + 1} of {GUIDED.length}</p>;

  if (step === "reasons") {
    const toggle = (r: Reason) => setReasons(reasons.includes(r) ? reasons.filter((x) => x !== r) : [...reasons, r]);
    return (
      <section className="setup">
        {progress}
        <h2>what brings you here?</h2>
        <p className="lede">Pick as many as you like, or none.</p>
        <div className="chips">
          {REASONS.map(([r, label]) => (
            <button key={r} className={`chip${reasons.includes(r) ? " on" : ""}`} aria-pressed={reasons.includes(r)} onClick={() => toggle(r)}>{label}</button>
          ))}
        </div>
        {footer(<button onClick={next}>{reasons.length ? "next" : "skip"}</button>)}
      </section>
    );
  }

  if (step === "activity") {
    return (
      <section className="setup">
        {progress}
        <h2>how active is a typical week?</h2>
        <p className="lede">A rough idea is plenty.</p>
        <div className="choices">
          {ACTIVITIES.map(([a, label, hint]) => (
            <button key={a} className={`choice${activity === a ? " on" : ""}`} aria-pressed={activity === a} onClick={() => setActivity(a)}>
              <b>{label}</b><small>{hint}</small>
            </button>
          ))}
        </div>
        <h2 className="sub">which energy range should we start from?</h2>
        <p className="lede">Optional. It only sets the starting numbers, which you can change anytime.</p>
        <div className="chips">
          {RANGES.map(([r, label, hint]) => (
            <button key={r} className={`chip${range === r ? " on" : ""}`} aria-pressed={range === r} onClick={() => setRange(range === r ? null : r)}>
              {label} <small>· {hint}</small>
            </button>
          ))}
        </div>
        {footer(<button onClick={next}>{activity || range ? "next" : "skip"}</button>)}
      </section>
    );
  }

  if (step === "typical") {
    return (
      <section className="setup">
        {progress}
        <h2>build your typical day</h2>
        <p className="lede">
          Add what you'd normally eat on a regular day. Rough is totally fine. This won't count toward today's diary.
          Don't forget drinks (coffee, juice, soda) and your go-to snacks.
        </p>
        {typical.length > 0 && (
          <div className="typical">
            {MEALS.map((m) => {
              const items = typical.map((t, i) => [t, i] as const).filter(([t]) => t.meal === m);
              if (!items.length) return null;
              return (
                <div key={m}>
                  <h3 className={`meal meal-${m.toLowerCase()}`}>{m}</h3>
                  <ul className="list">
                    {items.map(([t, i]) => (
                      <li key={i}>
                        <div><b>{t.name}</b><small>{t.servings ? servingLabel(t.servings) : `${t.grams} ${t.unit}`}, <MacroText m={t} /></small></div>
                        <button className="ghost" onClick={() => setTypical(typical.filter((_, j) => j !== i))} aria-label={`Remove ${t.name}`}>Remove</button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="typical-total">Your typical day: <MacroText m={typicalTotal} /></p>
          </div>
        )}
        <FoodSearch customServings={customServings} onCustomServing={onCustomServing}
          onAdd={(item) => setTypical([...typical, item])} placeholder="Search foods, e.g. oatmeal" />
        {footer(
          <span className="footer-actions">
            {typical.length > 0 && <button className="ghost" onClick={() => toGoals([])}>skip, use a starting point</button>}
            <button onClick={() => toGoals(typical)}>{typical.length ? "that's my typical day" : "skip, use a starting point"}</button>
          </span>,
        )}
      </section>
    );
  }

  // Goals step.
  const goals = draft ?? suggestion.goals;
  const patterns: string[] = [];
  if (typicalUsable) {
    const byMeal = MEALS.map((m) => [m, sumMacros(typical.filter((t) => t.meal === m)).protein] as const);
    const [topMeal, topProtein] = byMeal.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (typicalTotal.protein > 0 && topProtein / typicalTotal.protein >= 0.5) patterns.push(`Most of your protein comes at ${topMeal.toLowerCase()}.`);
    if (!typical.some((t) => t.meal === "Breakfast")) patterns.push("Breakfast doesn't usually feature, which is totally fine.");
  }
  const labels: [keyof Macros, string, string][] = [["kcal", "Calories", "kcal"], ["protein", "Protein", "g"], ["carbs", "Carbs", "g"], ["fat", "Fat", "g"]];
  return (
    <section className="setup">
      {progress}
      {typicalUsable && (
        <div className="baseline">
          <h2>here's your typical day</h2>
          <p className="lede"><MacroText m={typicalTotal} /></p>
          {patterns.map((p) => <p key={p} className="note">{p}</p>)}
        </div>
      )}
      {typical.length > 0 && !typicalUsable && (
        <p className="note notice">
          Your typical day looks a little light for a whole day. Anything missing? Drinks and snacks are easy to forget.{" "}
          <button className="link" onClick={() => setStep("typical")}>add more</button>
          <br />For now, this starting point is based on your activity and energy range instead.
        </p>
      )}
      <h2>your starting point</h2>
      <p className="lede">A suggestion, not a rule. Adjust anything, or skip numbers and just track.</p>
      {suggestion.notes.map((n) => <p key={n} className="note">{n}</p>)}
      <div className="goals">
        {labels.map(([k, label, unit]) => (
          <label key={k}>{label} ({unit})
            <input type="number" min={0} value={goals[k]} onChange={(e) => setDraft({ ...goals, [k]: Number(e.target.value) })} />
          </label>
        ))}
      </div>
      {footer(
        <span className="footer-actions">
          <button className="ghost" onClick={() => onFinish({ ...answers(), targetsOn: false })}>no numbers, just track</button>
          <button onClick={() => onFinish({ ...answers(), targetsOn: true }, goals)}>use these goals</button>
        </span>,
      )}
    </section>
  );
}
