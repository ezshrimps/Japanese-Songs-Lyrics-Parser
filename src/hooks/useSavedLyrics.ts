"use client";

import { useState, useEffect } from "react";
import { SavedLyric } from "@/types";

const STORAGE_KEY = "jlp_saved_lyrics";

export function useSavedLyrics() {
  const [items, setItems] = useState<SavedLyric[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const persist = (next: SavedLyric[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const save = (content: string) => {
    const title =
      content
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? "无题";
    const item: SavedLyric = {
      id: Date.now().toString(),
      title: title.slice(0, 40),
      content,
      pinned: false,
      savedAt: Date.now(),
    };
    persist([item, ...items]);
  };

  const remove = (id: string) => persist(items.filter((i) => i.id !== id));

  const rename = (id: string, title: string) =>
    persist(items.map((i) => (i.id === id ? { ...i, title } : i)));

  const togglePin = (id: string) =>
    persist(items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)));

  // Pinned items first, both groups sorted newest first
  const sorted = [
    ...items.filter((i) => i.pinned).sort((a, b) => b.savedAt - a.savedAt),
    ...items.filter((i) => !i.pinned).sort((a, b) => b.savedAt - a.savedAt),
  ];

  return { saved: sorted, save, remove, rename, togglePin };
}
