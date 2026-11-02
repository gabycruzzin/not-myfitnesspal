import { createClient } from "@supabase/supabase-js";
import type { Macros } from "./api";

// Set these in .env.local (see .env.example). The anon key is meant to be public; row level security
// in supabase/schema.sql is what keeps each user's data private.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

// grams is the logged amount in `unit` (g, or ml for drinks).
export type Entry = Macros & { id: string; name: string; grams: number; unit: string; servings: number | null; meal: string };
export type NewEntry = Omit<Entry, "id">;

export const DEFAULT_GOALS: Macros = { kcal: 2000, protein: 150, carbs: 200, fat: 65 };

const db = () => {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
};
const ENTRY_COLUMNS = "id, name, grams, unit, servings, meal, kcal, protein, carbs, fat";

export async function loadDay(day: string): Promise<Entry[]> {
  const { data, error } = await db().from("diary_entries").select(ENTRY_COLUMNS).eq("day", day).order("created_at");
  if (error) throw error;
  return data;
}

export async function addEntry(day: string, entry: NewEntry): Promise<Entry> {
  const { data, error } = await db().from("diary_entries").insert({ ...entry, day }).select(ENTRY_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function removeEntry(id: string) {
  const { error } = await db().from("diary_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function loadGoals(): Promise<Macros> {
  const { data, error } = await db().from("goals").select("kcal, protein, carbs, fat").maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_GOALS;
}

export async function saveGoals(goals: Macros) {
  const { error } = await db().from("goals").upsert({ ...goals, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function loadCustomServings(): Promise<Record<string, number>> {
  const { data, error } = await db().from("custom_servings").select("food_id, grams");
  if (error) throw error;
  return Object.fromEntries(data.map((r) => [r.food_id, Number(r.grams)]));
}

export async function saveCustomServing(foodId: string, grams: number) {
  const { error } = await db().from("custom_servings").upsert({ food_id: foodId, grams });
  if (error) throw error;
}

// What older versions of the app kept in this browser's localStorage.
type LocalEntry = Macros & { name: string; grams: number; unit?: string; servings?: number; meal: string };
const IMPORT_FLAG = "importedLocalData";

// Copies diary, goals and custom serving sizes saved in this browser into the signed-in account, once per browser.
// Returns how many diary entries were imported (0 if there was nothing to import or it already happened).
export async function importLocalData(): Promise<number> {
  try {
    if (localStorage.getItem(IMPORT_FLAG)) return 0;
    const diary = JSON.parse(localStorage.getItem("diary") ?? "{}") as Record<string, LocalEntry[]>;
    const goals = JSON.parse(localStorage.getItem("goals") ?? "null") as Macros | null;
    const custom = JSON.parse(localStorage.getItem("customServings") ?? "{}") as Record<string, number>;

    const rows = Object.entries(diary).flatMap(([day, entries]) =>
      entries.map((e) => ({
        day, meal: e.meal, name: e.name, grams: e.grams, unit: e.unit ?? "g", servings: e.servings ?? null,
        kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat,
      })),
    );
    if (rows.length) {
      const { error } = await db().from("diary_entries").insert(rows);
      if (error) throw error;
    }
    // Keep the old data as a backup, but never import the diary twice, even if a step below fails.
    localStorage.setItem(IMPORT_FLAG, new Date().toISOString());
    if (goals) await saveGoals(goals);
    const servingRows = Object.entries(custom).map(([food_id, grams]) => ({ food_id, grams }));
    if (servingRows.length) {
      const { error } = await db().from("custom_servings").upsert(servingRows);
      if (error) throw error;
    }
    return rows.length;
  } catch (e) {
    console.error("Importing browser data failed", e);
    return 0;
  }
}
