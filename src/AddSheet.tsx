import { useEffect } from "react";
import type { NewEntry } from "./db";
import FoodSearch from "./FoodSearch";

type Props = {
  meal: string;
  customServings: Record<string, number>;
  onCustomServing: (foodId: string, grams: number, save: boolean) => void;
  onAdd: (entry: NewEntry) => void;
  onClose: () => void;
  disabled?: boolean;
};

// A panel that slides up over the diary to search and add foods to one meal. It stays open so several foods
// can be added in a row; "done", the backdrop or Escape closes it.
export default function AddSheet({ meal, customServings, onCustomServing, onAdd, onClose, disabled }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Keep the diary behind the sheet from scrolling.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Add food to ${meal}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>add to {meal.toLowerCase()}</h2>
          <button className="link" onClick={onClose}>done</button>
        </div>
        <FoodSearch meal={meal} customServings={customServings} onCustomServing={onCustomServing} onAdd={onAdd} disabled={disabled} autoFocus />
      </div>
    </div>
  );
}
