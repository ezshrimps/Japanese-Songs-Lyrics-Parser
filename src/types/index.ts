export interface SavedLyric {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  savedAt: number;
}

export interface Segment {
  text: string;
  hiragana: string | null;
  romaji: string;
}

export interface GrammarUnit {
  text: string;
  hiragana: string;
  romaji: string;
  partOfSpeech: string;
  explanation: string;
}

export interface ParsedResult {
  originalText: string;
  segments: Segment[];
  fullRomaji: string;
  chineseTranslation: string;
  grammarBreakdown: GrammarUnit[];
}
