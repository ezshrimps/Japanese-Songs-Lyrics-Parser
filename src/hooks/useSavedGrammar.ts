"use client";

import { useState, useEffect } from "react";
import { SavedGrammar, GrammarUnit } from "@/types";

const STORAGE_KEY = "jlp_saved_grammar";

export function grammarId(unit: GrammarUnit): string {
  return `${unit.text}|${unit.hiragana}|${unit.partOfSpeech}`;
}

export function useSavedGrammar() {
  const [items, setItems] = useState<SavedGrammar[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = (next: SavedGrammar[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const save = (unit: GrammarUnit, sourceLine: string) => {
    const id = grammarId(unit);
    if (items.some((i) => i.id === id)) return; // already saved
    persist([{ id, unit, sourceLine, savedAt: Date.now() }, ...items]);
  };

  const remove = (id: string) => persist(items.filter((i) => i.id !== id));

  const savedIds = new Set(items.map((i) => i.id));

  return { savedGrammar: items, savedIds, save, remove };
}
