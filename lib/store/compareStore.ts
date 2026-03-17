import { create } from "zustand";

export type CompareItemType = "partido" | "formula" | "candidato";

export interface CompareItem {
  id: string;
  type: CompareItemType;
  slug: string;
  name: string;
  color: string;
  initials: string;
}

interface CompareStore {
  items: CompareItem[];
  canAdd: boolean;
  addItem: (item: CompareItem) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  items: [],
  canAdd: true,
  addItem: (item) => {
    const { items } = get();
    // Different type → clear first
    const base = items.length > 0 && items[0].type !== item.type ? [] : items;
    if (base.some((i) => i.id === item.id)) return;
    if (base.length >= 3) return;
    const next = [...base, item];
    set({ items: next, canAdd: next.length < 3 });
  },
  removeItem: (id) => {
    const next = get().items.filter((i) => i.id !== id);
    set({ items: next, canAdd: next.length < 3 });
  },
  clearAll: () => set({ items: [], canAdd: true }),
}));

export function makeInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
