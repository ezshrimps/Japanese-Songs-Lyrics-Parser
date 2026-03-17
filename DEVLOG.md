# Building a Japanese Lyrics Parser with Claude — A Developer's Devlog

> How I built a full-stack AI-powered web app through conversational pair programming, and what I learned about collaborating with an LLM as a coding partner.

---

## Motivation

I came across a Bilibili creator ([卷心儿](https://space.bilibili.com/)) who posts beautifully formatted Japanese lyric breakdowns — hiragana annotations above every kanji, romaji below, Chinese translation, and a grammar card for each word. Doing this manually for every song is painstaking. I wanted to automate it into a web app.

The constraint I set for myself: build it entirely through a conversation with Claude. No pre-written boilerplate, no copying from previous projects — start from a README and a reference screenshot, and get to a working product purely through iterative back-and-forth.

---

## Phase 1: Briefing Claude with a Reference Image

The first thing I did was write a detailed README describing the project, embed the Bilibili reference screenshot in it, and tell Claude:

> "Read the README, understand the photo, ask me anything you're not sure about, then start building."

Claude asked three clarifying questions before writing a single line of code:

1. **Tech stack?** → Next.js 15
2. **Which AI API?** → Anthropic Claude
3. **Translation language — selector or fixed?** → Fixed Chinese

This upfront clarification step mattered. By the time Claude started scaffolding, it had a clear mental model of the end state. The initial output was a complete project skeleton: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, all four source layers (`types`, `api`, `components`, `hooks`), and a `.env.local.example`.

---

## Phase 2: The First Real Bug — JSON Parsing Failure

Once I wired up my API key and tested the parser, I got:

```
⚠ Failed to parse lyrics. Please try again.
```

I told Claude to debug it. The root cause turned out to be a subtle but serious problem: Claude (the AI being called *inside* the app) was returning Chinese text inside a JSON string, and that text contained unescaped double-quote characters. For example:

```json
"explanation": "意为"事情"，是..."
```

The inner `"事情"` broke JSON.parse at position 1042. Regular expression cleanup was fragile — it couldn't reliably distinguish structural quotes from content quotes in arbitrary Chinese text.

### The Fix: Switching to Tool Use

Instead of trying to parse Claude's free-text response, I switched the entire API integration to **Tool Use** (Anthropic's structured output feature). The idea is simple: instead of asking Claude to "return JSON", you define a typed schema as a tool and *force* Claude to call it. The SDK then gives you a native JavaScript object — no string parsing involved at all.

```typescript
const message = await client.messages.create({
  model: "claude-opus-4-6",
  tools: [TOOL],
  tool_choice: { type: "tool", name: "analyze_lyrics" }, // forced
  messages: [{ role: "user", content: lyrics }],
});

const toolUse = message.content.find((c) => c.type === "tool_use");
const { lines } = toolUse.input as { lines: ... };
```

With `tool_choice: { type: "tool", name: "..." }`, Claude has no option to respond with prose — it must populate the schema fields. This completely eliminated the JSON escaping problem.

There was one remaining edge case: even with tool use, Claude occasionally serialized array fields (`segments`, `grammarBreakdown`) as JSON *strings* rather than actual arrays. I added a defensive normalizer:

```typescript
function normalizeLineData(line: Record<string, unknown>): ParsedResult {
  for (const key of ["segments", "grammarBreakdown"] as const) {
    if (typeof line[key] === "string") {
      try { line[key] = JSON.parse(line[key] as string); }
      catch { line[key] = []; }
    }
  }
  return line as unknown as ParsedResult;
}
```

**Lesson:** When using LLMs to produce structured data, don't fight the text format — use the model's native structured output primitives. Tool Use / function calling is categorically more reliable than `JSON.parse(response.text)`.

---

## Phase 3: The Tool Schema Design

The schema I settled on captures everything needed to render a full lyric card. Per line:

```typescript
interface ParsedResult {
  originalText: string;        // original Japanese
  segments: Segment[];         // for ruby annotation
  fullRomaji: string;          // whole line in romaji
  chineseTranslation: string;  // contextual translation
  grammarBreakdown: GrammarUnit[];
}

interface Segment {
  text: string;
  hiragana: string | null; // null for pure kana — no annotation needed
  romaji: string;
}

interface GrammarUnit {
  text: string;
  hiragana: string;
  romaji: string;
  partOfSpeech: string;   // 名词/动词/助词...
  explanation: string;    // detailed Chinese explanation
}
```

The `hiragana: null` convention for pure kana segments is important — it lets the renderer skip the `<ruby>` wrapper for segments that don't need annotation, rather than showing a ruby annotation that mirrors the text itself.

### System Prompt Engineering

The system prompt does two things beyond basic instructions:

1. **Segment boundary rules** — telling Claude to split at natural morpheme boundaries, not character boundaries. This ensures `浮いている` is rendered as `<ruby>浮<rt>う</rt></ruby>いている` rather than annotating the trailing conjugation.

2. **Quote sanitization** — `Use 「」brackets for word meanings — never use ASCII double-quote characters`. This is a belt-and-suspenders precaution even with tool use, because explanation text goes into a string field that could still cause display issues if it contained stray quotes.

---

## Phase 4: Scaling to Full Songs

The initial implementation parsed one line at a time. I wanted to paste an entire song (~20 lines) and get everything back in one tap.

I described the requirement to Claude conversationally:

> "When I put the whole lyrics of a song, it only parses the first sentence. My real point is to parse the whole song in one single tap."

The changes were straightforward once the architecture was clear:

- Wrap the tool schema output in `{ lines: ParsedResult[] }` instead of a single object
- Raise `max_tokens` from `2048` to `16000` (a full song's analysis is verbose)
- Add blank-line filtering before sending (verse separators shouldn't become entries)
- Raise the input character limit to `5000`

```typescript
const nonEmptyLyrics = lyrics
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .join("\n");
```

This made a full J-pop song (≈20 lines) parseable in a single 20–40 second request.

---

## Phase 5: UI — Iterative Redesign

The UI went through several full rewrites. My approach throughout was to describe what I wanted visually and let Claude translate that into code. I never wrote a single CSS rule or JSX block directly.

### First Pass: Aurora Dark Theme

I asked for a "nice looking interface" and got:
- Aurora radial gradients (coral top-right, teal bottom-left) over `#07090e`
- White lyric cards with drop shadows and staggered `fadeInUp` animations
- Glass morphism sidebar with `backdropFilter: blur(24px)`
- Gradient title "歌詞解析" (coral → teal)

### Second Pass: Spec-Driven Dark Reconstruction

Later I provided a detailed design spec (inspired by modern code editor aesthetics) describing exact measurements, colors, and behaviors. Key decisions from that spec:

**Layout:**
- 52px sticky header (`position: fixed`, `z-index: 50`)
- Sidebar as `position: fixed` with `transform: translateX(0/-260px)` — not a width animation, which causes layout reflow. The main content area offsets with `margin-left: 260px / 0` transition instead.

**Color system:**
- Background: `#0f0f0f`
- Cards: `#1a1a1a` with `#2e2e2e` borders
- Grammar cards: `#141414` with `#272727` borders
- Japanese text: `#f0f0f0` (white, not coral — coral is reserved for UI accents)
- Furigana: orange `#f0956c` (matching the gradient title)
- Romaji: italic `#888`
- Translation: blue pill `rgba(74,158,255,0.1)` bg / `#4a9eff` text

**Grammar card left stripe:** uses a warm palette (`#EEC170`, `#F2A65A`, `#F58549`, `#585123`, `#772F1A`) mapped to parts of speech, providing visual scanning without bright colors clashing against the dark background.

### CSS Technique: Smooth Expand/Collapse Without `max-height` Jank

The grammar panel expand/collapse uses a CSS grid trick instead of the typical `max-height` approach:

```css
.grammar-grid-wrapper {
  display: grid;
  transition: grid-template-rows 0.28s ease, opacity 0.25s ease;
}
.grammar-grid-wrapper.open   { grid-template-rows: 1fr; opacity: 1; }
.grammar-grid-wrapper.closed { grid-template-rows: 0fr; opacity: 0; }
.grammar-grid-inner { overflow: hidden; }
```

The `max-height` approach has a well-known problem: the closing animation is slow if `max-height` is set much larger than the actual content. The grid trick transitions between exactly `0` and the natural content height, giving a smooth, tight animation in both directions.

---

## Phase 6: Saved Lyrics Feature

I described what I wanted in one message:

> "Add a save button. Basic functions: rename, delete, pin. List on the left side."

Claude designed the entire feature:

**`useSavedLyrics` hook** — all persistence logic encapsulated, separated from UI:

```typescript
const STORAGE_KEY = "jlp_saved_lyrics";

export function useSavedLyrics() {
  const [items, setItems] = useState<SavedLyric[]>([]);

  // hydrate from localStorage on mount
  useEffect(() => { /* ... */ }, []);

  const save    = (content: string, parsedResult?: ParsedResult[]) => { /* ... */ };
  const remove  = (id: string) => { /* ... */ };
  const rename  = (id: string, title: string) => { /* ... */ };
  const togglePin = (id: string) => { /* ... */ };

  // pinned first, both groups newest-first
  const sorted = [
    ...items.filter(i => i.pinned).sort((a, b) => b.savedAt - a.savedAt),
    ...items.filter(i => !i.pinned).sort((a, b) => b.savedAt - a.savedAt),
  ];

  return { saved: sorted, save, remove, rename, togglePin };
}
```

**Auto-title** — the first non-empty line of the lyrics becomes the entry title (truncated to 40 chars), so I never have to name anything manually.

**Parsed result persistence** — I later extended this to also save the `ParsedResult[]` alongside the raw lyrics text. Loading a saved entry now instantly restores the full analysis without a re-parse API call.

---

## Phase 7: Debugging Workflow

When things broke, my pattern was always:
1. Describe the symptom to Claude ("still getting parse error")
2. Claude would hypothesize the cause
3. I'd confirm or deny based on what I was seeing
4. Claude would produce a targeted fix

One example: after a code session, the dev server wouldn't start:
```
Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
```
This was a stale `.next` cache from a previous Turbopack build conflicting with new chunks. Fix: `rm -rf .next`. Claude recognized the pattern immediately.

Another common issue was port conflicts when restarting the dev server. Claude would run `pkill -f "next dev"` and `lsof -ti tcp:3000 | xargs kill -9` to clear them.

---

## Architecture Summary

```
Browser
  └── page.tsx (client component)
        ├── useSavedLyrics (localStorage hook)
        ├── SavedLyricsSidebar
        ├── Input form → POST /api/parse
        └── LyricsDisplay
              └── LyricLineCard (×N lines)
                    └── GrammarCard (×M words)

Server
  └── /api/parse (Next.js Route Handler)
        └── Anthropic SDK
              └── claude-opus-4-6
                    └── Tool Use: analyze_lyrics
```

No database. No auth. No build-time data fetching. The only server-side work is proxying the Anthropic API call (to keep the API key out of the browser). Everything else is client-side React state and `localStorage`.

---

## What Made This Collaboration Work

### 1. Leading with constraints, not solutions
Rather than saying "write a function that does X", I'd describe the user-facing goal and let Claude pick the implementation. "Parse a full song in one tap" led to a better architecture than "change the schema to an array" would have.

### 2. Showing reference material
Giving Claude the Bilibili screenshot alongside the README produced a first-pass UI that was directionally correct. Visual references communicate proportions, hierarchy, and mood faster than text descriptions.

### 3. Iterating on specs, not diffs
For the UI redesign, I wrote a detailed spec (colors, heights, transitions, component behavior) rather than asking for incremental tweaks. Claude could then rebuild entire files coherently rather than layering patches.

### 4. Trusting the debugging loop
When something broke, I didn't try to fix it myself first — I described the symptom and let Claude trace the root cause. Claude's ability to hold the entire codebase in context and reason about where a `JSON.parse` failure at position 1042 was coming from saved a lot of time.

### 5. One concern at a time
Each message addressed one thing: "add save functionality", "make cards wider", "change the furigana color". Compound requests ("add save + redesign the header + fix the parse bug") tend to produce messier results.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 + inline styles |
| AI | Anthropic Claude `claude-opus-4-6` via Tool Use |
| Font | Noto Sans JP (Google Fonts, `preload: false`) |
| Storage | Browser `localStorage` |
| Deployment | — |

---

## Time Spent

The entire project — from blank directory to feature-complete dark-theme app — was built in a single extended conversation with Claude. No pre-written code was brought in. Every file was either generated or iterated through Claude's edits.

The conversation covered: initial scaffolding → first bug fix (Tool Use migration) → multi-line support → three UI redesigns → saved lyrics feature → dark theme reconstruction → incremental visual polish.

---

## Phase 8: Audio Alignment — Adding Timestamps to Lyrics

The next major feature: click any lyric line and hear it play from the right position in the song. This required mapping each lyric line to a `{startTime, endTime}` range in the audio.

### The Core Problem

Japanese alignment is hard. A forced aligner needs to know phoneme boundaries, but:
- Japanese lyrics contain kanji (no phonetic info)
- The reading of a kanji changes with context
- Standard ASR models often output hiragana OR kanji inconsistently

The approach chosen: **WhisperX** via Replicate (`victor-upmeet/whisperx`). WhisperX runs Whisper ASR + Montreal Forced Aligner under the hood and returns character-level word timestamps for Japanese — roughly one `{word, start, end}` entry per kana character.

### Storing Kana at Parse Time

To feed WhisperX a phonetic hint and to support alignment without re-parsing, I added a `kana` field to `ParsedResult`:

```typescript
interface ParsedResult {
  originalText: string;
  kana: string;  // normalized hiragana, stored at parse time
  segments: Segment[];
  // ...
}
```

This is computed right after Claude returns the analysis, by joining `segment.hiragana ?? segment.text` and normalizing katakana → hiragana + stripping punctuation. It gets persisted in localStorage alongside the parsed result, so a saved lyric loaded weeks later can still be aligned without re-parsing.

### WhisperX `initial_prompt`

WhisperX has a Whisper-compatible `initial_prompt` parameter. Passing the normalized kana reading of all lyrics (joined with Japanese spaces `　`) biases the ASR output toward hiragana rather than kanji, making alignment much easier downstream:

```typescript
initial_prompt: kana.filter((_, i) => lines[i]?.trim())
                    .map((k) => norm(k))
                    .join("　"),
```

---

## Phase 9: The Alignment Algorithm Journey

Getting accurate line → timestamp mapping took several iterations.

### Attempt 1: Subsequence Matching

The first algorithm tried to match the kana reading of each lyric line against WhisperX's word list using subsequence search. It worked in simple cases but had a critical bug: when WhisperX misread a kanji (e.g., outputting 群れ instead of 胸), the `nextKanaChar` lookahead returned a character not present in the remaining query. A `while` loop would then exhaust the kana pointer, ending the line prematurely. Every subsequent line would cascade from the wrong start position.

The fix: replace the `while` loop with `indexOf`:

```typescript
// Before (buggy — could exhaust ki):
while (ki < query.length && query[ki] !== nk) ki++;

// After (safe — skips nothing if nk not found):
const nkIdx = nk ? query.indexOf(nk, ki) : -1;
if (nkIdx !== -1) ki = nkIdx;
```

### Attempt 2: LLM Alignment Layer

To handle kanji misreads more robustly, I added a Claude Haiku layer between WhisperX and the final timestamps. Haiku receives a compact word list (`0:あ 1:な 2:た ...`) and a lyric list, then returns `{lineIndex, startWordIdx, endWordIdx}` for each line using a `map_lyrics` tool call.

This was then combined with a `snapToChar` correction function that searches ±3 words from Haiku's suggestion to find the exact word whose normalized first character matches the expected kana:

```typescript
const snapToChar = (base, target, radius, direction) => {
  for (let d = 0; d <= radius; d++) {
    for (const candidate of [base + d * direction, base - d * direction]) {
      if (norm(words[candidate].word)[0] === target) return candidate;
    }
  }
  return base;
};
```

A subtle bug: both `snapToChar` calls (for start and end) needed direction `+1` (forward), because Haiku tends to be conservative and return indices slightly before the actual boundary.

### Final Approach: Pure Count-Based Alignment

After sufficient testing, the simplest approach proved most reliable: WhisperX with `align_output: true` outputs character-level tokens for Japanese (one word ≈ one kana character). Each lyric line simply consumes `norm(kana).length` consecutive words from the list, sequentially.

```
あいはどこからやってくるのでしょう  →  17 chars  →  words[0..16]
じぶんのむねにといかけた            →  12 chars  →  words[17..28]
```

No LLM, no lookahead, no drift correction. Deterministic and fast.

---

## Phase 10: Audio Playback — Precision Matters

Implementing click-to-seek playback surfaced several non-obvious bugs.

### Bug 1: Segment Overshoot (~250ms)

The first implementation used `timeupdate` to detect when playback crossed the segment end boundary. `timeupdate` fires every ~250ms, meaning audio could play up to a quarter-second into the next line before being stopped.

Fix: replace `timeupdate` boundary detection with `setTimeout` calculated at seek time:

```typescript
const scheduleStop = (endTime: number, startedAt: number) => {
  const remaining = (endTime - startedAt) * 1000;
  segmentTimerRef.current = setTimeout(stopSegment, Math.max(0, remaining));
};
```

This achieves ~1–10ms precision vs ~250ms with polling.

### Bug 2: `play()` AbortError Race

Calling `audio.pause()` immediately after `audio.play()` (before the Promise resolves) throws an `AbortError`. This happened when switching quickly between lines.

Fix: track the in-flight `play()` Promise and always await it before pausing:

```typescript
const safePlay = async () => {
  pendingPlayRef.current = audio.play();
  await pendingPlayRef.current;
  pendingPlayRef.current = null;
};

const safePause = async () => {
  if (pendingPlayRef.current) {
    try { await pendingPlayRef.current; } catch { /* AbortError ok */ }
  }
  audio.pause();
};
```

### Bug 3: Stale Closures

`isPlaying` and `activeLineIndex` state values were stale inside event handlers due to React's closure capture. Fix: mirror state into refs that event handlers read from directly:

```typescript
const activeLineRef = useRef<number | null>(null);
const setActiveLine = (idx: number | null) => {
  activeLineRef.current = idx;
  setActiveLineIndex(idx);
};
```

---

## Phase 11: Forced-Alignment Experiments (Dead End)

I explored replacing WhisperX with dedicated forced-alignment models that take an audio file + transcript and return precise word timestamps — potentially more accurate than ASR-based alignment.

### Attempt 1: `quinten-kamphuis/forced-alignment`

**Result:** Failed with `The batch dimension for log_probs must be 1 at the current version`. The model has a hard limit: it can only process a single short segment, not a full song's worth of tokens. No parameters available to work around this.

### Attempt 2: `cureau/force-align-wordstamps`

**Result:** Returned a single entry with an empty word and timestamps at the very end of the audio (260s). The model did not align the romaji transcript to the Japanese audio at all — likely because it doesn't support Japanese.

Several transcript formats were tried: kana characters space-delimited (model returned equal-interval distribution from 00:00), then romaji words (single empty result).

**Conclusion:** Both models are designed for clean speech recordings in supported languages, not music with instrumental sections and Japanese content. WhisperX remains the right tool for this use case.

These experiments live in the `force-alignment` git branch for reference.

---

## Phase 12: Batched Parallel Parsing for Long Lyrics

**Symptom:** Parsing a full song (60+ unique lines) took 271 seconds and then crashed with `(lines ?? []).map is not a function`.

**Root cause:** A single Claude request for 60 lines approached the `max_tokens: 32000` limit. The response was truncated mid-JSON, and in at least one case the `lines` array was serialized as a JSON string rather than a native array — a rare but real Claude tool-use edge case.

**Fix 1 — Batched parallel requests:** Split unique lines into 25-line chunks and run all batches concurrently with `Promise.all`:

```typescript
const batches: string[][] = [];
for (let i = 0; i < uniqueLines.length; i += BATCH_SIZE) {
  batches.push(uniqueLines.slice(i, i + BATCH_SIZE));
}
const batchResults = await Promise.all(batches.map(parseBatch));
const normalized = batchResults.flat();
```

50 lines now takes the same time as 25 lines (parallel). 100 lines takes ~1/4 the original time.

**Fix 2 — Defensive `lines` parsing:** With more API calls per session, the probability of hitting the JSON-string edge case increased. Added explicit type detection:

```typescript
let lines: Record<string, unknown>[];
if (Array.isArray(rawLines)) {
  lines = rawLines;
} else if (typeof rawLines === "string") {
  try { lines = JSON.parse(rawLines); } catch { lines = []; }
} else {
  lines = [];
}
```

The input character limit was also raised from 5000 to 15000 to accommodate full songs.

---

## Branch History

| Branch | Purpose |
|--------|---------|
| `main` | Current production version (WhisperX + batched parsing) |
| `original` | Snapshot of the pre-alignment codebase |
| `whisperx` | Same as main (source branch before promotion) |
| `force-alignment` | Forced-alignment experiments — both models failed for Japanese music |

---

## Phase 13: Replicate Experiment — A Dead End

After the WhisperX work, I experimented with switching the **lyrics parser** itself to a different model via Replicate (`claude-4.5-sonnet`). The idea was to reduce Anthropic API costs by routing through Replicate's pricing.

It didn't stick. The Replicate wrapper adds latency without meaningful cost savings for this use case, and maintaining two SDK integrations added complexity for no user-visible benefit. One commit later it was reverted back to the Anthropic SDK with `claude-sonnet-4-6`.

**Lesson:** Routing API calls through intermediary platforms makes sense at high volume. For a tool still in active development, the debugging overhead isn't worth it.

---

## Phase 14: Level Selector + Visual Polish + CSV Export

### Japanese Level Selector (初级 / 中级 / 高级)

I added a vertical level picker to the left of the input card — three buttons color-coded green / blue / purple. The selected level is passed to the parse API and changes how the grammar breakdown is filtered:

- **初级**: All grammar units, full explanations — nothing skipped
- **中级**: Common particles and pronouns deprioritized; focus on conjugations and grammatical patterns
- **高级**: Only N3+ grammar (advanced conditionals, passive/causative, honorifics, compound particles)

This makes the tool genuinely useful across different learner profiles without complicating the UI — the level selector is the only knob.

### CSV Export

Users can now download all saved grammar cards as a CSV file. Each row: lyric line, Japanese term, hiragana, romaji, part of speech, explanation. The format is Anki-ready — paste directly into a flashcard deck.

### POS Color Map Stabilization

The part-of-speech color stripe on grammar cards went through several iterations before settling:

```
動詞 → #4A90E8 (blue)
名詞 → #E8634A (coral)
形容 → #9B59B6 (purple)
副詞 → #27AE60 (green)
助詞/接続 → #38BCD4 (teal)
```

A bug where all cards rendered the same color was traced to a CSS specificity issue — inline styles were overriding the Tailwind class that read the POS value. Fixed by computing the color in the component and applying it directly as a style prop.

The system prompt was also updated to enforce **Simplified Chinese** (简体中文) for all `partOfSpeech` values. Without this, Claude would sometimes output Traditional Chinese or Japanese-script POS labels, breaking the color lookup.

---

## Phase 15: Architecture Overhaul — kuromoji + DeepL + On-Demand Grammar

This was the biggest architectural change since Phase 2. The original design called a single Claude endpoint that did everything: segmentation, furigana, romaji, translation, and grammar breakdown — all in one request, for all lines. It worked but had serious cost and speed problems at scale.

### The New Pipeline

```
Before:  lyrics → Claude (opus-4-6) → {segments + furigana + romaji + translation + grammar}
After:   lyrics → kuromoji (local)  → {segments + furigana + romaji}
                → DeepL API (batch) → {translation per line}
                → Gemini / Haiku (on-demand, per expand) → {grammar breakdown}
```

**kuromoji** is a pure-JavaScript Japanese morphological analyzer. It runs entirely in Node.js — no external API call, no cost, no latency beyond CPU time. It produces:
- Morpheme segmentation (exactly the boundaries needed for `<ruby>` tags)
- Hiragana readings for kanji segments
- Part-of-speech tags (used to filter katakana words that don't need furigana)

**DeepL** translates all lines in a single batched request. The free tier allows 500k characters/month, which is essentially unlimited for a lyrics tool.

**Grammar breakdown is now lazy.** When a line is parsed, `grammarBreakdown` is an empty array. The grammar panel's expand button triggers a fresh API call for that line only, fetching and caching the result client-side. The first expand shows a spinner; subsequent expands are instant.

```typescript
// LyricLineCard: grammar loaded once per session, cached in component state
const [grammar, setGrammar] = useState<GrammarUnit[]>([]);
const [grammarLoaded, setGrammarLoaded] = useState(false);

const handleExpand = async () => {
  if (!grammarLoaded) {
    const res = await fetch("/api/grammar", { method: "POST", body: JSON.stringify({ line }) });
    const data = await res.json();
    setGrammar(data.units);
    setGrammarLoaded(true);
  }
  setOpen((prev) => !prev);
};
```

**Result:** A full 40-line song parse now costs ~$0 in AI API fees. Grammar costs only accrue for lines the user actually opens.

### Handling kuromoji Edge Cases

kuromoji segments lyrics mechanically — it doesn't understand song-specific merged lines (e.g., two lyric lines concatenated with a `・`). A pre-processing step splits on common separators before feeding to kuromoji:

```typescript
const lines = rawInput
  .split(/[・\n]/)
  .map(l => l.trim())
  .filter(Boolean);
```

This prevents single-segment outputs for merged lines and keeps the segment count consistent with WhisperX's word list.

---

## Phase 16: Credits System

With grammar calls now being real, metered API calls, I needed rate limiting. I built a lightweight IP-based credits system entirely in-memory (no database required for the MVP).

### Design

```
/api/credits  → GET: returns { remaining, limit }
/api/grammar  → POST: checks credits, calls AI, deducts on success
              → returns X-Credits-Remaining header on every response
```

The store is a `Map<string, { count: number; resetAt: number }>` keyed by IP. Each IP gets 20 free grammar expansions per day. The `resetAt` timestamp is set to midnight UTC of the current day, and stale entries are auto-expired on read.

### UI Feedback

The header displays a live credit counter: **✦ 18/20**. When credits drop to ≤3, the counter turns coral as a visual warning. The grammar expand button changes appearance based on state:

- **Before first load**: gold star with a `-1积分` cost badge — communicates the action has a cost
- **After load**: plain chevron — just a toggle, no more charges

This staged UI ensures users aren't surprised by credit consumption while still making the cost visible upfront.

---

## Phase 17: UX Overhaul — Modals, Sidebar, Onboarding

### Input Modal

The main input form moved from an inline card to a **modal** (z-index 60, backdrop click to close). This cleans up the primary view — when you're reading lyrics, the input form isn't taking up half the screen. A "新建歌曲" button (dashed coral border, pinned at top of the lyric list) reopens the modal.

### Welcome Modal

First-time visitors see an onboarding modal explaining the core workflow:
1. Paste lyrics → parse
2. Click any line's grammar button to get word-by-word breakdown
3. Upload audio for synchronized playback
4. Save songs to the sidebar

The modal only shows once (stored in `localStorage`), so returning users go straight to their saved songs.

### Sidebar Improvements

- **Active song highlighting**: the currently loaded song in the sidebar gets a gold left border, gold text, and a `▶` indicator — clear visual feedback on which song is active
- **Sidebar toggle relocation**: the open/close toggle moved into the sidebar header itself, next to the 收藏 label, with a separate edge tab that appears when the sidebar is closed
- **Audio timestamp persistence**: alignment timestamps are now saved in `SavedLyric` and restored on load — uploading an audio file to a saved song works immediately without re-alignment

### Stale Grammar State Fix

When switching between saved songs, the grammar breakdown from the previous song could bleed into the new one. The root cause: `grammarLoaded` was tracked in component state, but the components were being reused across song switches without unmounting.

Fix: add a `key` prop tied to the lyric line's index + content hash. React unmounts and remounts the component on key change, resetting all local state including `grammarLoaded`.

---

## Phase 18: Switch to Gemini 2.5 Flash Lite + Business Model

### Why Gemini

The grammar API was using Claude Haiku. I switched it to **Gemini 2.5 Flash Lite** for two reasons:

1. **Cost**: Gemini 2.5 Flash Lite is one of the cheapest capable models available (~$0.075/M input, $0.30/M output). A single grammar call costs ~$0.00022 — roughly ¥0.0016 per line.
2. **Structured output**: Gemini's `responseSchema` + `responseMimeType: "application/json"` works similarly to Anthropic's tool use. The SDK enforces the schema at the model level, eliminating JSON parsing failures.

```typescript
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.1,
  },
});
```

The schema adds a `baseForm` field (原型) for inflectable words — useful for learners who want to look up a verb's dictionary form.

### Business Model Document

With the tech cost structure validated (≈97% gross margin on grammar calls), I wrote a full `BUSINESS_MODEL.md` covering:
- Freemium boundary: first 30% of lines free
- Credits as the monetization primitive (1 credit = 1 grammar expansion)
- Pricing via 爱发电 (afdian.net), China's Patreon equivalent
- Revenue projections for 500 and 3000 MAU scenarios
- A phased roadmap from manual activation codes to a full Supabase + Clerk auth system

The 30% free threshold is deliberate: it gives users the opening verses to fall in love with the experience, but the chorus and bridge — where the most interesting grammar lives — require credits.

---

## Updated Architecture (as of Phase 18)

```
Browser
  └── page.tsx (client component)
        ├── useSavedLyrics (localStorage hook — includes timestamps)
        ├── SavedLyricsSidebar (active highlight, pin/rename/delete)
        ├── Welcome modal (first-visit onboarding)
        ├── Input modal (new song form)
        └── LyricsDisplay
              └── LyricLineCard (×N lines)
                    ├── ruby + romaji (from kuromoji, free)
                    ├── Translation pill (from DeepL, free tier)
                    └── Grammar panel (lazy — Gemini call on first expand)
                          └── GrammarCard (×M units, POS color stripe)

Server
  ├── /api/parse     → kuromoji (local) + DeepL API
  ├── /api/grammar   → credits check → Gemini 2.5 Flash Lite
  └── /api/credits   → in-memory IP rate limiter (20/day)
```

**Cost per full song parse:** ~$0 (kuromoji free, DeepL free tier)
**Cost per grammar expansion:** ~$0.00022 (~¥0.0016)
**Gross margin on ¥19.9 standard pack (350 credits):** ~97%

---

## Phase 19: Parse Architecture — LLM Line Splitting + LRCLIB Discovery

### The Parse Cost Problem

The original parse pipeline called Claude (opus-4-6) for everything: segmentation, furigana, romaji, translation, and grammar — all in one shot. Even after switching to kuromoji for segmentation and DeepL for translation, the remaining issue was **line splitting**: users could paste raw lyrics with no newlines, and the app had no reliable way to know where one sung phrase ended and the next began.

My first attempt was a kuromoji-based sentence boundary detector using POS tags (終助詞, verb 基本形 followed by a new clause opener). After two rounds of tuning it still over-split: lines with two kanji ended up as separate entries, and users could confirm it was too aggressive.

The better solution: **let an LLM do the splitting**. One Gemini 2.5 Flash Lite call at parse time — cheap (~$0.00022), deterministic with structured output, and actually understands Japanese lyric phrasing. The entire kuromoji split/merge codebase was deleted.

```
POST /api/parse { lyrics: string }
  → Gemini: split into lines[]     ← costs 1 credit
  → kuromoji: tokenize each line   ← free
  → return ParsedResult[]
```

**Prompt engineering for the splitter:**
- Strip inline furigana (e.g. `以上いじょう` → `以上`, `傷つくきずつく` → `傷つく`) — a common format on Japanese lyrics sites
- Group morpheme-level fragments back into natural phrases
- Target 8–15 JP chars per line; only exceed if genuinely unsplittable
- Merge lines shorter than 5 chars unless they stand alone musically

**Length guard:** `MAX_CHARS` dropped from 20,000 to 2,000. A typical J-pop song is 300–800 chars. Anything over 2,000 gets a friendly "歌词过长" error — this catches multi-song concatenation and token-farming attempts.

### LRCLIB — The Discovery That Changed Everything

While researching lyrics APIs, I came across [LRCLIB](https://lrclib.net) — a free, open, no-auth community lyrics database with ~3M tracks including **LRC synced lyrics**: timestamped line-by-line data in `[mm:ss.xx] text` format.

```
[00:09.08] 貴方は風のように
[00:12.80] 目を閉じては夕暮れ
[00:17.68] 何を思っているんだろうか
```

This was a breakthrough. The LRC format gives us:
1. **Line boundaries already solved** — no LLM splitting needed
2. **Timestamps for free** — no WhisperX alignment needed

The entire WhisperX pipeline (Replicate API call, audio upload, forced alignment) becomes optional for any song in the LRCLIB catalogue.

### LRCLIB Integration

**`/api/lrclib` proxy route:**
```
GET /api/lrclib?q=夜に駆ける    → search results
GET /api/lrclib?id=12345        → get track by ID
```
Server-side proxy avoids CORS issues and adds a `Lrclib-Client` header per their guidelines.

**LRC parser:**
```typescript
function parseLrc(lrc: string): { text: string; time: number }[] {
  return lrc.split("\n").map((line) => {
    const m = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)$/);
    if (!m) return null;
    return { text: m[3].trim(), time: parseInt(m[1]) * 60 + parseFloat(m[2]) };
  }).filter((l): l is { text: string; time: number } => l !== null && l.text.length > 0);
}
```

**Timestamps conversion to `LineTimestamp[]`:**
Each line's `endTime` = the next line's `startTime` (last line gets +5 seconds as a default tail).

**Parse API — two paths:**
```
POST /api/parse { lines: string[] }   → Path A: kuromoji only, FREE, no credit
POST /api/parse { lyrics: string }    → Path B: Gemini split + kuromoji, 1 credit
```

Path A is used for all LRCLIB-sourced songs. The lines are already properly split, so there's nothing for the LLM to do.

### New Song Modal — Tab UI

The "新建歌曲" modal gained a tab switcher:

```
┌─ 搜索歌曲 ──────────────────────────────────────┐
│  [search input]          [搜索]                  │
│  ┌──────────────────────────────────── 3:24 ──┐  │
│  │ 晴る — ヨルシカ · 幻燈 (Gentouu)  [时间轴] │  │
│  └──────────────────────────────────────────┘  │
│  数据来源：LRCLIB · 带「时间轴」标记的曲目…     │
└─────────────────────────────────────────────────┘

┌─ 粘贴歌词 ─┐  (original textarea + parse button)
```

The `时间轴` teal badge marks tracks with synced LRC data — these load instantly with timestamps already set.

---

## Phase 20: WhisperX Becomes Optional

With LRC timestamps available for catalogue songs, the audio upload logic needed updating.

**Before:** Uploading audio always cleared timestamps and triggered WhisperX alignment.

**After:**
```typescript
const handleAudioFile = async (file: File) => {
  setAudioUrl(url);
  // ...
  if (timestamps) return;  // ← LRC timestamps exist; audio is playback-only
  // ... WhisperX alignment only runs here for manual-paste songs
};
```

The `setTimestamps(null)` that used to run unconditionally on every audio upload was removed. Now:

| Song source | Audio upload does |
|-------------|-------------------|
| LRCLIB search (has LRC timestamps) | Sets playback URL only |
| Manual paste (no timestamps) | Triggers WhisperX alignment as before |

This means for catalogue songs, the full workflow is:
1. Search → select → instant parse (free)
2. Upload MP3/audio → immediate synchronized playback
3. No API calls, no alignment wait

---

## Updated Architecture (as of Phase 20)

```
Browser
  └── page.tsx
        ├── 新建歌曲 modal
        │     ├── [搜索歌曲] tab → LrcSearchPanel → /api/lrclib → /api/parse{lines}
        │     └── [粘贴歌词] tab → textarea → /api/parse{lyrics}
        ├── LyricsDisplay → LyricLineCard → /api/grammar (on expand)
        ├── Audio upload
        │     ├── has timestamps? → playback only
        │     └── no timestamps?  → /api/align (WhisperX)
        └── SavedLyricsSidebar

Server
  ├── /api/lrclib      → proxy to lrclib.net (search + get)
  ├── /api/parse       → Path A: kuromoji (free, lines[])
  │                    → Path B: Gemini split + kuromoji (1 credit, lyrics string)
  ├── /api/grammar     → credits check → Gemini 2.5 Flash Lite (1 credit/line)
  ├── /api/align       → WhisperX via Replicate (manual-paste songs only)
  └── /api/credits     → in-memory IP rate limiter (20/day)
```

---

## Updated Branch History

| Branch | Purpose |
|--------|---------|
| `main` | Current production version |
| `lrclib-search` | LRCLIB integration + LRC search UI |
| `gemini-grammar` | Gemini grammar API + credits system |
| `original` | Snapshot of the pre-alignment codebase |
| `whisperx` | WhisperX alignment integration (merged to main) |
| `force-alignment` | Forced-alignment experiments — both models failed for Japanese music |
