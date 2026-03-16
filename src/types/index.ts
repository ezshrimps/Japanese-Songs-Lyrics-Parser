export interface SavedGrammar {
  id: string;
  unit: GrammarUnit;
  sourceLine: string;
  savedAt: number;
}

export interface SavedLyric {
  id: string;
  title: string;
  content: string;
  parsedResult?: ParsedResult[];
  timestamps?: LineTimestamp[];
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
  kana: string;           // normalized hiragana of the full line, stored at parse time
  segments: Segment[];
  fullRomaji: string;
  chineseTranslation: string;
  grammarBreakdown: GrammarUnit[];
}

export interface LineTimestamp {
  lineIndex: number;
  startTime: number;
  endTime: number;
}
