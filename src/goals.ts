import type { Macros } from "./api";
import type { Activity, EnergyRange, Reason } from "./db";

// Suggested starting goals, worked out from what someone already eats (their typical day) or, without one,
// from their activity level and an optional energy range. No body measurements are used. Everything here is a starting point the user can edit.

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

// Optional, so the starting numbers fit both smaller and larger energy needs without asking about bodies.
export const RANGES: [EnergyRange, string, string][] = [
  ["lower", "Lower", "common for most women"],
  ["middle", "In between", "somewhere in the middle, or not sure"],
  ["higher", "Higher", "common for most men"],
];
// Skipping the question uses the lower range: the app is mostly used by women, and starting lower is gentler.
const DEFAULT_RANGE: EnergyRange = "lower";

// Starting calories when there's no typical day to go on, roughly following US dietary guideline estimates.
const BY_ACTIVITY: Record<EnergyRange, Record<Activity, number>> = {
  lower: { low: 1700, moderate: 1900, high: 2200 },
  middle: { low: 1950, moderate: 2200, high: 2500 },
  higher: { low: 2200, moderate: 2500, high: 2800 },
};
// Everyday protein goals in grams; building strength adds STRENGTH_PROTEIN on top.
const PROTEIN: Record<EnergyRange, number> = { lower: 100, middle: 115, higher: 130 };
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

export function suggestGoals(reasons: Reason[], activity: Activity | null, range: EnergyRange | null, typical: Macros | null) {
  const has = (r: Reason) => reasons.includes(r);
  const notes: string[] = [];
  const r = range ?? DEFAULT_RANGE;

  const start = typical?.kcal ?? BY_ACTIVITY[r][activity ?? "moderate"];
  const from = typical ? "your typical day" : "a typical starting point";
  let kcal = start;
  if (has("lighter") && !has("fuel")) {
    kcal = Math.max(start * 0.9, start - MAX_CUT);
    notes.push(`A little lighter than ${from}, a gentle change.`);
  } else if (has("fuel")) {
    kcal = start * 1.1;
    notes.push(`About 10% more than ${from}, to help you fuel up.`);
  } else if (has("strength")) {
    kcal = start * 1.05;
    notes.push(`A touch more than ${from}, with extra protein to support building strength.`);
  } else {
    notes.push(typical ? "The same as your typical day, so you can see how it compares." : "A balanced everyday starting point.");
  }
  kcal = Math.max(CALORIE_FLOOR, round(kcal, 50));

  let protein = PROTEIN[r] + (has("strength") ? STRENGTH_PROTEIN : 0);
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
