import type { Macros } from "./api";
import type { Activity, Reason } from "./db";

// Suggested starting goals, worked out from what someone already eats (their typical day) or, without one,
// from their activity level. No body measurements are used. Everything here is a starting point the user can edit.

export const REASONS: [Reason, string][] = [
  ["understand", "Understand what I eat"],
  ["energy", "Feel more energized"],
  ["strength", "Build strength"],
  ["balanced", "Eat more balanced meals"],
  ["lighter", "Eat a little lighter"],
  ["fuel", "Eat more / fuel up"],
  ["unsure", "Not sure yet"],
];

export const ACTIVITIES: [Activity, string, string][] = [
  ["low", "Mostly sitting", "desk days, not much exercise"],
  ["moderate", "On my feet a fair bit", "walking, chores, some workouts"],
  ["high", "Very active", "workouts most days or a physical job"],
];

// Starting calories when there's no typical day to go on. Deliberately modest and the same for everyone;
// people adjust from here as they learn what feels right.
const BY_ACTIVITY: Record<Activity, number> = { low: 1800, moderate: 2000, high: 2200 };
// Everyday protein goal in grams; building strength adds STRENGTH_PROTEIN on top.
const PROTEIN = 100;
const STRENGTH_PROTEIN = 20;
// Never suggest fewer calories than this, whatever the inputs.
export const CALORIE_FLOOR = 1400;
// "Eat a little lighter" never cuts more than this from the starting point.
const MAX_CUT = 200;
// How far the first protein goal may sit above the typical day, so the change stays easy to reach.
const PROTEIN_STEP = 15;

// A typical day is only used as a baseline if it looks like a whole day of eating.
export const looksComplete = (items: number, kcal: number) => items >= 3 && kcal >= 1000 && kcal <= 5000;

const round = (n: number, to: number) => Math.round(n / to) * to;

export function suggestGoals(reasons: Reason[], activity: Activity | null, typical: Macros | null) {
  const has = (r: Reason) => reasons.includes(r);
  const notes: string[] = [];

  const start = typical?.kcal ?? BY_ACTIVITY[activity ?? "moderate"];
  const from = typical ? "your typical day" : "a typical starting point";
  let kcal = start;
  if (has("lighter") && !has("fuel")) {
    kcal = Math.max(start * 0.9, start - MAX_CUT);
    notes.push(`A little lighter than ${from}, a gentle change.`);
  } else if (has("fuel")) {
    kcal = start * 1.1;
    notes.push(`About 10% more than ${from}, to help you fuel up.`);
  } else if (has("strength")) {
    notes.push(`The same calories as ${from}, with extra protein to support building strength.`);
  } else {
    notes.push(typical ? "The same as your typical day, so you can see how it compares." : "A balanced everyday starting point.");
  }
  kcal = Math.max(CALORIE_FLOOR, round(kcal, 50));

  let protein = PROTEIN + (has("strength") ? STRENGTH_PROTEIN : 0);
  if (typical) {
    if (protein > typical.protein + PROTEIN_STEP) {
      protein = round(typical.protein + PROTEIN_STEP, 5);
      notes.push(`Protein starts a little above your typical ${Math.round(typical.protein)} g. You can raise it whenever it feels easy.`);
    } else if (typical.protein > protein) {
      protein = round(typical.protein, 5); // already eating more than the suggestion; don't ask for less
    }
  }
  const fat = round((kcal * 0.3) / 9, 5);
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));
  return { goals: { kcal, protein, carbs, fat }, notes };
}
